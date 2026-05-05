import { requireAuth } from "@/lib/api-guard";

export const maxDuration = 15;

/**
 * Block SSRF: reject URLs that resolve to private / internal IP ranges.
 * We check the hostname against known private patterns (RFC 1918, loopback,
 * link-local, and cloud metadata endpoints).
 */
function isInternalHost(hostname: string): boolean {
  const h = hostname.toLowerCase();

  if (
    h === "localhost" ||
    h === "[::1]" ||
    h.endsWith(".local") ||
    h.endsWith(".internal")
  ) {
    return true;
  }

  // Cloud metadata endpoints (AWS, GCP, Azure)
  if (h === "169.254.169.254" || h === "metadata.google.internal") {
    return true;
  }

  // IPv4 private ranges
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [, a, b] = ipv4.map(Number);
    if (a === 127) return true; // 127.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 169 && b === 254) return true; // 169.254.0.0/16
    if (a === 0) return true; // 0.0.0.0/8
  }

  return false;
}

export async function POST(request: Request) {
  const guard = await requireAuth(request);
  if (!guard.ok) return guard.response;

  let body: { url?: string };
  try {
    body = (await request.json()) as { url?: string };
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url) {
    return Response.json({ error: "url is required." }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return Response.json({ error: "Invalid URL." }, { status: 400 });
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return Response.json({ error: "Only http/https URLs." }, { status: 400 });
  }

  if (isInternalHost(parsed.hostname)) {
    return Response.json(
      { error: "Requests to internal/private addresses are not allowed." },
      { status: 403 },
    );
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ForgeBot/1.0; +https://forge.app)",
        Accept: "text/html, application/xhtml+xml, text/plain, */*",
      },
      redirect: "follow",
    });
    clearTimeout(timer);

    if (!res.ok) {
      return Response.json(
        { error: "Failed to fetch the URL." },
        { status: 502 },
      );
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (
      !contentType.includes("text/") &&
      !contentType.includes("application/json") &&
      !contentType.includes("application/xml") &&
      !contentType.includes("application/xhtml")
    ) {
      return Response.json(
        { error: "URL does not point to a text-based resource." },
        { status: 422 },
      );
    }

    const raw = await res.text();

    const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(raw);
    const title = titleMatch
      ? titleMatch[1].replace(/\s+/g, " ").trim()
      : parsed.hostname;

    let text = raw
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[\s\S]*?<\/header>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();

    const MAX_CHARS = 12_000;
    if (text.length > MAX_CHARS) {
      text = text.slice(0, MAX_CHARS) + "\n\n[Truncated — page too long]";
    }

    return Response.json({ title, text, url: parsed.href });
  } catch {
    return Response.json({ error: "Failed to fetch the URL." }, { status: 502 });
  }
}
