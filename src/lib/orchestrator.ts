import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, streamText } from "ai";
import type {
  CrossCheckResult,
  CrossCheckStatus,
  EducationRequest,
  ModelChoice,
  UploadedAsset,
  VerificationSignal,
} from "@/types/education";
import { buildDemoResponse } from "@/lib/demo-solver";
import { parseModelResponse } from "@/lib/response-parser";
import {
  buildPersonalizationSuffix,
  buildTaskPrompt,
  buildVerifierPrompt,
  getSystemPrompt,
} from "@/lib/prompts";
import {
  ATTACHMENT_FAILURE_PREFIX,
  findUnreadableAttachments,
} from "@/lib/vision";

const nvidiaBaseUrl = "https://integrate.api.nvidia.com/v1";
const REQUEST_TIMEOUT_MS = 90_000;

const nvidiaModelRoutes = {
  auto: process.env.NVIDIA_SOLVER_MODEL ?? "meta/llama-3.3-70b-instruct",
  "mistral-large": "mistralai/mistral-large-3-675b-instruct-2512",
  nemotron: "nvidia/llama-3.3-nemotron-super-49b-v1",
  "deepseek-flash": "deepseek-ai/deepseek-v4-flash",
  llama: "meta/llama-3.3-70b-instruct",
  debate: "meta/llama-3.3-70b-instruct",
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

  // HARD STOP: see streamEducationalSolverDraft for rationale.
  const unreadable = findUnreadableAttachments(request.attachments);
  if (unreadable.length > 0 && unreadable.length === request.attachments.length) {
    verification.push({
      model: "vision:all-providers",
      role: "solver",
      status: "fallback",
      notes: "All OCR providers failed to read the uploaded attachment(s); skipped LLM call to prevent hallucination.",
    });
    return parseModelResponse(
      buildUnreadableAttachmentsMarkdown(unreadable),
      request,
      verification,
    );
  }

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
      getSystemPrompt(request.mode, request.personalization),
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

  // Best-effort: ask a small LLM for a 2-5 word semantic sidebar title.
  // Skip for chat (chat sessions title themselves from the first user message).
  let titleOverride: string | null = null;
  if (request.mode !== "chat") {
    titleOverride = await generateTaskTitle(request, finalDraft);
  }

  return parseModelResponse(finalDraft, request, verification, {
    titleOverride,
  });
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
  // HARD STOP: if every attachment failed to OCR, never call the LLM —
  // it WILL hallucinate a problem. Stream a deterministic "couldn't read
  // your file" markdown response so the user sees a clear, honest error.
  const unreadable = findUnreadableAttachments(request.attachments);
  if (unreadable.length > 0 && unreadable.length === request.attachments.length) {
    return unreadableAttachmentsStream(unreadable);
  }

  const providers = configuredProviders();
  if (request.modelChoice === "demo" || providers.length === 0) {
    return demoStream(request);
  }

  const primary = providers[0];
  const requestedModel = selectedModel(request.modelChoice ?? "auto");
  const modelName = requestedModel === "local-demo" ? primary.solverModel : requestedModel;

  const result = streamText({
    model: buildLanguageModel(primary, modelName),
    system: getSystemPrompt(request.mode, request.personalization),
    prompt: buildTaskPrompt(request),
    temperature: 0.2,
    maxOutputTokens: 16384,
  });

  return withQuotaFallback(
    { textStream: result.textStream, text: Promise.resolve(result.text) },
    request.prompt,
  );
}

/**
 * Run a real cross-check: solve the same problem through a secondary model
 * and ask a tiny LLM-judge whether the two final answers AGREE / disagree.
 *
 * Returns "skipped" if there is no usable secondary model or any step fails.
 * This is intentionally cheap (one extra solve + one one-token judge call)
 * and runs after the user has already received the primary streamed answer.
 */
/**
 * Ask a small LLM to summarise a STEM problem into a 2-5 word semantic title
 * (mirrors gpai.app's auto-titled tasks in the sidebar — e.g. "Solving 4th-order
 * ODE", "Quadratic factoring", "Cell-membrane diffusion"). Falls back to null
 * on any failure so callers can keep their existing heuristic title.
 */
