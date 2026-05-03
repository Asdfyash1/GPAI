import type { GlossaryEntry } from "@/types/education";

/**
 * Extract glossary entries from a raw markdown blob.
 *
 * Used by `<MathMarkdown>` as an auto-detect fallback so any view
 * whose content carries a `## Glossary` heading (Cheatsheet, PDF
 * Notes, Document, Notebook) gets inline term highlighting for free
 * — without each view needing to plumb `glossary` through manually.
 *
 * Mirrors `parseGlossarySection` in `src/lib/response-parser.ts` but
 * lives here so the parsing rules stay co-located with the
 * rendering-side anchor injector.
 */
export function parseGlossaryFromMarkdown(markdown: string): GlossaryEntry[] {
  const headingRe = new RegExp(
    `^#{1,3}\\s*Glossary[^\\n]*\\n([\\s\\S]*?)(?=^#{1,3}\\s|$)`,
    "im",
  );
  const match = headingRe.exec(markdown);
  if (!match) return [];
  return parseGlossaryLines(match[1].trim());
}

function parseGlossaryLines(section: string): GlossaryEntry[] {
  if (!section) return [];
  const out: GlossaryEntry[] = [];
  const seen = new Set<string>();

  for (const rawLine of section.split("\n")) {
    const line = rawLine
      .replace(/^[-*•]\s*/, "")
      .replace(/^\d+[.)]\s*/, "")
      .trim();
    if (!line) continue;

    const m = /^(.+?)\s*(?:—|–|--|-\s|:\s)\s*(.+)$/.exec(line);
    if (!m) continue;

    const term = m[1]
      .trim()
      .replace(/^\*\*(.*)\*\*$/, "$1")
      .replace(/^["'`](.*)["'`]$/, "$1")
      .trim();
    const definition = m[2]
      .trim()
      .replace(/^\*\*(.*)\*\*$/, "$1")
      .replace(/[.,;:!?]$/, "")
      .trim();

    if (term.length < 2 || term.length > 60) continue;
    if (!/^[A-Za-z0-9][A-Za-z0-9 \-']{0,58}[A-Za-z0-9]$/.test(term)) continue;
    if (term.split(/\s+/).length > 4) continue;
    if (definition.length < 4 || definition.length > 240) continue;

    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ term, definition: definition + (/[.!?]$/.test(definition) ? "" : ".") });
    if (out.length >= 12) break;
  }

  return out;
}

/**
 * Inject glossary anchors into a markdown string so the renderer can
 * light up term occurrences with `<GlossaryTerm>` overlays.
 *
 * Strategy:
 * - Walk the source text segment-by-segment, skipping anything that is
 *   not plain prose: code fences (```...```), inline code (`...`),
 *   display math ($$...$$), inline math ($...$), HTML tags, existing
 *   markdown links ([..](..)), and the heading lines themselves.
 * - In the remaining plain-text segments, replace the FIRST occurrence
 *   of each glossary term (case-insensitive, word-bounded) with the
 *   markdown link `[<term>](#glossary-<idx>)`. Subsequent occurrences
 *   are left untouched so the page isn't a sea of orange.
 * - We also skip term replacements inside the `## Glossary` section
 *   itself — the glossary list is the source-of-truth, not a candidate
 *   for self-linkification.
 *
 * The `#glossary-<idx>` anchor is read by `MathMarkdown`'s overridden
 * `a` renderer (or by any consumer that wants to resolve a term back to
 * its `GlossaryEntry`).
 */
export function injectGlossaryAnchors(
  markdown: string,
  glossary: GlossaryEntry[] | undefined,
): string {
  if (!glossary || glossary.length === 0) return markdown;

  // Strip the entire `## Glossary` section out of the search space so
  // we don't auto-link the term inside its own definition list. We'll
  // splice it back in at the end. Match conservatively — the renderer
  // is happy if `## Glossary` shows up as a heading; we just don't want
  // to wrap its bullets.
  const glossaryHeadingRe = /(^|\n)(#{1,3})\s*Glossary[^\n]*\n/i;
  const headMatch = glossaryHeadingRe.exec(markdown);
  let beforeGlossary = markdown;
  let glossaryAndAfter = "";
  if (headMatch) {
    const idx = headMatch.index + headMatch[1].length;
    beforeGlossary = markdown.slice(0, idx);
    glossaryAndAfter = markdown.slice(idx);
  }

  // Tokenize the prose into protected segments + replaceable text. The
  // protected list is greedy-aligned to longest-match so display math
  // wins over inline math, fences win over backticks, etc.
  const protectedRe = new RegExp(
    [
      "```[\\s\\S]*?```", // code fence
      "`[^`\\n]+`", // inline code
      "\\$\\$[\\s\\S]*?\\$\\$", // display math
      "\\$[^$\\n]+\\$", // inline math
      "\\\\\\[[\\s\\S]*?\\\\\\]", // \[ ... \] display math (escaped)
      "\\\\\\([\\s\\S]*?\\\\\\)", // \( ... \) inline math (escaped)
      "<[^>]+>", // raw HTML tags
      "!\\[[^\\]]*\\]\\([^)]*\\)", // image
      "\\[[^\\]]*\\]\\([^)]*\\)", // existing link
      "^#{1,6}\\s[^\\n]*", // heading line (anchored to LF or BOF)
    ].join("|"),
    "gm",
  );

  // Walk the text, alternating protected runs and replaceable runs.
  const usedTerms = new Set<number>();
  let cursor = 0;
  let out = "";
  let m: RegExpExecArray | null;
  while ((m = protectedRe.exec(beforeGlossary)) !== null) {
    out += replaceTerms(
      beforeGlossary.slice(cursor, m.index),
      glossary,
      usedTerms,
    );
    out += m[0];
    cursor = m.index + m[0].length;
  }
  out += replaceTerms(beforeGlossary.slice(cursor), glossary, usedTerms);

  return out + glossaryAndAfter;
}

function replaceTerms(
  text: string,
  glossary: GlossaryEntry[],
  usedTerms: Set<number>,
): string {
  if (!text) return text;
  let result = text;
  for (let i = 0; i < glossary.length; i++) {
    if (usedTerms.has(i)) continue;
    const term = glossary[i].term;
    if (!term) continue;
    // Word-boundary, case-insensitive, but preserve the original casing
    // in the rendered output. Escape regex specials in the term.
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b(${escaped})\\b`, "i");
    const hit = re.exec(result);
    if (!hit) continue;
    const before = result.slice(0, hit.index);
    const after = result.slice(hit.index + hit[0].length);
    // Keep the user-facing string identical to what the model wrote.
    result = `${before}[${hit[0]}](#glossary-${i})${after}`;
    usedTerms.add(i);
  }
  return result;
}
