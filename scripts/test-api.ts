/**
 * Backend e2e test: send a real image to /api/educate/stream the same way
 * the browser Composer does, and stream the response to stdout.
 *
 * Usage:
 *   npx tsx scripts/test-api.ts <path-to-image> [base-url]
 *
 *   base-url defaults to http://localhost:3000
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

function inferMime(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".pdf") return "application/pdf";
  return "application/octet-stream";
}

async function main() {
  const filePath = process.argv[2];
  const baseUrl = process.argv[3] ?? "http://localhost:3000";
  if (!filePath) {
    console.error(
      "Usage: npx tsx scripts/test-api.ts <path-to-image> [base-url]",
    );
    process.exit(1);
  }

  const buf = await readFile(path.resolve(filePath));
  const mime = inferMime(filePath);
  const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;

  const body = {
    prompt: "Solve the equation in this image.",
    mode: "solver",
    audience: "Undergraduate",
    style: "Standard",
    crossCheck: false,
    modelChoice: "auto",
    attachments: [
      {
        name: path.basename(filePath),
        type: mime,
        size: buf.byteLength,
        dataUrl,
      },
    ],
  };

  console.log(`[test-api] POST ${baseUrl}/api/educate/stream`);
  console.log(`[test-api] image=${path.basename(filePath)} (${(buf.byteLength / 1024).toFixed(1)} KB)`);
  console.log("");

  const t0 = Date.now();
  const res = await fetch(`${baseUrl}/api/educate/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const ttfb = Date.now() - t0;
  console.log(`[test-api] HTTP ${res.status} (TTFB ${ttfb} ms)`);
  if (!res.ok) {
    console.error(`[test-api] body:`, await res.text());
    process.exit(2);
  }
  if (!res.body) {
    console.error(`[test-api] no body`);
    process.exit(3);
  }

  console.log("=".repeat(72));
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      const chunk = decoder.decode(value, { stream: true });
      process.stdout.write(chunk);
      total += chunk.length;
    }
  }
  console.log("\n" + "=".repeat(72));
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[test-api] streamed ${total} chars in ${elapsed}s`);
}

main().catch((err) => {
  console.error("[test-api] crashed:", err);
  process.exit(4);
});
