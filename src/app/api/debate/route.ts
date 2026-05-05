import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { requireAuth } from "@/lib/api-guard";

export const runtime = "nodejs";
export const maxDuration = 120;

const nvidiaBaseUrl = "https://integrate.api.nvidia.com/v1";

const DEBATE_MODELS = [
  { id: "meta/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
  { id: "nvidia/llama-3.3-nemotron-super-49b-v1", label: "Nemotron 49B" },
  { id: "deepseek-ai/deepseek-v4-flash", label: "DeepSeek V4 Flash" },
  { id: "mistralai/mistral-large-3-675b-instruct-2512", label: "Mistral Large 3" },
];

type DebateEntry = {
  model: string;
  label: string;
  response: string;
  durationMs: number;
  error?: string;
};

type JudgeResult = {
  winner: string;
  reasoning: string;
};

export async function POST(request: Request) {
  const guard = await requireAuth(request, { maxRequests: 10 });
  if (!guard.ok) return guard.response;

  let body: { prompt: string; system?: string };
  try {
    body = (await request.json()) as { prompt: string; system?: string };
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.prompt) {
    return Response.json({ error: "A prompt is required." }, { status: 400 });
  }

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "AI service is not available." },
      { status: 503 },
    );
  }

  const provider = createOpenAICompatible({
    baseURL: nvidiaBaseUrl,
    name: "nvidia",
    apiKey,
  });

  const system =
    body.system ??
    "You are a knowledgeable STEM tutor. Answer clearly and concisely with examples and LaTeX for math. Keep your response focused and under 500 words.";

  const entries: DebateEntry[] = [];
  const errors: Array<{ label: string; error: string }> = [];

  const settled = await Promise.allSettled(
    DEBATE_MODELS.map(async (m) => {
      const start = Date.now();
      const result = await generateText({
        model: provider.chatModel(m.id),
        system,
        prompt: body.prompt,
        temperature: 0.3,
        maxOutputTokens: 2048,
      });
      return {
        model: m.id,
        label: m.label,
        response: result.text,
        durationMs: Date.now() - start,
      };
    }),
  );

  for (let i = 0; i < settled.length; i++) {
    const s = settled[i];
    if (s.status === "fulfilled") {
      entries.push(s.value);
    } else {
      const label = DEBATE_MODELS[i].label;
      const errMsg = s.reason instanceof Error ? s.reason.message : "Failed";
      errors.push({ label, error: errMsg });
      entries.push({
        model: DEBATE_MODELS[i].id,
        label,
        response: "*Model failed to respond.*",
        durationMs: Date.now(),
        error: "unavailable",
      });
    }
  }

  const successEntries = entries.filter((e) => !e.error);

  if (successEntries.length === 0) {
    console.error("[debate] All models failed:", errors);
    return Response.json(
      { error: "All models failed to respond. Please try again later." },
      { status: 502 },
    );
  }

  let judge: JudgeResult = {
    winner: successEntries[0].label,
    reasoning: "Only one model responded successfully.",
  };

  if (successEntries.length >= 2) {
    try {
      const judgePrompt = buildJudgePrompt(body.prompt, successEntries);
      const judgeResult = await generateText({
        model: provider.chatModel("meta/llama-3.3-70b-instruct"),
        system:
          "You are an impartial judge evaluating AI responses. Output ONLY valid JSON.",
        prompt: judgePrompt,
        temperature: 0.1,
        maxOutputTokens: 512,
      });
      const parsed = parseJudgeResponse(judgeResult.text, successEntries);
      if (parsed) judge = parsed;
    } catch {
      judge = {
        winner: successEntries.reduce((a, b) =>
          a.response.length > b.response.length ? a : b,
        ).label,
        reasoning: "Judge model unavailable; selected longest response.",
      };
    }
  }

  return Response.json({
    entries,
    judge,
    errors: errors.length > 0 ? errors : undefined,
  });
}

function buildJudgePrompt(question: string, entries: DebateEntry[]): string {
  let prompt = `Question: "${question}"\n\nBelow are responses from different AI models. Pick the BEST response.\n\n`;
  for (const e of entries) {
    prompt += `--- ${e.label} ---\n${e.response.slice(0, 2000)}\n\n`;
  }
  prompt += `Respond with JSON only: {"winner": "<model label>", "reasoning": "<1-2 sentence explanation>"}`;
  return prompt;
}

function parseJudgeResponse(
  text: string,
  entries: DebateEntry[],
): JudgeResult | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as JudgeResult;
    if (!parsed.winner || !parsed.reasoning) return null;
    const valid = entries.some(
      (e) => e.label.toLowerCase() === parsed.winner.toLowerCase(),
    );
    if (!valid) {
      parsed.winner = entries[0].label;
    }
    return parsed;
  } catch {
    return null;
  }
}
