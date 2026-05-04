export const maxDuration = 15;

export async function POST(request: Request) {
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
        { error: `Fetch failed: HTTP ${res.status}` },
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fetch failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
