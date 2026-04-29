import { runEducationalOrchestrator } from "@/lib/orchestrator";
import { analyzeUploadedImages } from "@/lib/vision";
import type { EducationRequest } from "@/types/education";

export const runtime = "nodejs";
export const maxDuration = 60;

function isValidMode(mode: unknown) {
  return mode === "solver" || mode === "visualizer" || mode === "chat" || mode === "cheatsheet";
}

export async function POST(request: Request) {
  let body: Partial<EducationRequest>;
  try {
    body = (await request.json()) as Partial<EducationRequest>;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.prompt || !isValidMode(body.mode)) {
    return Response.json(
      { error: "A prompt and valid mode are required." },
      { status: 400 },
    );
  }

  try {
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
  } catch (error) {
    console.error("[educate] Orchestrator error:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while generating the response.",
      },
      { status: 500 },
    );
  }
}
