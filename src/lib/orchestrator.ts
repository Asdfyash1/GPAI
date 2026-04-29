import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import type { EducationRequest, VerificationSignal } from "@/types/education";
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

function selectedModel(choice: keyof typeof nvidiaModelRoutes) {
  if (choice === "demo") return "local-demo";
  const envName = `NVIDIA_MODEL_${choice.toUpperCase().replaceAll("-", "_")}`;
  return process.env[envName] ?? nvidiaModelRoutes[choice];
}

function configuredProviders() {
  const providers = [];

  if (process.env.NVIDIA_API_KEY || process.env.NIM_API_KEY) {
    providers.push({
      name: "NVIDIA NIM",
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
      baseURL: process.env.ADDITIONAL_OPENAI_COMPATIBLE_BASE_URL ?? "https://api.openai.com/v1",
      solverModel: process.env.ADDITIONAL_OPENAI_COMPATIBLE_MODEL ?? "gpt-4o-mini",
      verifierModel: process.env.ADDITIONAL_OPENAI_COMPATIBLE_MODEL ?? "gpt-4o-mini",
    });
  }

  return providers;
}

async function generateWithProvider(
  provider: ReturnType<typeof configuredProviders>[number],
  modelName: string,
  system: string,
  prompt: string,
) {
  const llm = createOpenAICompatible({
    name: provider.name.toLowerCase().replaceAll(" ", "-"),
    baseURL: provider.baseURL,
    headers: {
      Authorization: `Bearer ${provider.key}`,
    },
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const result = await generateText({
      model: llm.chatModel(modelName),
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
      notes: "No NVIDIA/API key configured; returned deterministic demo output with the same structure.",
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

  if (request.mode === "solver") {
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

  if (request.crossCheck) {
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
