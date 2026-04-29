import { streamChatResponse } from "@/lib/orchestrator";
import { analyzeUploadedImages } from "@/lib/vision";
import type { ChatRequest, UploadedAsset } from "@/types/education";

export const runtime = "nodejs";
export const maxDuration = 120;

type ChatRequestBody = Partial<ChatRequest>;

export async function POST(request: Request) {
  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.messages || body.messages.length === 0) {
    return Response.json({ error: "messages required" }, { status: 400 });
  }

  const incomingMessages = body.messages;

  const lastUser = incomingMessages.findLast((m) => m.role === "user");
  if (lastUser?.attachments?.length) {
    const analyzed = await analyzeUploadedImages(
      lastUser.attachments as UploadedAsset[],
    );
    const extractedText = analyzed
      .map((a) => a.extractedText)
      .filter(Boolean)
      .join("\n\n");
    if (extractedText) {
      lastUser.content = `${lastUser.content}\n\n[Attached image/document context]\n${extractedText}`;
    }
  }

  const handle = await streamChatResponse({
    messages: incomingMessages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    modelChoice: body.modelChoice ?? "auto",
    deepExplain: body.deepExplain ?? false,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of handle.textStream) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (error) {
        console.error("[chat] stream error:", error);
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
