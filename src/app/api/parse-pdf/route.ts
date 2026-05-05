import { extractText, getDocumentProxy } from "unpdf";
import { requireAuth } from "@/lib/api-guard";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const guard = await requireAuth(request, { maxBodyBytes: 10 * 1024 * 1024 });
  if (!guard.ok) return guard.response;
  const contentType = request.headers.get("content-type") ?? "";
  let bytes: Uint8Array;
  let filename = "document.pdf";

  if (contentType.startsWith("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }
    filename = file.name || filename;
    bytes = new Uint8Array(await file.arrayBuffer());
  } else if (contentType.startsWith("application/json")) {
    const body = (await request.json()) as { dataUrl?: string; name?: string };
    if (!body.dataUrl) {
      return Response.json({ error: "Missing dataUrl" }, { status: 400 });
    }
    if (body.name) filename = body.name;
    const base64 = body.dataUrl.split(",", 2)[1] ?? body.dataUrl;
    bytes = Uint8Array.from(Buffer.from(base64, "base64"));
  } else {
    bytes = new Uint8Array(await request.arrayBuffer());
  }

  if (bytes.byteLength === 0) {
    return Response.json({ error: "Empty PDF" }, { status: 400 });
  }

  try {
    const pdf = await getDocumentProxy(bytes);
    const { text, totalPages } = await extractText(pdf, { mergePages: true });
    const merged = Array.isArray(text) ? text.join("\n\n") : text;
    return Response.json({
      filename,
      pages: totalPages,
      characters: merged.length,
      text: merged.slice(0, 200_000),
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to parse the PDF.",
      },
      { status: 500 },
    );
  }
}
