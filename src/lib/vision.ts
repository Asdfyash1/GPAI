import type { UploadedAsset } from "@/types/education";

const NVIDIA_VISION_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

// Nemotron-3-Nano Omni 30B is a multimodal reasoning model that handles
// handwritten math OCR far more accurately than the previous Llama-3.2 vision
// models (which confidently misread exponents/subscripts). This is the sole
// vision provider — no Gemini/Tesseract fallback chain needed.
const NVIDIA_DEFAULT_VISION_MODEL =
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_PDF_BYTES = 25 * 1024 * 1024;
const MAX_TEXT_BYTES = 2 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 12_000;
const VISION_TIMEOUT_MS = 60_000;
const VISION_MAX_TOKENS = 4096;

const VISION_PROMPT = [
  "You are an OCR engine for a STEM tutoring app. Look at the image and transcribe the academic content exactly as it appears on the page.",
  "",
  "Rules:",
  "- Transcribe verbatim. Preserve every superscript, subscript, operator, sign, parenthesis, and letter exactly as written.",
  "- Read handwritten math as carefully as printed math; do not simplify, factor, or 'fix' anything.",
  "- Use LaTeX for math.",
  "- After the transcription, on a new line, briefly state what the solver is asked to find (using only what is visible in the image).",
  "",
  "If the image is blank, blurry, low-contrast, contains no recognizable academic content, or you cannot make out the symbols, reply with EXACTLY one line and nothing else:",
  "  UNREADABLE: <short reason>",
  "",
  "Never invent equations or topics that are not literally on the page (no chemistry, biology, or any subject that is not visibly present). If you are uncertain, prefer 'UNREADABLE' over guessing.",
].join("\n");

const UNREADABLE_SENTINEL = /^\s*UNREADABLE\s*[:\-]/i;

/**
 * Marker prefix for any extractedText that represents a failure to read the
 * attachment. The orchestrator hard-stops on this prefix so the LLM can never
 * hallucinate a problem from missing OCR output.
 */
export const ATTACHMENT_FAILURE_PREFIX = "[ATTACHMENT_UNREADABLE]";

function failureText(reason: string): string {
  return `${ATTACHMENT_FAILURE_PREFIX} ${reason}`;
}

type ProviderResult =
  | { ok: true; text: string; provider: string }
  | { ok: false; error: string; provider: string };

type VisionContent =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type NvidiaVisionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

function nvidiaVisionApiKey(): string | undefined {
  return (
    process.env.NVIDIA_VISION_API_KEY ??
    process.env.NVIDIA_IMAGE_TO_TEXT_API_KEY ??
    process.env.NVIDIA_API_KEY ??
    process.env.NIM_API_KEY
  );
}

async function fetchJsonWithTimeout<T>(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      let detail = response.statusText;
      try {
        const body = await response.json();
        const maybeMessage =
          (body as { error?: { message?: string } })?.error?.message ??
          (typeof body === "string" ? body : undefined);
        if (maybeMessage) detail = String(maybeMessage);
      } catch {
        /* keep statusText */
      }
      return { ok: false, error: `HTTP ${response.status}: ${detail}` };
    }
    const data = (await response.json()) as T;
    return { ok: true, data };
  } catch (error) {
    if ((error as { name?: string })?.name === "AbortError") {
      return { ok: false, error: `timed out after ${timeoutMs / 1000}s` };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "unknown error",
    };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// NVIDIA NIM Vision (Nemotron-3-Nano Omni 30B Reasoning)
// ---------------------------------------------------------------------------

async function tryNvidiaModel(
  asset: UploadedAsset,
  key: string,
  modelName: string,
): Promise<ProviderResult> {
  const content: VisionContent[] = [
    { type: "text", text: VISION_PROMPT },
    { type: "image_url", image_url: { url: asset.dataUrl ?? "" } },
  ];

  const isReasoningModel =
    modelName.includes("reasoning") || modelName.includes("omni");

  const body: Record<string, unknown> = {
    model: modelName,
    messages: [{ role: "user", content }],
    max_tokens: VISION_MAX_TOKENS,
    temperature: 0.2,
    top_p: 0.95,
    stream: false,
  };

  if (isReasoningModel) {
    body.chat_template_kwargs = { enable_thinking: false };
    body.reasoning_budget = 16384;
  }

  const result = await fetchJsonWithTimeout<NvidiaVisionResponse>(
    NVIDIA_VISION_URL,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
    VISION_TIMEOUT_MS,
  );

  if (!result.ok) {
    return { ok: false, error: result.error, provider: `nvidia:${modelName}` };
  }
  const text = result.data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    return {
      ok: false,
      error: "empty response",
      provider: `nvidia:${modelName}`,
    };
  }
  if (UNREADABLE_SENTINEL.test(text)) {
    return {
      ok: false,
      error: `model says unreadable: ${text.replace(UNREADABLE_SENTINEL, "").trim().slice(0, 120)}`,
      provider: `nvidia:${modelName}`,
    };
  }
  return { ok: true, text, provider: `nvidia:${modelName}` };
}

