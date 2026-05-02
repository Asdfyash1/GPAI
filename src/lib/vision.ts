import type { UploadedAsset } from "@/types/education";

const NVIDIA_VISION_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const GEMINI_VISION_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

// Default vision model on NVIDIA NIM. The previous default
// (`mistralai/mistral-large-3-675b-instruct-2512`) does not exist in NIM's
// catalog — calling it 404'd silently and forced the LLM to hallucinate a
// problem from no transcription. Llama-3.2-90B Vision is the proven
// vision-language model on NIM and handles handwritten math reliably.
// 11B is the primary because 90B is consistently slow on NVIDIA's free NIM
// tier (we observed >40s timeouts in every test run). 90B is kept as a
// fallback in case it becomes responsive. For the most reliable handwritten
// math OCR, configure GEMINI_API_KEY — Gemini 2.0 Flash has a free tier and
// is dramatically more accurate on subtle exponents/subscripts.
const NVIDIA_DEFAULT_VISION_MODEL = "meta/llama-3.2-11b-vision-instruct";
const NVIDIA_FALLBACK_VISION_MODEL = "meta/llama-3.2-90b-vision-instruct";
const GEMINI_DEFAULT_VISION_MODEL = "gemini-2.0-flash";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_PDF_BYTES = 25 * 1024 * 1024;
const MAX_TEXT_BYTES = 2 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 12_000;
// Per-attempt timeout for cloud vision providers. Tight enough that we move
// to the next provider quickly when one is hung; loose enough to give the
// 90B fallback a real chance (it's slower than 11B). Tesseract.js gets its
// own (longer) timeout because the WASM model is slow.
const VISION_TIMEOUT_MS = 40_000;
const VISION_MAX_TOKENS = 1024;
const TESSERACT_TIMEOUT_MS = 30_000;

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

type GeminiVisionResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
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

function geminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
}

function isVisionDebug(): boolean {
  return process.env.VISION_DEBUG === "1" || process.env.NODE_ENV !== "production";
}

function logDebug(message: string, extra?: unknown) {
  if (!isVisionDebug()) return;
  if (extra !== undefined) {
    console.log(`[vision] ${message}`, extra);
  } else {
    console.log(`[vision] ${message}`);
  }
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
// Provider 1: NVIDIA NIM Vision (Llama-3.2-90B Vision by default)
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

  const result = await fetchJsonWithTimeout<NvidiaVisionResponse>(
    NVIDIA_VISION_URL,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: "user", content }],
        max_tokens: VISION_MAX_TOKENS,
        temperature: 0,
        top_p: 1,
        stream: false,
      }),
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

async function tryNvidia(asset: UploadedAsset): Promise<ProviderResult | null> {
  const key = nvidiaVisionApiKey();
  if (!key) return null;

  const primary = process.env.NVIDIA_VISION_MODEL ?? NVIDIA_DEFAULT_VISION_MODEL;
  const fallback =
    process.env.NVIDIA_VISION_FALLBACK_MODEL ?? NVIDIA_FALLBACK_VISION_MODEL;

  const first = await tryNvidiaModel(asset, key, primary);
  if (first.ok) return first;
  logDebug(`NVIDIA primary (${primary}) failed: ${first.error}`);

  if (fallback && fallback !== primary) {
    const second = await tryNvidiaModel(asset, key, fallback);
    if (second.ok) return second;
    logDebug(`NVIDIA fallback (${fallback}) failed: ${second.error}`);
    return second;
  }

  return first;
}

// ---------------------------------------------------------------------------
// Provider 2: Google Gemini 2.0 Flash (free tier)
// ---------------------------------------------------------------------------

function dataUrlToInline(dataUrl: string):
  | { mimeType: string; data: string }
  | null {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

async function tryGemini(asset: UploadedAsset): Promise<ProviderResult | null> {
  const key = geminiApiKey();
  if (!key) return null;
  const inline = asset.dataUrl ? dataUrlToInline(asset.dataUrl) : null;
  if (!inline) {
    return {
      ok: false,
      error: "data URL was not base64-encoded",
      provider: "gemini",
    };
  }

  const modelName =
    process.env.GEMINI_VISION_MODEL ?? GEMINI_DEFAULT_VISION_MODEL;
  const url = `${GEMINI_VISION_URL}/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(key)}`;

  const result = await fetchJsonWithTimeout<GeminiVisionResponse>(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: VISION_PROMPT },
              { inlineData: { mimeType: inline.mimeType, data: inline.data } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.15,
          maxOutputTokens: VISION_MAX_TOKENS,
        },
      }),
    },
    VISION_TIMEOUT_MS,
  );

  if (!result.ok) {
    return { ok: false, error: result.error, provider: `gemini:${modelName}` };
  }
  const text = result.data.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("\n")
    .trim();
  if (!text) {
    return {
      ok: false,
      error: "empty response",
      provider: `gemini:${modelName}`,
    };
  }
  if (UNREADABLE_SENTINEL.test(text)) {
    return {
      ok: false,
      error: `model says unreadable: ${text.replace(UNREADABLE_SENTINEL, "").trim().slice(0, 120)}`,
      provider: `gemini:${modelName}`,
    };
  }
  return { ok: true, text, provider: `gemini:${modelName}` };
}

// ---------------------------------------------------------------------------
// Provider 3: Tesseract.js (free, offline OCR — no API key required)
// ---------------------------------------------------------------------------

