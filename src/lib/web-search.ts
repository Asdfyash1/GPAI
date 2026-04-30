export type SearchResultSource = "wikipedia" | "ddg-ia" | "ddg-serp" | "page";

export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  source: SearchResultSource;
};

/** @deprecated – kept for backwards-compat; new code should use SearchResult */
export type WebSearchResult = SearchResult;

const USER_AGENT =
  "Forge/0.1 (educational; contact: support@forge.local)";

const SOURCE_TIMEOUT_MS = 4_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function canonicalKey(url: string): string {
  try {
    const u = new URL(url);
    return (u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/+$/, "")).toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/** Fetch a URL, strip tags, return the first 300 chars from the first <p>. */
async function fetchPageSnippet(url: string): Promise<string> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), SOURCE_TIMEOUT_MS);
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html",
      },
      signal: ctrl.signal,
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return "";
    const html = await res.text();
    const pMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    if (!pMatch) return "";
    const text = stripHtml(pMatch[1]);
    return text.slice(0, 300);
  } catch {
    return "";
  }
}

/** Wrap a promise with a per-source timeout that resolves to [] on expiry. */
function withTimeout<T>(p: Promise<T[]>, ms: number): Promise<T[]> {
  return Promise.race([
    p,
    new Promise<T[]>((resolve) => setTimeout(() => resolve([]), ms)),
  ]);
}

// ---------------------------------------------------------------------------
// Individual sources
// ---------------------------------------------------------------------------

async function searchWikipedia(query: string): Promise<SearchResult[]> {
  // Step 1: search for page titles via MediaWiki action API
  const searchUrl =
    "https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srsearch=" +
    encodeURIComponent(query) +
    "&srlimit=3";
  const res = await fetch(searchUrl, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    query?: {
      search?: Array<{ title: string; snippet?: string }>;
    };
  };
  const pages = data.query?.search ?? [];
  if (pages.length === 0) return [];

  // Step 2: fetch REST summaries in parallel for each title
  const summaries = await Promise.allSettled(
    pages.map(async (p) => {
      const title = encodeURIComponent(p.title.replace(/ /g, "_"));
      const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`;
      const r = await fetch(summaryUrl, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      });
      if (!r.ok) return null;
      const s = (await r.json()) as {
        title?: string;
        extract?: string;
        content_urls?: { desktop?: { page?: string } };
      };
      return {
        title: s.title ?? p.title,
        url:
          s.content_urls?.desktop?.page ??
          `https://en.wikipedia.org/wiki/${title}`,
        snippet: (s.extract ?? stripHtml(p.snippet ?? "")).slice(0, 300),
        source: "wikipedia" as const,
      };
    }),
  );

  const out: SearchResult[] = [];
  for (const r of summaries) {
    if (r.status === "fulfilled" && r.value !== null) {
      out.push(r.value);
    }
  }
  return out;
}

async function searchDuckDuckGoIA(query: string): Promise<SearchResult[]> {
  const url =
    "https://api.duckduckgo.com/?format=json&no_html=1&skip_disambig=1&q=" +
    encodeURIComponent(query);
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
  const results: SearchResult[] = [];
  if (data.AbstractText && data.AbstractURL) {
    results.push({
      title: data.Heading ?? query,
      url: data.AbstractURL,
      snippet: stripHtml(data.AbstractText).slice(0, 300),
      source: "ddg-ia",
    });
  }
  const flatTopics: Array<{ Text?: string; FirstURL?: string }> = [];
  for (const t of data.RelatedTopics ?? []) {
    if (t.Text && t.FirstURL) flatTopics.push(t);
    if (t.Topics) flatTopics.push(...t.Topics);
  }
  for (const t of flatTopics) {
    if (results.length >= 3) break;
    if (!t.Text || !t.FirstURL) continue;
    results.push({
      title: t.Text.split(" - ")[0] ?? t.Text,
      url: t.FirstURL,
      snippet: stripHtml(t.Text).slice(0, 300),
      source: "ddg-ia",
    });
  }
  return results;
}

