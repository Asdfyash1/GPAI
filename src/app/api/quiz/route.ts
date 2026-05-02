import {
  buildLanguageModel,
  configuredProviders,
  selectedModel,
} from "@/lib/orchestrator";
import { generateText } from "ai";
import type { ModelChoice, PracticeItem } from "@/types/education";

export const runtime = "nodejs";
export const maxDuration = 45;

type QuizRequest = {
  prompt?: string;
  solutionContext?: string;
  count?: number;
  modelChoice?: ModelChoice;
  /**
   * "mcq" -> all questions return 4 plausible choices + correct answer that
   * matches one of them verbatim.
   * "short" -> short-answer recall (1-2 sentence answer, no choices).
   * "mixed" (default) -> a mix of MCQ and short-answer in the same batch.
   */
  format?: "mcq" | "short" | "mixed";
};

type QuizResponse =
  | { quiz: PracticeItem[]; model: string }
  | { error: string };

export async function POST(request: Request): Promise<Response> {
  let body: QuizRequest;
  try {
    body = (await request.json()) as QuizRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const prompt = (body.prompt ?? "").trim();
  if (!prompt) {
    return Response.json({ error: "prompt required" }, { status: 400 });
  }
  const count = Math.min(Math.max(body.count ?? 5, 1), 8);
  const format: "mcq" | "short" | "mixed" = body.format ?? "mixed";

  const providers = configuredProviders();
  if (providers.length === 0) {
    return Response.json(
      { error: "No model provider configured." },
      { status: 503 },
    );
  }
  const provider = providers[0];
  const requested = selectedModel(body.modelChoice ?? "auto");
  const modelName =
    requested === "local-demo" ? provider.solverModel : requested;

  const formatRule =
    format === "mcq"
      ? "EVERY question must include a `choices` array of EXACTLY 4 plausible options, with `answer` matching one of those options verbatim. Use realistic distractors (close-but-wrong values, common misconceptions). Do NOT mark the correct option in the `choices` array — just put the correct option text in `answer`."
      : format === "short"
        ? "Do NOT use multiple choice. Each question must be answerable in <=2 sentences."
        : "Make about half of the questions multiple-choice (with a `choices` array of EXACTLY 4 options and `answer` matching one of them verbatim) and the other half short-answer (no `choices` field, answerable in <=2 sentences). Use realistic distractors for the MCQs.";

  const system =
    "You are a STEM teacher who writes short, focused review quizzes. " +
    "Output ONLY valid JSON in this exact shape: " +
    '{"quiz":[{"question":"...","answer":"...","choices":["A","B","C","D"],"explanation":"...","hint":"..."}]}. ' +
    "Per-item field rules:\n" +
    "- `question` and `answer` are REQUIRED.\n" +
    "- `choices` is OPTIONAL: include a 4-option array for multiple-choice questions; omit for short-answer.\n" +
    "- `explanation` is REQUIRED: one short sentence (≤25 words) explaining WHY the correct answer is right. Plain text — no markdown, no LaTeX `\\\\(...\\\\)`, no `$$`.\n" +
    "- `hint` is REQUIRED: one terse nudge (≤15 words) that points the student toward the right concept WITHOUT revealing the answer. Plain text.\n" +
    "Each question must be directly related to the user's problem and grounded in the reference solution if provided. " +
    "Mix concept recall, formula application, and short calculation. " +
    formatRule +
    " Do NOT include any text outside the JSON object — no markdown fences, no preamble, no commentary.";

  const userPrompt = [
    `Problem:\n${prompt}`,
    body.solutionContext
      ? `\n\nReference solution (for grounding only \u2014 don't repeat it verbatim):\n${body.solutionContext.slice(0, 4000)}`
      : "",
    `\n\nWrite ${count} review questions with concise correct answers in the JSON shape above.`,
  ].join("");

  let raw = "";
  try {
    const result = await generateText({
      model: buildLanguageModel(provider, modelName),
      system,
      prompt: userPrompt,
      temperature: 0.5,
      // Doubled from 1200 → 2400 to handle 5–8 questions × (question +
      // 4 choices + answer + explanation + hint) without truncation.
      // Truncation was the user-visible failure mode reported on
      // 2026-05-02 ("Could not parse quiz JSON. Got: …{question:…answ").
      maxOutputTokens: 2400,
    });
    raw = result.text;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Quiz model failed";
    const payload: QuizResponse = { error: message };
    return Response.json(payload, { status: 502 });
  }

  // Tolerantly extract the first `{...}` block — some models still wrap in
  // ```json fences or add a leading sentence.
  const jsonText = (() => {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]+?)```/i);
    if (fenced) return fenced[1].trim();
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start !== -1 && end > start) return raw.slice(start, end + 1);
    return raw.trim();
  })();

  let parsed: {
    quiz?: Array<{
      question?: unknown;
      answer?: unknown;
      choices?: unknown;
      explanation?: unknown;
      hint?: unknown;
    }>;
  };
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    // Truncated output is the most common parse failure (the model hits
    // its token cap mid-string). Recover by scanning for completed
    // `{...}` item objects inside the `"quiz":[...]` array — anything
    // ending in a clean `}` that we can JSON.parse on its own counts.
    const recovered = recoverTruncatedQuizItems(jsonText);
    if (recovered.length === 0) {
      return Response.json(
        { error: `Could not parse quiz JSON. Got: ${raw.slice(0, 200)}` },
        { status: 502 },
      );
    }
    parsed = { quiz: recovered };
  }
  const quiz: PracticeItem[] = (parsed.quiz ?? [])
    .map((q) => {
      const question = typeof q.question === "string" ? q.question : "";
      // Trim the answer symmetrically with choices so an LLM's stray
      // whitespace ("  9.8 m/s²  " vs choice "9.8 m/s²") doesn't make
      // a valid MCQ silently degrade to short-answer.
      const answer = typeof q.answer === "string" ? q.answer.trim() : "";
      const rawChoices = Array.isArray(q.choices) ? q.choices : null;
      const choices = rawChoices
        ?.map((c) => (typeof c === "string" ? c.trim() : ""))
        .filter((c): c is string => c.length > 0);
      // Only keep `choices` if there are 3+ options AND the answer matches
      // one of them (otherwise the model produced a malformed MCQ; degrade
      // gracefully to short-answer rather than rendering broken radios).
      const validChoices =
        choices && choices.length >= 3 && choices.includes(answer)
          ? choices
          : undefined;
      const explanation =
        typeof q.explanation === "string" && q.explanation.trim()
          ? q.explanation.trim()
          : undefined;
      const hint =
        typeof q.hint === "string" && q.hint.trim()
          ? q.hint.trim()
          : undefined;
      const base: PracticeItem = validChoices
        ? { question, answer, choices: validChoices }
        : { question, answer };
      if (explanation) base.explanation = explanation;
      if (hint) base.hint = hint;
      return base;
    })
    .filter((q) => q.question && q.answer)
    .slice(0, count);

  if (quiz.length === 0) {
    return Response.json(
      { error: "Quiz model returned no usable questions." },
      { status: 502 },
    );
  }

  const payload: QuizResponse = {
    quiz,
    model: `${provider.name}:${modelName}`,
  };
  return Response.json(payload);
}

/**
 * Recover quiz items from a truncated JSON string.
 *
 * The model hit its token cap mid-string, so the literal payload looks
 * like:
 *
 *   {"quiz":[{"question":"…","answer":"…","choices":[…]},
 *            {"question":"…","answer":"…","choices":[…]},
 *            {"question":"What is the order of the …","answer":"3",…
 *
 * — a valid array open, two complete items, then a third item that's
 * partially serialised. We can still salvage the two complete items
 * by scanning forward through the array, tracking brace depth, and
 * collecting every range that starts at `{` and closes at the matching
 * `}` (depth back to 0). Each such range is fed to JSON.parse
 * individually; anything that fails to parse is silently dropped.
 *
 * This is intentionally simple — full streaming-JSON parsers exist
 * (clarinet, jsonparse, etc.) but they all bring a dep just to recover
 * from a 1-in-N tail truncation.
 */
function recoverTruncatedQuizItems(text: string): Array<{
  question?: unknown;
  answer?: unknown;
  choices?: unknown;
  explanation?: unknown;
  hint?: unknown;
}> {
  const arrayStart = text.indexOf('"quiz"');
  const startBracket = arrayStart === -1 ? -1 : text.indexOf("[", arrayStart);
  if (startBracket === -1) return [];

  const items: unknown[] = [];
  let depth = 0;
  let itemStart = -1;
  let inString = false;
  let escape = false;

  for (let i = startBracket + 1; i < text.length; i += 1) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) itemStart = i;
      depth += 1;
      continue;
    }
    if (ch === "}") {
      depth -= 1;
      if (depth === 0 && itemStart !== -1) {
        const slice = text.slice(itemStart, i + 1);
        try {
          items.push(JSON.parse(slice));
        } catch {
          /* skip malformed item */
        }
        itemStart = -1;
      }
      continue;
    }
    if (ch === "]" && depth === 0) break;
  }

  return items as Array<{
    question?: unknown;
    answer?: unknown;
    choices?: unknown;
    explanation?: unknown;
    hint?: unknown;
  }>;
}
