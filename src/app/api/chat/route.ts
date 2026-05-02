import { streamChatResponse } from "@/lib/orchestrator";
import { analyzeUploadedImages } from "@/lib/vision";
import { formatWebContext, searchWeb } from "@/lib/web-search";
import type { SearchResult } from "@/lib/web-search";
import type { ChatRequest, UploadedAsset } from "@/types/education";

export const runtime = "nodejs";
export const maxDuration = 60;

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

  let webContext: string | undefined;
  let webResults: SearchResult[] = [];
  if (body.webEnabled && lastUser?.content) {
    try {
      webResults = await searchWeb(lastUser.content, 5);
      if (webResults.length > 0) {
        webContext = formatWebContext(webResults);
      }
    } catch (err) {
      console.error("[chat] web search failed:", err);
    }
  }

  const buildHandle = (modelChoice: ChatRequest["modelChoice"]) =>
    streamChatResponse({
      messages: incomingMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      modelChoice,
      deepExplain: body.deepExplain ?? false,
      webContext,
      personalization: body.personalization,
    });

  const encoder = new TextEncoder();

  // If we have web results, append them as a JSON trailer after the text stream
  // so the client can parse and render Sources pills.
  const sourcesTrailer =
    webResults.length > 0
      ? "\n\n<!-- SOURCES:" + JSON.stringify(webResults) + ":SOURCES -->"
      : "";

  const stream = new ReadableStream({
    async start(controller) {
      const tryStream = async (
        modelChoice: ChatRequest["modelChoice"],
      ): Promise<{ ok: boolean; chunks: number; error?: unknown }> => {
        let chunks = 0;
        try {
          const handle = await buildHandle(modelChoice);
          for await (const chunk of handle.textStream) {
            chunks++;
            controller.enqueue(encoder.encode(chunk));
          }
          return { ok: true, chunks };
        } catch (error) {
          return { ok: false, chunks, error };
        }
      };

      const primary = await tryStream(body.modelChoice ?? "auto");
      if (primary.ok) {
        if (sourcesTrailer) {
          controller.enqueue(encoder.encode(sourcesTrailer));
        }
        controller.close();
        return;
      }

      // Real-model call failed (quota, 5xx, network). If we never streamed
      // a single chunk, silently fall back to the offline demo so the user
      // still gets *something* useful instead of a broken bubble.
      console.error("[chat] primary stream failed:", primary.error);
      if (primary.chunks === 0) {
        controller.enqueue(
          encoder.encode(
            "_(Live model is unavailable right now — falling back to a local demo answer.)_\n\n",
          ),
        );
        const fallback = await tryStream("demo");
        if (fallback.ok) {
          if (sourcesTrailer) {
            controller.enqueue(encoder.encode(sourcesTrailer));
          }
          controller.close();
          return;
        }
      }
      const message =
        primary.error instanceof Error
          ? primary.error.message
          : "Streaming failed.";
      controller.enqueue(encoder.encode(`\n\n[Error: ${message}]`));
      controller.close();
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