async function searchDuckDuckGoSERP(query: string): Promise<SearchResult[]> {
  const url =
    "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query);
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      Accept: "text/html",
    },
  });
  if (!res.ok) return [];
  const html = await res.text();

  const linkRe =
    /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetRe =
    /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  const links: Array<{ url: string; title: string }> = [];
  const snippets: string[] = [];
  let m: RegExpExecArray | null;

  while ((m = linkRe.exec(html)) && links.length < 10) {
    let href = m[1];
    const uddg = href.match(/uddg=([^&]+)/);
    if (uddg) {
      try {
        href = decodeURIComponent(uddg[1]);
      } catch {
        /* leave href as-is */
      }
    }
    links.push({ url: href, title: stripHtml(m[2]) });
  }
  while ((m = snippetRe.exec(html)) && snippets.length < links.length) {
    snippets.push(stripHtml(m[1]));
  }

  const serpResults: SearchResult[] = [];
  for (let i = 0; i < links.length && serpResults.length < 5; i++) {
    const { url: linkUrl, title } = links[i];
    if (!linkUrl || !title) continue;
    if (
      /(^https?:\/\/duckduckgo\.com\/y\.js)|(^https?:\/\/duckduckgo\.com\/\?)/.test(
        linkUrl,
      )
    )
      continue;
    serpResults.push({
      title,
      url: linkUrl,
      snippet: snippets[i] ?? "",
      source: "ddg-serp",
    });
  }

  // Enrich top SERP results with actual page snippets
  const enriched = await Promise.allSettled(
    serpResults.map(async (r) => {
      if (r.snippet && r.snippet.length > 80) return r; // already decent
      const pageSnippet = await fetchPageSnippet(r.url);
      if (pageSnippet) {
        return { ...r, snippet: pageSnippet, source: "page" as const };
      }
      return r;
    }),
  );

  return enriched
    .filter(
      (r): r is PromiseFulfilledResult<SearchResult> =>
        r.status === "fulfilled",
    )
    .map((r) => r.value);
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

const SOURCE_RANK: Record<SearchResultSource, number> = {
  wikipedia: 0,
  "ddg-ia": 1,
  page: 2,
  "ddg-serp": 3,
};

// ---------------------------------------------------------------------------
// Main search entry point
// ---------------------------------------------------------------------------

export async function searchWeb(
  query: string,
  limit = 5,
): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  try {
    const [wikiResults, ddgIaResults, ddgSerpResults] =
      await Promise.allSettled([
        withTimeout(searchWikipedia(q), SOURCE_TIMEOUT_MS),
        withTimeout(searchDuckDuckGoIA(q), SOURCE_TIMEOUT_MS),
        withTimeout(searchDuckDuckGoSERP(q), SOURCE_TIMEOUT_MS),
      ]);

    const all: SearchResult[] = [
      ...(wikiResults.status === "fulfilled" ? wikiResults.value : []),
      ...(ddgIaResults.status === "fulfilled" ? ddgIaResults.value : []),
      ...(ddgSerpResults.status === "fulfilled" ? ddgSerpResults.value : []),
    ];

    // Dedupe by canonical host+path
    const seen = new Set<string>();
    const deduped: SearchResult[] = [];
    for (const r of all) {
      const key = canonicalKey(r.url);
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(r);
    }

    // Rank: wikipedia > ddg-ia > page > ddg-serp
    deduped.sort((a, b) => SOURCE_RANK[a.source] - SOURCE_RANK[b.source]);

    return deduped.slice(0, limit);
  } catch (err) {
    console.error("[web-search] failed:", err);
    return [];
  }
}

export function formatWebContext(results: SearchResult[]): string {
  if (!results.length) return "";
  return (
    "Use these sources to answer. Cite them inline as [1], [2], ... using the numbers below.\n" +
    results
      .map((r, i) => `[${i + 1}] (${r.url}) ${r.title} -- ${r.snippet || "(no snippet)"}`)
      .join("\n") +
    "\nCite at least one source from the list above when the answer relies on it. If the question is unrelated to STEM facts, you may answer without citation."
  );
}
