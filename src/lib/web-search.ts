export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
  source: "wikipedia" | "duckduckgo";
};

const USER_AGENT = "eduForge/0.1 (educational; contact: support@eduforge.local)";

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function searchWikipedia(query: string, limit: number): Promise<WebSearchResult[]> {
  const url =
    "https://en.wikipedia.org/w/rest.php/v1/search/page?q=" +
    encodeURIComponent(query) +
    "&limit=" +
    limit;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    pages?: Array<{
      key: string;
      title: string;
      description?: string | null;
      excerpt?: string | null;
    }>;
  };
  return (data.pages ?? []).slice(0, limit).map((p) => ({
    title: p.title,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(p.key)}`,
    snippet: stripHtml(p.excerpt ?? p.description ?? ""),
    source: "wikipedia" as const,
  }));
}

async function searchDuckDuckGo(query: string, limit: number): Promise<WebSearchResult[]> {
  const url =
    "https://api.duckduckgo.com/?format=json&no_html=1&skip_disambig=1&q=" +
    encodeURIComponent(query);
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      AbstractText?: string;
      AbstractURL?: string;
      Heading?: string;
      RelatedTopics?: Array<{
        Text?: string;
        FirstURL?: string;
        Topics?: Array<{ Text?: string; FirstURL?: string }>;
      }>;
    };
    const results: WebSearchResult[] = [];
    if (data.AbstractText && data.AbstractURL) {
      results.push({
        title: data.Heading ?? query,
        url: data.AbstractURL,
        snippet: stripHtml(data.AbstractText),
        source: "duckduckgo",
      });
    }
    const flatTopics: Array<{ Text?: string; FirstURL?: string }> = [];
    for (const t of data.RelatedTopics ?? []) {
      if (t.Text && t.FirstURL) flatTopics.push(t);
      if (t.Topics) flatTopics.push(...t.Topics);
    }
    for (const t of flatTopics) {
      if (results.length >= limit) break;
      if (!t.Text || !t.FirstURL) continue;
      results.push({
        title: t.Text.split(" - ")[0] ?? t.Text,
        url: t.FirstURL,
        snippet: stripHtml(t.Text),
        source: "duckduckgo",
      });
    }
    return results.slice(0, limit);
  } catch {
    return [];
  }
}

export async function searchWeb(
  query: string,
  limit = 5,
): Promise<WebSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const [wiki, ddg] = await Promise.all([
      searchWikipedia(q, limit).catch(() => [] as WebSearchResult[]),
      searchDuckDuckGo(q, limit).catch(() => [] as WebSearchResult[]),
    ]);
    const seen = new Set<string>();
    const merged: WebSearchResult[] = [];
    // Interleave: prefer DDG abstract first if present, then Wikipedia, then more DDG.
    const ordered = [...ddg.slice(0, 1), ...wiki, ...ddg.slice(1)];
    for (const r of ordered) {
      if (!r.url || seen.has(r.url)) continue;
      seen.add(r.url);
      merged.push(r);
      if (merged.length >= limit) break;
    }
    return merged;
  } catch (err) {
    console.error("[web-search] failed:", err);
    return [];
  }
}

export function formatWebContext(results: WebSearchResult[]): string {
  if (!results.length) return "";
  return results
    .map(
      (r, i) =>
        `[${i + 1}] ${r.title} (${r.source}) - ${r.url}\n${r.snippet || "(no snippet)"}`,
    )
    .join("\n\n");
}
