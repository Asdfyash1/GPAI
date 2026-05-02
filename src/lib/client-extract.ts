"use client";

/**
 * Browser-side PDF / text-file extraction helpers.
 *
 * Why this lives client-side:
 *
 * Vercel's serverless functions have a hard ~4.5 MB request-body limit.
 * Sending a PDF or large text file as a base64 `dataUrl` inside JSON
 * blows past that ceiling for any document over ~3.3 MB and the
 * function returns the opaque `FUNCTION_PAYLOAD_TOO_LARGE` error.
 *
 * By extracting the text in the browser before submission, we ship
 * only a few hundred KB of UTF-8 text to the API instead of the full
 * encoded document. The same `unpdf` package powers both the original
 * server route (`/api/parse-pdf`) and this client path.
 */

const MAX_EXTRACTED_CHARS = 200_000;

const TEXT_LIKE_EXTENSION = new Set([
  "txt",
  "md",
  "markdown",
  "csv",
  "tsv",
  "log",
  "json",
  "xml",
  "yaml",
  "yml",
  "html",
  "htm",
  "js",
  "jsx",
  "ts",
  "tsx",
  "py",
  "java",
  "c",
  "cpp",
  "cs",
  "go",
  "rs",
  "rb",
  "php",
  "swift",
  "kt",
  "sql",
]);

export function isPdfFile(file: File): boolean {
  return (
    file.type === "application/pdf" ||
    /\.pdf$/i.test(file.name || "")
  );
}

export function isTextLikeFile(file: File): boolean {
  const t = (file.type || "").toLowerCase();
  if (t.startsWith("text/")) return true;
  if (
    t === "application/json" ||
    t === "application/xml" ||
    t === "application/x-yaml"
  ) {
    return true;
  }
  const name = (file.name || "").toLowerCase();
  const dot = name.lastIndexOf(".");
  if (dot < 0) return false;
  return TEXT_LIKE_EXTENSION.has(name.slice(dot + 1));
}

export type PdfExtractResult = {
  text: string;
  pages: number;
  characters: number;
};

/**
 * Extract searchable text from a PDF entirely in the browser.
 *
 * Returns the merged page text truncated to `MAX_EXTRACTED_CHARS`. The
 * returned `characters` field is the **original** length so the caller
 * can show the user when their document was truncated.
 */
export async function extractPdfTextClient(
  file: File,
): Promise<PdfExtractResult> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocumentProxy(bytes);
  const { text, totalPages } = await extractText(pdf, { mergePages: true });
  const merged = (Array.isArray(text) ? text.join("\n\n") : text).trim();
  return {
    text: merged.slice(0, MAX_EXTRACTED_CHARS),
    pages: totalPages,
    characters: merged.length,
  };
}

export async function extractTextFileClient(file: File): Promise<string> {
  const text = await file.text();
  return text.slice(0, MAX_EXTRACTED_CHARS);
}

// ─────────────────────────────────────────────────────────────────────
// Scanned-PDF fallback: rasterize each page to a JPEG dataUrl.
// ─────────────────────────────────────────────────────────────────────
//
// Many "PDFs" — exam papers, lecture handouts, photographed textbook
// chapters — have no text layer at all. unpdf's text extractor returns
// an empty string in that case and the model can't help the user.
//
// When that happens, the Composer rasterizes each page to a JPEG dataUrl
// in the browser and pushes them as image attachments. The existing
// Nemotron vision OCR pipeline (lib/vision.ts) then transcribes each
// page individually — same code path that handles photographed
// homework problems today.
//
// Sizing constraints:
//
//   * Vercel serverless functions cap request bodies at ~4.5 MB. We aim
//     for ~3.5 MB total across all pages to leave headroom for the rest
//     of the JSON payload (messages, history, prompt).
//   * The Nemotron hosted endpoint stalls on inline images larger than
//     ~1.7 MB each — see MAX_INLINE_IMAGE_BYTES in lib/vision.ts. We
//     re-encode at scale 1.6 / quality 0.7 which keeps a typical
//     letter-sized scan around 150-300 KB.
//   * We hard-cap the number of pages so a 200-page textbook doesn't
//     produce a 200-call OCR storm. The user sees a "Sent first N of M
//     pages" hint in the Composer when truncation kicks in.

export const RASTER_DEFAULTS = {
  scale: 1.6,
  quality: 0.7,
  maxPages: 24,
  maxTotalBytes: 3_500_000,
};

export type RasterizedPage = {
  pageNumber: number;
  dataUrl: string;
};

export type RasterizeResult = {
  totalPages: number;
  pages: RasterizedPage[];
  /** True if not every page made it into `pages` (page-cap or byte-cap). */
  truncated: boolean;
};

export async function rasterizePdfToImagesClient(
  file: File,
  opts: Partial<typeof RASTER_DEFAULTS> = {},
): Promise<RasterizeResult> {
  if (typeof document === "undefined") {
    return { totalPages: 0, pages: [], truncated: false };
  }
  const { getDocumentProxy } = await import("unpdf");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocumentProxy(bytes);
  const totalPages = pdf.numPages;

  const scale = opts.scale ?? RASTER_DEFAULTS.scale;
  const quality = opts.quality ?? RASTER_DEFAULTS.quality;
  const pageCap = Math.min(totalPages, opts.maxPages ?? RASTER_DEFAULTS.maxPages);
  const byteCap = opts.maxTotalBytes ?? RASTER_DEFAULTS.maxTotalBytes;

  const pages: RasterizedPage[] = [];
  let totalBytes = 0;

  for (let p = 1; p <= pageCap; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    // White background so transparent regions in the PDF render as
    // white in the JPEG (instead of solid black, which OCR hates).
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (pages.length > 0 && totalBytes + dataUrl.length > byteCap) {
      // Stop adding pages — we've hit the byte budget. Keep the page
      // we just rendered out of the result so the body stays small.
      return { totalPages, pages, truncated: true };
    }
    totalBytes += dataUrl.length;
    pages.push({ pageNumber: p, dataUrl });
  }

  return { totalPages, pages, truncated: pages.length < totalPages };
}
