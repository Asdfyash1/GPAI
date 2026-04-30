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

  const system =
    "You are a STEM teacher who writes short, focused review quizzes. " +
    "Output ONLY valid JSON in this exact shape: " +
    '{"quiz":[{"question":"...","answer":"..."},{"question":"...","answer":"..."}]}. ' +
    "Each question must be answerable in <=2 sentences and directly related to the user's problem. " +
    "Mix concept recall, formula application, and short calculation. Do NOT use multiple choice. Do NOT include explanations outside the JSON object.";

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
      maxOutputTokens: 1200,
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

  let parsed: { quiz?: Array<{ question?: unknown; answer?: unknown }> };
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return Response.json(
      { error: `Could not parse quiz JSON. Got: ${raw.slice(0, 200)}` },
      { status: 502 },
    );
  }
  const quiz: PracticeItem[] = (parsed.quiz ?? [])
    .map((q) => ({
      question: typeof q.question === "string" ? q.question : "",
      answer: typeof q.answer === "string" ? q.answer : "",
    }))
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
