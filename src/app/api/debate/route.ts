import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";

export const runtime = "nodejs";
export const maxDuration = 60;

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
};

type JudgeResult = {
  winner: string;
  reasoning: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as { prompt: string; system?: string };
  if (!body.prompt) {
    return Response.json({ error: "A prompt is required." }, { status: 400 });
  }

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "No API key configured." },
      { status: 500 },
    );
  }

  const provider = createOpenAICompatible({
    baseURL: nvidiaBaseUrl,
    name: "nvidia",
    apiKey,
  });

  const system =
    body.system ??
    "You are a knowledgeable STEM tutor. Answer clearly with examples and LaTeX for math.";

  const entries: DebateEntry[] = [];
  const settled = await Promise.allSettled(
    DEBATE_MODELS.map(async (m) => {
      const start = Date.now();
      const result = await generateText({
        model: provider.chatModel(m.id),
        system,
        prompt: body.prompt,
        temperature: 0.3,
        maxOutputTokens: 4096,
      });
      return {
        model: m.id,
        label: m.label,
        response: result.text,
        durationMs: Date.now() - start,
      };
    }),
  );

  for (const s of settled) {
    if (s.status === "fulfilled") {
      entries.push(s.value);
    }
  }

  if (entries.length === 0) {
    return Response.json(
      { error: "All models failed to respond." },
      { status: 502 },
    );
  }

  let judge: JudgeResult = {
    winner: entries[0].label,
    reasoning: "Only one model responded successfully.",
  };

  if (entries.length >= 2) {
    try {
      const judgePrompt = buildJudgePrompt(body.prompt, entries);
      const judgeResult = await generateText({
        model: provider.chatModel("meta/llama-3.3-70b-instruct"),
        system:
          "You are an impartial judge evaluating AI responses. Output ONLY valid JSON.",
        prompt: judgePrompt,
        temperature: 0.1,
        maxOutputTokens: 512,
      });
      const parsed = parseJudgeResponse(judgeResult.text, entries);
      if (parsed) judge = parsed;
    } catch {
      judge = {
        winner: entries.reduce((a, b) =>
          a.response.length > b.response.length ? a : b,
        ).label,
        reasoning: "Judge model unavailable; selected longest response.",
      };
    }
  }

  return Response.json({
    entries,
    judge,
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
