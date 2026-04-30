import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, streamText } from "ai";
import type {
  EducationRequest,
  ModelChoice,
  VerificationSignal,
} from "@/types/education";
import { buildDemoResponse } from "@/lib/demo-solver";
import { parseModelResponse } from "@/lib/response-parser";
import { buildTaskPrompt, buildVerifierPrompt, getSystemPrompt } from "@/lib/prompts";

const nvidiaBaseUrl = "https://integrate.api.nvidia.com/v1";
const REQUEST_TIMEOUT_MS = 90_000;

const nvidiaModelRoutes = {
  auto: process.env.NVIDIA_SOLVER_MODEL ?? "meta/llama-3.3-70b-instruct",
  "mistral-large": "mistralai/mistral-large-3-675b-instruct-2512",
  nemotron: "nvidia/llama-3.3-nemotron-super-49b-v1",
  "deepseek-flash": "deepseek-ai/deepseek-v4-flash",
  llama: "meta/llama-3.3-70b-instruct",
  demo: "local-demo",
} as const;

export function selectedModel(choice: keyof typeof nvidiaModelRoutes) {
  if (choice === "demo") return "local-demo";
  const envName = `NVIDIA_MODEL_${choice.toUpperCase().replaceAll("-", "_")}`;
  return process.env[envName] ?? nvidiaModelRoutes[choice];
}

export type Provider = {
  name: string;
  key: string;
  baseURL: string;
  solverModel: string;
  verifierModel: string;
};

export function configuredProviders(): Provider[] {
  const providers: Provider[] = [];

  if (process.env.NVIDIA_API_KEY || process.env.NIM_API_KEY) {
    providers.push({
      name: "Cloud",
      key: process.env.NVIDIA_API_KEY ?? process.env.NIM_API_KEY ?? "",
      baseURL: process.env.NVIDIA_BASE_URL ?? nvidiaBaseUrl,
      solverModel: process.env.NVIDIA_SOLVER_MODEL ?? nvidiaModelRoutes.auto,
      verifierModel:
        process.env.NVIDIA_VERIFIER_MODEL ?? "meta/llama-3.3-70b-instruct",
    });
  }

  if (process.env.ADDITIONAL_OPENAI_COMPATIBLE_API_KEY) {
    providers.push({
      name: process.env.ADDITIONAL_OPENAI_COMPATIBLE_NAME ?? "Additional model",
      key: process.env.ADDITIONAL_OPENAI_COMPATIBLE_API_KEY,
      baseURL:
        process.env.ADDITIONAL_OPENAI_COMPATIBLE_BASE_URL ?? "https://api.openai.com/v1",
      solverModel:
        process.env.ADDITIONAL_OPENAI_COMPATIBLE_MODEL ?? "gpt-4o-mini",
      verifierModel:
        process.env.ADDITIONAL_OPENAI_COMPATIBLE_MODEL ?? "gpt-4o-mini",
    });
  }

  return providers;
}

export function buildLanguageModel(provider: Provider, modelName: string) {
  const llm = createOpenAICompatible({
    name: provider.name.toLowerCase().replaceAll(" ", "-"),
    baseURL: provider.baseURL,
    headers: {
      Authorization: `Bearer ${provider.key}`,
    },
  });
  return llm.chatModel(modelName);
}

async function generateWithProvider(
  provider: Provider,
  modelName: string,
  system: string,
  prompt: string,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const result = await generateText({
      model: buildLanguageModel(provider, modelName),
      system,
      prompt,
      temperature: 0.2,
      maxOutputTokens: 4096,
      abortSignal: controller.signal,
    });
    return result.text;
  } finally {
    clearTimeout(timeout);
  }
}