export async function generateTaskTitle(
  request: EducationRequest,
  primaryAnswerText: string,
): Promise<string | null> {
  const providers = configuredProviders();
  const primary = providers[0];
  if (!primary) return null;

  // Use a fast, cheap title-only model. Defaults to the primary solver model
  // because it's already loaded; an env var lets us swap in a smaller model.
  const titleModel =
    process.env.NVIDIA_TITLE_MODEL ?? primary.solverModel;

  const promptSnippet = request.prompt.trim().slice(0, 600);
  const answerSnippet = primaryAnswerText.trim().slice(0, 400);

  const system =
    "You write ultra-short, descriptive titles (2-5 words) summarising STEM problems for a sidebar list. Return the title only — no quotes, no punctuation, no markdown, no trailing period. Examples: \"Solving 4th-order ODE\", \"Quadratic factoring\", \"Projectile motion problem\", \"Pythagorean theorem proof\".";
  const userPrompt =
    `Problem prompt:\n${promptSnippet}` +
    (answerSnippet ? `\n\nFirst part of answer:\n${answerSnippet}` : "") +
    "\n\nTitle (2-5 words, no quotes):";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const result = await generateText({
      model: buildLanguageModel(primary, titleModel),
      system,
      prompt: userPrompt,
      temperature: 0.2,
      maxOutputTokens: 24,
      abortSignal: controller.signal,
    });
    const raw = result.text ?? "";
    return cleanTitle(raw);
  } catch (error) {
    console.warn("[orchestrator] title generation failed:", error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function cleanTitle(raw: string): string | null {
  const firstLine = raw.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  if (!firstLine) return null;
  // Strip wrapping quotes/backticks and trailing punctuation.
  const stripped = firstLine
    .replace(/^["'`*_\s]+/, "")
    .replace(/["'`*_\s]+$/, "")
    .replace(/[.!?…]+$/, "")
    .trim();
  if (!stripped) return null;
  // Reject obvious failure modes: too long, too short, or contains markdown.
  if (stripped.length > 80) return null;
  if (stripped.length < 2) return null;
  if (/^[#>*]/.test(stripped)) return null;
  return stripped;
}

export async function runCrossCheckOnAnswer(
  request: EducationRequest,
  primaryAnswerText: string,
): Promise<CrossCheckResult> {
  const providers = configuredProviders();
  const primary = providers[0];
  const primaryModelName = (() => {
    const requested = selectedModel(request.modelChoice ?? "auto");
    return requested === "local-demo" ? primary?.solverModel ?? "unknown" : requested;
  })();

  // Pick a secondary model. Prefer a different *provider* if configured;
  // otherwise pick a different *model* on the same provider.
  let secondaryProvider: Provider | undefined;
  let secondaryModelName: string | undefined;
  if (providers.length >= 2) {
    secondaryProvider = providers[1];
    secondaryModelName = secondaryProvider.solverModel;
  } else if (primary) {
    secondaryProvider = primary;
    const fallback = process.env.NVIDIA_CROSSCHECK_MODEL;
    const candidates = [
      fallback,
      "nvidia/llama-3.3-nemotron-super-49b-v1",
      "mistralai/mistral-large-3-675b-instruct-2512",
      "deepseek-ai/deepseek-v4-flash",
      "meta/llama-3.3-70b-instruct",
    ].filter(
      (m): m is string => typeof m === "string" && m !== primaryModelName,
    );
    secondaryModelName = candidates[0];
  }

  if (!secondaryProvider || !secondaryModelName) {
    return {
      status: "skipped",
      primaryModel: primaryModelName,
      secondaryModel: "(none configured)",
      notes: "No secondary model available for cross-check.",
    };
  }

  let secondaryAnswer = "";
  try {
    secondaryAnswer = await generateWithProvider(
      secondaryProvider,
      secondaryModelName,
      "You are an independent STEM solver. Solve the user's problem rigorously and end your reply with a single line of the exact form: FINAL ANSWER: <your final answer>.",
      request.prompt,
    );
  } catch (error) {
    return {
      status: "skipped",
      primaryModel: primaryModelName,
      secondaryModel: `${secondaryProvider.name}:${secondaryModelName}`,
      notes:
        error instanceof Error
          ? `Secondary model failed: ${error.message}`
          : "Secondary model failed.",
    };
  }

  const extractFinal = (text: string) => {
    const m = text.match(/FINAL ANSWER:\s*([^\n]+)/i);
    if (m) return m[1].trim();
    // fall back to last non-empty line
    const lines = text
      .trim()
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
    return lines[lines.length - 1] ?? "";
  };
  const primaryFinal = extractFinal(primaryAnswerText);
  const secondaryFinal = extractFinal(secondaryAnswer);

  let status: CrossCheckStatus = "skipped";
  let notes: string | undefined;
  try {
    const judgement = await generateWithProvider(
      primary,
      primary.verifierModel,
      "You are a strict STEM answer comparator. Decide whether two final answers to the SAME problem agree numerically and conceptually.",
      [
        "Two AI models answered the SAME problem.",
        "",
        "Problem:",
        request.prompt,
        "",
        "Model A final answer:",
        primaryFinal || primaryAnswerText.slice(-400),
        "",
        "Model B final answer:",
        secondaryFinal || secondaryAnswer.slice(-400),
        "",
        "Reply with EXACTLY one of these tokens on the first line and nothing else:",
        "AGREE      (same final answer / same conclusion)",
        "MINOR      (off by rounding, units, or trivially equivalent)",
        "DISAGREE   (genuinely different conclusions)",
      ].join("\n"),
    );
    const token = judgement.trim().split(/\s+/)[0]?.toUpperCase() ?? "";
    if (token === "AGREE") status = "agree";
    else if (token === "MINOR") status = "minor";
    else if (token === "DISAGREE") status = "disagree";
    else {
      status = "skipped";
      notes = `Comparator returned an unexpected token: ${token.slice(0, 32)}`;
    }
  } catch (error) {
    notes =
      error instanceof Error
        ? `Comparator failed: ${error.message}`
        : "Comparator failed.";
  }

  return {
    status,
    primaryModel: primaryModelName,
    secondaryModel: `${secondaryProvider.name}:${secondaryModelName}`,
    primaryAnswer: primaryFinal || undefined,
    secondaryAnswer: secondaryFinal || undefined,
    notes,
  };
}

export async function streamChatResponse(options: {
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  modelChoice: ModelChoice;
  deepExplain: boolean;
  webContext?: string;
  personalization?: EducationRequest["personalization"];
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

  system += buildPersonalizationSuffix(options.personalization);

  if (options.webContext && options.webContext.trim().length > 0) {
    system += "\n\nWeb search context:\n" + options.webContext;
  }

  const result = streamText({
    model: buildLanguageModel(primary, modelName),
    system,
    messages: options.messages,
    temperature: trivial ? 0.5 : 0.3,
    maxOutputTokens: trivial ? 256 : 16384,
  });

  const lastUserContent =
    [...options.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  return withQuotaFallback(
    { textStream: result.textStream, text: Promise.resolve(result.text) },
    lastUserContent,
  );
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

function quotaFallbackStream(prompt: string): StreamingHandle {
  const text =
    "The AI model is temporarily unavailable (rate limit or server error). " +
    "Please try again in a moment.\n\n" +
    `**Your prompt:** ${prompt.slice(0, 300)}${prompt.length > 300 ? "…" : ""}`;
  return {
    textStream: chunked(text),
    text: Promise.resolve(text),
  };
}

function isQuotaOrServerError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\b429\b/.test(msg) || /\b5\d{2}\b/.test(msg) || /rate.?limit/i.test(msg) || /too many requests/i.test(msg);
}

function withQuotaFallback(
  handle: StreamingHandle,
  prompt: string,
): StreamingHandle {
  async function* wrapped() {
    try {
      for await (const chunk of handle.textStream) {
        yield chunk;
      }
    } catch (err) {
      if (isQuotaOrServerError(err)) {
        console.warn("[orchestrator] quota/server error, falling back:", err);
        for await (const chunk of quotaFallbackStream(prompt).textStream) {
          yield chunk;
        }
      } else {
        throw err;
      }
    }
  }
  return { textStream: wrapped(), text: handle.text };
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

/**
 * Build the deterministic markdown response that replaces an LLM call when
 * every uploaded attachment failed OCR. The format matches the standard
 * sectioned answer (## Problem, ## Answer, ...) so the response-parser and
 * UI render it without special-casing — but every section honestly tells
 * the user the file was unreadable instead of inventing a problem.
 */
function buildUnreadableAttachmentsMarkdown(
  unreadable: UploadedAsset[],
): string {
  const list = unreadable
    .map((file) => {
      const reason = (file.extractedText ?? "")
        .replace(ATTACHMENT_FAILURE_PREFIX, "")
        .trim();
      return `- **${file.name}** — ${reason || "could not be read"}`;
    })
    .join("\n");

  return [
    "## Problem",
    "I couldn't read the file(s) you uploaded, so I won't guess at a problem.",
    "",
    list,
    "",
    "## Answer",
    "**Please re-upload a clearer copy.** Specifically:",
    "- Photo of a textbook page → take it straight on, in good light, with the equation filling most of the frame.",
    "- Screenshot → make sure the text is sharp and large (no tiny thumbnails).",
    "- PDF → if it is a scanned PDF, save individual pages as PNG / JPG and upload those instead — text-only PDFs work, but image-only PDFs need OCR which sometimes fails on poor scans.",
    "- Or paste the problem text directly into the box and I'll solve it immediately.",
    "",
    "## Cross-check",
    "Skipped: with no readable input there is nothing to verify.",
    "",
    "## Solution",
    "_Will be produced once a readable copy of the problem is available._",
    "",
    "## Verification",
    "_n/a_",
    "",
    "## Common mistakes",
    "- Photographing at an angle so the equation distorts.",
    "- Using a screenshot of a screenshot — each pass loses fidelity.",
    "- Uploading a PDF that contains only scanned page images without an OCR layer.",
    "",
    "## Key concepts",
    "- A clear, well-lit, head-on capture is enough for the vision model to transcribe handwritten math.",
    "",
    "## Follow-up questions",
    "- Would you like to type the equation manually instead?",
    "",
    "## Quiz",
    "_n/a — waiting for a readable problem._",
    "",
    "## Similar practice",
    "_n/a — waiting for a readable problem._",
  ].join("\n");
}

async function unreadableAttachmentsStream(
  unreadable: UploadedAsset[],
): Promise<StreamingHandle> {
  const text = buildUnreadableAttachmentsMarkdown(unreadable);
  return {
    textStream: chunked(text),
    text: Promise.resolve(text),
  };
}
