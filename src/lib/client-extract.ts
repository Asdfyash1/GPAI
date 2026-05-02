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