export async function runEducationalOrchestrator(request: EducationRequest) {
  const providers = configuredProviders();
  const verification: VerificationSignal[] = [];
  const requestedModel = selectedModel(request.modelChoice ?? "auto");

  if (request.modelChoice === "demo" || providers.length === 0) {
    verification.push({
      model: request.modelChoice === "demo" ? "local-demo:selected" : "local-demo",
      role: "solver",
      status: "fallback",
      notes:
        "No API key configured; returned deterministic demo output with the same structure.",
    });
    return buildDemoResponse(request, verification);
  }

  const primary = providers[0];
  const solverModel = requestedModel === "local-demo" ? primary.solverModel : requestedModel;
  let draft = "";

  try {
    draft = await generateWithProvider(
      primary,
      solverModel,
      getSystemPrompt(request.mode),
      buildTaskPrompt(request),
    );
    verification.push({
      model: `${primary.name}:${solverModel}`,
      role: "solver",
      status: "complete",
      notes: "Generated the first textbook-grade solution.",
    });
  } catch (error) {
    console.error("[orchestrator] Solver failed:", error);
    verification.push({
      model: `${primary.name}:${solverModel}`,
      role: "solver",
      status: "fallback",
      notes: error instanceof Error ? error.message : "Primary model call failed.",
    });
    return buildDemoResponse(request, verification);
  }

  let finalDraft = draft;

  if (request.mode === "solver" || request.mode === "cheatsheet") {
    try {
      finalDraft = await generateWithProvider(
        primary,
        primary.verifierModel,
        "You are a strict STEM verifier and structural answer formatter.",
        buildVerifierPrompt(draft, request),
      );
      verification.push({
        model: `${primary.name}:${primary.verifierModel}`,
        role: "formatter",
        status: "complete",
        notes: "Checked and reorganized the model answer into a student-facing structure.",
      });
    } catch (error) {
      verification.push({
        model: `${primary.name}:${primary.verifierModel}`,
        role: "formatter",
        status: "fallback",
        notes:
          error instanceof Error
            ? `Verifier failed; using primary answer. ${error.message}`
            : "Verifier failed; using primary answer.",
      });
    }
  } else {
    verification.push({
      model: `${primary.name}:${solverModel}`,
      role: "formatter",
      status: "complete",
      notes: `Single-pass generation for ${request.mode} mode.`,
    });
  }

  if (request.crossCheck && request.mode === "solver") {
    for (const provider of providers.slice(1, 3)) {
      try {
        await generateWithProvider(
          provider,
          provider.verifierModel,
          "You are an independent STEM critic. Check answer correctness, missing assumptions, formulas, and pedagogy. Be concise.",
          `Original prompt:\n${request.prompt}\n\nAnswer to audit:\n${finalDraft}`,
        );
        verification.push({
          model: `${provider.name}:${provider.verifierModel}`,
          role: "critic",
          status: "complete",
          notes: "Independent cross-check completed.",
        });
      } catch (error) {
        verification.push({
          model: `${provider.name}:${provider.verifierModel}`,
          role: "critic",
          status: "skipped",
          notes: error instanceof Error ? error.message : "Cross-check failed.",
        });
      }
    }
  }

  return parseModelResponse(finalDraft, request, verification);
}

export type StreamingHandle = {
  textStream: AsyncIterable<string>;
  /**
   * Returns the final aggregated text. Resolves only after the underlying
   * stream finishes.
   */
  text: Promise<string>;
};

export async function streamEducationalSolverDraft(
  request: EducationRequest,
): Promise<StreamingHandle> {
  const providers = configuredProviders();
  if (request.modelChoice === "demo" || providers.length === 0) {
    return demoStream(request);
  }

  const primary = providers[0];
  const requestedModel = selectedModel(request.modelChoice ?? "auto");
  const modelName = requestedModel === "local-demo" ? primary.solverModel : requestedModel;

  const result = streamText({
    model: buildLanguageModel(primary, modelName),
    system: getSystemPrompt(request.mode),
    prompt: buildTaskPrompt(request),
    temperature: 0.2,
    maxOutputTokens: 4096,
  });

  return {
    textStream: result.textStream,
    text: Promise.resolve(result.text),
  };
}

