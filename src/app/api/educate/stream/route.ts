import { streamEducationalSolverDraft } from "@/lib/orchestrator";
import { analyzeUploadedImages } from "@/lib/vision";
import { parseModelResponse } from "@/lib/response-parser";
import { STRUCTURED_TAIL_SENTINEL } from "@/lib/streaming-protocol";
import type {
  EducationRequest,
  EducationResponse,
  VerificationSignal,
} from "@/types/education";

export const runtime = "nodejs";
export const maxDuration = 120;

function isValidMode(mode: unknown) {
  return (
    mode === "solver" ||
    mode === "visualizer" ||
    mode === "chat" ||
    mode === "cheatsheet"
  );
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

  const attachments = await analyzeUploadedImages(body.attachments ?? []);

  const fullRequest: EducationRequest = {
    mode: body.mode!,
    prompt: body.prompt,
    style: body.style ?? "step-by-step",
    audience: body.audience ?? "high-school to early college",
    attachments,
    crossCheck: body.crossCheck ?? true,
    modelChoice: body.modelChoice ?? "auto",
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let aggregated = "";
      try {
        const handle = await streamEducationalSolverDraft(fullRequest);
        for await (const chunk of handle.textStream) {
          aggregated += chunk;
          controller.enqueue(encoder.encode(chunk));
        }

        const verification: VerificationSignal[] = [
          {
            model: "Cloud",
            role: "solver",
            status: "complete",
            notes: "Streamed primary draft to the client in real time.",
          },
        ];
        const parsed: EducationResponse = parseModelResponse(
          aggregated,
          fullRequest,
          verification,
        );

        controller.enqueue(encoder.encode(STRUCTURED_TAIL_SENTINEL));
        controller.enqueue(encoder.encode(JSON.stringify(parsed)));
        controller.close();
      } catch (error) {
        console.error("[educate/stream] error:", error);
        const message =
          error instanceof Error ? error.message : "Streaming failed.";
        controller.enqueue(encoder.encode(`\n\n[Error: ${message}]`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