async function tryTesseract(asset: UploadedAsset): Promise<ProviderResult> {
  if (!asset.dataUrl) {
    return { ok: false, error: "no data URL", provider: "tesseract" };
  }
  const bytes = bytesFromDataUrl(asset.dataUrl);
  if (bytes.byteLength === 0) {
    return { ok: false, error: "image is empty", provider: "tesseract" };
  }
  const buffer = Buffer.from(bytes);

  try {
    // Lazy-import keeps the WASM blob off the happy path's cold start.
    // tesseract.js v7 exposes `recognize` as a named export under ESM,
    // but when bundled as CommonJS (Node default for our scripts) it lives
    // on `.default`. Handle both shapes.
    const mod = (await import("tesseract.js")) as unknown as {
      recognize?: (
        image: unknown,
        lang?: string,
        opts?: { logger?: (m: unknown) => void },
      ) => Promise<{ data: { text?: string } }>;
      default?: {
        recognize?: (
          image: unknown,
          lang?: string,
          opts?: { logger?: (m: unknown) => void },
        ) => Promise<{ data: { text?: string } }>;
      };
    };
    const recognize = mod.recognize ?? mod.default?.recognize;
    if (typeof recognize !== "function") {
      return {
        ok: false,
        error: "tesseract.js recognize() is not available",
        provider: "tesseract",
      };
    }

    // tesseract.js does NOT accept an AbortSignal for single-call
    // `recognize()`, so an AbortController would be inert. We race the
    // recognition against a timeout so the caller gets a timely failure
    // instead of hanging the serverless function. The WASM computation
    // itself cannot be cancelled — it will still run to completion on the
    // worker and eventually be GC'd, but we unblock the fallback chain
    // and the HTTP response well before maxDuration.
    //
    // The timer handle is cleared in a finally block so the Node event
    // loop doesn't stay alive for the full TESSERACT_TIMEOUT_MS after
    // recognition wins the race (matters on Vercel billing and for the
    // standalone test scripts in scripts/).
    const recognition = recognize(buffer, "eng", { logger: () => {} });
    let timerId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timerId = setTimeout(
        () =>
          reject(
            new Error(
              `tesseract timed out after ${TESSERACT_TIMEOUT_MS / 1000}s`,
            ),
          ),
        TESSERACT_TIMEOUT_MS,
      );
    });
    let raceResult: { data: { text?: string } };
    try {
      raceResult = await Promise.race([recognition, timeout]);
    } finally {
      if (timerId !== undefined) clearTimeout(timerId);
    }
    const { data } = raceResult;
    const text = (data?.text ?? "").trim();
    if (!text) {
      return {
        ok: false,
        error: "no readable text",
        provider: "tesseract",
      };
    }
    return {
      ok: true,
      text:
        "Tesseract OCR transcript (text-only, no AI interpretation):\n\n" +
        text,
      provider: "tesseract",
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "unknown error",
      provider: "tesseract",
    };
  }
}

// ---------------------------------------------------------------------------
// Top-level: try all providers in order, first ok wins.
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

  const hasGeminiKey = !!geminiApiKey();
  const hasNvidiaKey = !!nvidiaVisionApiKey();
  console.log(
    `[vision] describeImage called — geminiKey=${hasGeminiKey}, nvidiaKey=${hasNvidiaKey}, ` +
    `order=${hasGeminiKey ? "gemini→nvidia→tesseract" : "nvidia→gemini→tesseract"}, ` +
    `imageType=${asset.type}, dataUrlLen=${asset.dataUrl.length}`,
  );

  const errors: string[] = [];

  // Provider ordering: Gemini 2.0 Flash is dramatically more accurate on
  // handwritten math than NIM's free-tier Llama-3.2-11B-Vision (NIM 11B
  // frequently misreads subtle exponents/subscripts and returns confidently
  // wrong transcripts — which this chain would previously accept on the first
  // `ok: true` and never try Gemini at all). So when GEMINI_API_KEY is
  // configured, prefer Gemini as the primary provider and keep NVIDIA as the
  // fallback. This only affects which provider runs first; the "first ok
  // wins" semantics are unchanged. Tesseract.js is always the last resort.
  const providers: Array<() => Promise<ProviderResult | null>> = geminiApiKey()
    ? [
        () => tryGemini(asset),
        () => tryNvidia(asset),
        () => tryTesseract(asset),
      ]
    : [
        () => tryNvidia(asset),
        () => tryGemini(asset),
        () => tryTesseract(asset),
      ];

  for (let idx = 0; idx < providers.length; idx++) {
    const run = providers[idx];
    console.log(`[vision] attempting provider ${idx + 1}/${providers.length}`);
    let result: ProviderResult | null;
    try {
      result = await run();
    } catch (error) {
      result = {
        ok: false,
        error: error instanceof Error ? error.message : "unknown",
        provider: "unknown",
      };
    }
    if (!result) {
      console.log(`[vision] provider ${idx + 1} skipped (not configured)`);
      continue;
    }
    if (result.ok) {
      console.log(
        `[vision] accepted ${result.provider} (${result.text.length} chars): ${result.text.slice(0, 200).replace(/\n/g, " ")}…`,
      );
      return result.text;
    }
    errors.push(`${result.provider}: ${result.error}`);
    console.log(`[vision] rejected ${result.provider}: ${result.error}`);
  }

  return failureText(
    errors.length > 0
      ? `all OCR providers failed → ${errors.join(" | ")}`
      : "no OCR provider configured (set NVIDIA_API_KEY and/or GEMINI_API_KEY, or rely on Tesseract.js — but the image was unreadable to Tesseract too)",
  );
}

// ---------------------------------------------------------------------------
// Non-image attachments (unchanged from before).
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
 * Backwards-compatible name; analyses every supported attachment and
 * fills in `extractedText`. Now handles:
 *   - images via the multi-provider OCR chain (NVIDIA → Gemini → Tesseract.js)
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