export async function streamChatResponse(options: {
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  modelChoice: ModelChoice;
  deepExplain: boolean;
  webContext?: string;
}): Promise<StreamingHandle> {
  const providers = configuredProviders();
  if (options.modelChoice === "demo" || providers.length === 0) {
    return demoChatStream(options);
  }

  const primary = providers[0];
  const requested = selectedModel(options.modelChoice ?? "auto");
  const modelName = requested === "local-demo" ? primary.solverModel : requested;

  const lastUser = [...options.messages].reverse().find((m) => m.role === "user");
  const lastUserText = (lastUser?.content ?? "").trim();
  const trivial = isTrivialMessage(lastUserText);

  const conversationalSystem =
    "You are a friendly, knowledgeable STEM tutor in a conversational chat. " +
    "Mirror the user's tone and length. For greetings, small-talk, confirmations, or short follow-ups, reply briefly and warmly in 1-2 sentences \u2014 do NOT use headings, numbered sections, lists, or LaTeX. " +
    "For real STEM questions, explain clearly with examples and use LaTeX for math; use lists and short headings only when they aid understanding. " +
    "Never invent a textbook-length answer when the user did not ask for one. Never start a response with 'Understanding the ...' or any other forced essay framing.";

  const deepExplainSystem =
    "You are a STEM tutor in 'Deep Explain' mode. " +
    "IMPORTANT: First decide whether the user's latest message is a substantive STEM question. " +
    "If it is small-talk, a greeting (e.g. 'hi'), a thank-you, an off-topic remark, or a clarifying meta question, reply briefly and conversationally in 1-2 sentences \u2014 do NOT produce a multi-section document. " +
    "Only when the user asks a substantive STEM question should you build a rich, multi-section explainer with 3-6 markdown sections (Core idea, Formula/Definition, Worked intuition, Examples, Visual intuition, Common mistakes), LaTeX math, and 2-3 follow-up questions at the end. " +
    "Never start a response with 'Understanding the ...' or any other forced essay framing.";

  let system = options.deepExplain && !trivial ? deepExplainSystem : conversationalSystem;

  if (options.webContext && options.webContext.trim().length > 0) {
    system +=
      "\n\nWeb search context (use this to ground your answer; cite the source URL inline like (source: https://...) when you rely on a snippet):\n" +
      options.webContext;
  }

  const result = streamText({
    model: buildLanguageModel(primary, modelName),
    system,
    messages: options.messages,
    temperature: trivial ? 0.5 : 0.3,
    maxOutputTokens: trivial ? 256 : 4096,
  });

  return {
    textStream: result.textStream,
    text: Promise.resolve(result.text),
  };
}

const SMALL_TALK_REGEX =
  /^(hi+|hey+|hello+|yo|sup|hola|namaste|salaam|good\s+(morning|evening|afternoon|night)|thanks+|thank\s*you|ty|tysm|ok(ay)?|cool|nice|great|wow|lol|lmao|bye+|goodbye|see\s*ya|cya|how\s*are\s*you|what'?s\s*up|wassup|sup|test|testing|ping)\b[\s!?.,]*$/i;

function isTrivialMessage(text: string): boolean {
  if (!text) return true;
  const trimmed = text.trim();
  if (trimmed.length === 0) return true;
  if (SMALL_TALK_REGEX.test(trimmed)) return true;
  // Treat very short messages with no question mark and no math as small-talk.
  if (
    trimmed.length <= 12 &&
    !/[?]/.test(trimmed) &&
    !/[=+\-*/^]|\d/.test(trimmed)
  ) {
    return true;
  }
  return false;
}

async function demoStream(request: EducationRequest): Promise<StreamingHandle> {
  const text = `# Demo response\n\nThis is a fallback because no API key is configured.\n\n## Problem\n${request.prompt}\n\n## Answer\nConfigure an API key in \`.env.local\` to enable the real model.\n\n## Solution\nDeterministic demo output for the **${request.mode}** mode.`;
  return {
    textStream: chunked(text),
    text: Promise.resolve(text),
  };
}

async function demoChatStream(options: {
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
}): Promise<StreamingHandle> {
  const last = options.messages[options.messages.length - 1]?.content ?? "";
  const text = `Demo mode (no API key configured). You said: "${last.slice(0, 200)}"\n\nConfigure an API key in \`.env.local\` to enable real chat.`;
  return {
    textStream: chunked(text),
    text: Promise.resolve(text),
  };
}

async function* chunked(text: string): AsyncGenerator<string> {
  const tokens = text.match(/[\s\S]{1,16}/g) ?? [text];
  for (const chunk of tokens) {
    await new Promise((r) => setTimeout(r, 25));
    yield chunk;
  }
}
