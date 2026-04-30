/**
 * Backend test script for the multi-provider vision OCR chain.
 *
 * Usage:
 *   npx tsx scripts/test-vision.ts <path-to-image>
 *
 * Runs the same `analyzeUploadedImages()` that the API route uses, prints
 * the extracted text + which provider succeeded, and reports the failure
 * detail when no provider produces readable output.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { analyzeUploadedImages } from "../src/lib/vision";
import type { UploadedAsset } from "../src/types/education";

function inferMime(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".txt" || ext === ".md") return "text/plain";
  return "application/octet-stream";
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx tsx scripts/test-vision.ts <path-to-image>");
    process.exit(1);
  }

  const absPath = path.resolve(filePath);
  const buf = await readFile(absPath);
  const mime = inferMime(absPath);
  const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;

  const asset: UploadedAsset = {
    name: path.basename(absPath),
    type: mime,
    size: buf.byteLength,
    dataUrl,
  };

  console.log(
    `[test-vision] file=${asset.name} type=${asset.type} size=${(asset.size / 1024).toFixed(1)} KB`,
  );
  console.log(
    `[test-vision] providers configured:`,
    [
      process.env.NVIDIA_API_KEY || process.env.NIM_API_KEY ? "nvidia" : null,
      process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY ? "gemini" : null,
      "tesseract",
    ]
      .filter(Boolean)
      .join(", "),
  );
  console.log("");
  const t0 = Date.now();
  const [analyzed] = await analyzeUploadedImages([asset]);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  const text = analyzed?.extractedText ?? "";
  const isFailure = text.startsWith("[ATTACHMENT_UNREADABLE]");

  console.log("=".repeat(72));
  console.log(
    `[test-vision] ${isFailure ? "FAILED" : "OK"} after ${elapsed}s — ${text.length} chars`,
  );
  console.log("=".repeat(72));
  console.log(text);
  console.log("=".repeat(72));

  if (isFailure) process.exit(2);
  process.exit(0);
}

main().catch((err) => {
  console.error("[test-vision] crashed:", err);
  process.exit(3);
});