// ---------------------------------------------------------------------------
// Top-level: NVIDIA-only vision with structured logging.
// ---------------------------------------------------------------------------

async function describeImage(asset: UploadedAsset): Promise<string> {
  if (!asset.dataUrl || !asset.type.startsWith("image/")) {
    return failureText("image had no data");
  }
  if (asset.dataUrl.length > MAX_IMAGE_BYTES) {
    return failureText(
      "image too large for vision analysis — please upload a smaller image (under 20 MB; ideally a JPEG under 4 MB)",
    );
  }

  const key = nvidiaVisionApiKey();
  if (!key) {
    return failureText(
      "no NVIDIA API key configured — set NVIDIA_API_KEY in environment variables",
    );
  }

  const modelName =
    process.env.NVIDIA_VISION_MODEL ?? NVIDIA_DEFAULT_VISION_MODEL;

  console.log(
    `[vision] describeImage called — model=${modelName}, ` +
    `imageType=${asset.type}, dataUrlLen=${asset.dataUrl.length}`,
  );

  const result = await tryNvidiaModel(asset, key, modelName);

  if (result.ok) {
    console.log(
      `[vision] accepted ${result.provider} (${result.text.length} chars): ` +
      `${result.text.slice(0, 200).replace(/\n/g, " ")}…`,
    );
    return result.text;
  }

  console.log(`[vision] rejected ${result.provider}: ${result.error}`);
  return failureText(`OCR failed → ${result.provider}: ${result.error}`);
}

// ---------------------------------------------------------------------------
// Non-image attachments.
// ---------------------------------------------------------------------------

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
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  const merged = (Array.isArray(text) ? text.join("\n\n") : text).trim();
  if (!merged) {
    return failureText(
      "PDF contained no extractable text — likely scanned images. Re-upload as PNG/JPG screenshots so vision OCR can run.",
    );
  }
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
    return failureText(
      `text decode failed for "${asset.name}": ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

function isTextLikeAsset(asset: UploadedAsset): boolean {
  const t = (asset.type || "").toLowerCase();
  const n = (asset.name || "").toLowerCase();
  if (t.startsWith("text/")) return true;
  if (
    t === "application/json" ||
    t === "application/xml" ||
    t === "application/x-yaml"
  )
    return true;
  return /\.(txt|md|markdown|csv|tsv|log|json|xml|yaml|yml|html?|js|jsx|ts|tsx|py|java|c|cpp|cs|go|rs|rb|php|swift|kt|sql)$/.test(
    n,
  );
}

function isPdfAsset(asset: UploadedAsset): boolean {
  return (
    asset.type === "application/pdf" || /\.pdf$/i.test(asset.name || "")
  );
}

/**
 * Analyses every supported attachment and fills in `extractedText`:
 *   - images via NVIDIA Nemotron-3-Nano Omni 30B Reasoning
 *   - PDFs via unpdf
 *   - text-like files (txt / md / csv / json / source code) via UTF-8 decode
 */
export async function analyzeUploadedImages(attachments: UploadedAsset[]) {
  const analyzed: UploadedAsset[] = [];

  console.log(`[vision] analyzeUploadedImages: ${attachments.length} attachment(s)`);
  for (const asset of attachments) {
    if (asset.type.startsWith("image/") && asset.dataUrl) {
      try {
        const extractedText = await describeImage(asset);
        console.log(
          `[vision] final extractedText for "${asset.name}" (${extractedText.length} chars): ${extractedText.slice(0, 300).replace(/\n/g, " ")}`,
        );
        analyzed.push({ ...asset, extractedText, dataUrl: undefined });
      } catch (error) {
        console.error(`[vision] Failed to analyze ${asset.name}:`, error);
        analyzed.push({
          ...asset,
          extractedText: failureText(
            `image analysis crashed for "${asset.name}": ${error instanceof Error ? error.message : "unknown error"}`,
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

export function attachmentIsUnreadable(text: string | undefined): boolean {
  return typeof text === "string" && text.startsWith(ATTACHMENT_FAILURE_PREFIX);
}

export function findUnreadableAttachments(
  attachments: UploadedAsset[],
): UploadedAsset[] {
  return attachments.filter((a) => attachmentIsUnreadable(a.extractedText));
}
