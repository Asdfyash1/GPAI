import { runEducationalOrchestrator } from "@/lib/orchestrator";
import { analyzeUploadedImages } from "@/lib/vision";
import type { EducationRequest } from "@/types/education";

export const runtime = "nodejs";

function isValidMode(mode: unknown) {
  return mode === "solver" || mode === "visualizer" || mode === "chat" || mode === "cheatsheet";
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<EducationRequest>;

  if (!body.prompt || !isValidMode(body.mode)) {
    return Response.json(
      { error: "A prompt and valid mode are required." },
      { status: 400 },
    );
  }

  const attachments = await analyzeUploadedImages(body.attachments ?? []);

  const response = await runEducationalOrchestrator({
    mode: body.mode,
    prompt: body.prompt,
    style: body.style ?? "step-by-step",
    audience: body.audience ?? "high-school to early college",
    attachments,
    crossCheck: body.crossCheck ?? true,
    modelChoice: body.modelChoice ?? "auto",
  });

  return Response.json(response);
}
