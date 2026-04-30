import type { UploadedAsset } from "@/types/education";

const visionBaseUrl = "https://integrate.api.nvidia.com/v1/chat/completions";
const visionModel = "mistralai/mistral-large-3-675b-instruct-2512";
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_PDF_BYTES = 25 * 1024 * 1024;
const MAX_TEXT_BYTES = 2 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 12_000;
const VISION_TIMEOUT_MS = 45_000;
const VISION_MAX_TOKENS = 1024;

/**
 * Marker prefix for any extractedText that represents a failure to read the
 * attachment. The prompt builder uses this to switch the model into
 * "don't hallucinate, ask the user to re-upload" mode.
 */
export const ATTACHMENT_FAILURE_PREFIX = "[ATTACHMENT_UNREADABLE]";

function failureText(reason: string): string {
  return `${ATTACHMENT_FAILURE_PREFIX} ${reason}`;
}

type VisionContent =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type VisionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: { message?: string };
};

function visionApiKey() {
  return (
    process.env.NVIDIA_VISION_API_KEY ??
    process.env.NVIDIA_IMAGE_TO_TEXT_API_KEY ??
    process.env.NVIDIA_API_KEY ??
    process.env.NIM_API_KEY
  );
}

async function describeImage(asset: UploadedAsset): Promise<string | undefined> {
  const key = visionApiKey();
  if (!key) return failureText("no vision API key configured on the server");
  if (!asset.dataUrl || !asset.type.startsWith("image/")) return undefined;

  if (asset.dataUrl.length > MAX_IMAGE_BYTES) {
    return failureText(
      "image too large for vision analysis — please upload a smaller image (under 20 MB; ideally a JPEG under 4 MB)",
    );
  }

  const content: VisionContent[] = [
    {
      type: "text",
      text:
        "Extract and explain every visible educational detail from this image. Transcribe all text, equations, labels, diagrams, units, and answer choices VERBATIM. Then summarize what problem the solver should answer. If the image is blurry, blank, or contains no recognizable academic content, say so explicitly — do NOT invent a problem.",
    },
    {
      type: "image_url",
      image_url: {
        url: asset.dataUrl,
      },
    },
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(visionBaseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.NVIDIA_VISION_MODEL ?? visionModel,
        messages: [{ role: "user", content }],
        max_tokens: VISION_MAX_TOKENS,
        temperature: 0.15,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
        stream: false,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if ((error as { name?: string })?.name === "AbortError") {
      throw new Error(
        `Vision API timed out after ${VISION_TIMEOUT_MS / 1000}s — image may be too large or NVIDIA is slow to respond`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const errorBody = (await response.json()) as VisionResponse;
      if (errorBody.error?.message) detail = errorBody.error.message;
    } catch {
      /* use statusText */
    }
    throw new Error(
      `Vision API returned ${response.status}: ${detail}`,
    );
  }

  const data = (await response.json()) as VisionResponse;
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("Vision API returned an empty response");
  }
  return text;
}

function bytesFromDataUrl(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",", 2)[1] ?? dataUrl;
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

function truncateExtracted(text: string): string {
  if (text.length <= MAX_EXTRACTED_CHARS) return text;
  return (
    text.slice(0, MAX_EXTRACTED_CHARS) +
    `\n\n[…document truncated for context — original length ${text.length.toLocaleString()} chars]`
  );
}

async function extractPdfText(asset: UploadedAsset): Promise<string> {
  if (!asset.dataUrl) return "[PDF missing data]";
  const bytes = bytesFromDataUrl(asset.dataUrl);
  if (bytes.byteLength === 0) return "[PDF was empty]";
  if (bytes.byteLength > MAX_PDF_BYTES) {
    return `[PDF too large for inline analysis (${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB > 25 MB) — please upload a smaller file]`;
  }
  // unpdf is the same library used by /api/parse-pdf; safe in serverless.
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  const merged = (Array.isArray(text) ? text.join("\n\n") : text).trim();
  if (!merged) return "[PDF contained no extractable text — likely scanned images]";
  return truncateExtracted(merged);
}

function extractTextFile(asset: UploadedAsset): string {
  if (!asset.dataUrl) return "[Text file missing data]";
  const bytes = bytesFromDataUrl(asset.dataUrl);
  if (bytes.byteLength === 0) return "[Text file was empty]";
  if (bytes.byteLength > MAX_TEXT_BYTES) {
    return `[Text file too large for inline analysis (${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB > 2 MB) — please upload a smaller file]`;
  }
  try {
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return truncateExtracted(decoded);
  } catch (error) {
    return `[Could not decode text file as UTF-8: ${error instanceof Error ? error.message : "unknown"}]`;
  }
}

function isTextLikeAsset(asset: UploadedAsset): boolean {
  const t = (asset.type || "").toLowerCase();
  const n = (asset.name || "").toLowerCase();
  if (t.startsWith("text/")) return true;
  if (t === "application/json" || t === "application/xml" || t === "application/x-yaml")
    return true;
  return /\.(txt|md|markdown|csv|tsv|log|json|xml|yaml|yml|html?|js|jsx|ts|tsx|py|java|c|cpp|cs|go|rs|rb|php|swift|kt|sql)$/.test(
    n,
  );
}

function isPdfAsset(asset: UploadedAsset): boolean {
  return (
    asset.type === "application/pdf" ||
    /\.pdf$/i.test(asset.name || "")
  );
}

/**
 * Backwards-compatible name; analyses every supported attachment and
 * fills in `extractedText`. Now handles:
 *   - images via the NVIDIA vision model
 *   - PDFs via unpdf
 *   - text-like files (txt / md / csv / json / source code) via UTF-8 decode
 */
export async function analyzeUploadedImages(attachments: UploadedAsset[]) {
  const analyzed: UploadedAsset[] = [];

  for (const asset of attachments) {
    if (asset.type.startsWith("image/") && asset.dataUrl) {
      try {
        const extractedText = await describeImage(asset);
        analyzed.push({ ...asset, extractedText, dataUrl: undefined });
      } catch (error) {
        console.error(`[vision] Failed to analyze ${asset.name}:`, error);
        analyzed.push({
          ...asset,
          extractedText: failureText(
            `image analysis failed for "${asset.name}": ${error instanceof Error ? error.message : "unknown error"}`,
          ),
          dataUrl: undefined,
        });
      }
      continue;
    }

    if (isPdfAsset(asset) && asset.dataUrl) {
      try {
        const extractedText = await extractPdfText(asset);
        analyzed.push({ ...asset, extractedText, dataUrl: undefined });
      } catch (error) {
        console.error(`[vision] Failed to parse PDF ${asset.name}:`, error);
        analyzed.push({
          ...asset,
          extractedText: failureText(
            `PDF parse failed for "${asset.name}": ${error instanceof Error ? error.message : "unknown error"}`,
          ),
          dataUrl: undefined,
        });
      }
      continue;
    }

    if (isTextLikeAsset(asset) && asset.dataUrl) {
      try {
        const extractedText = extractTextFile(asset);
        analyzed.push({ ...asset, extractedText, dataUrl: undefined });
      } catch (error) {
        analyzed.push({
          ...asset,
          extractedText: failureText(
            `text decode failed for "${asset.name}": ${error instanceof Error ? error.message : "unknown error"}`,
          ),
          dataUrl: undefined,
        });
      }
      continue;
    }

    // Unknown / unsupported — keep the asset metadata but make the
    // limitation explicit so the model knows it can't read this file.
    analyzed.push({
      ...asset,
      extractedText:
        asset.extractedText ??
        failureText(
          `file "${asset.name}" of type "${asset.type || "unknown"}" cannot be read server-side — please paste the relevant excerpt or convert to PDF / text`,
        ),
      dataUrl: undefined,
    });
  }

  return analyzed;
}
