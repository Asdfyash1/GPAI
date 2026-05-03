"use client";

import "katex/dist/katex.min.css";
import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { GlossaryTerm } from "@/components/GlossaryTerm";
import { MermaidBlock } from "@/components/MermaidBlock";
import {
  injectGlossaryAnchors,
  parseGlossaryFromMarkdown,
} from "@/lib/glossary-markdown";
import type { GlossaryEntry } from "@/types/education";

const KATEX_MACROS = {
  "\\R": "\\mathbb{R}",
  "\\N": "\\mathbb{N}",
  "\\Z": "\\mathbb{Z}",
  "\\Q": "\\mathbb{Q}",
  "\\C": "\\mathbb{C}",
  "\\E": "\\mathbb{E}",
  "\\d": "\\mathrm{d}",
  "\\ohm": "\\Omega",
  "\\degree": "^{\\circ}",
  "\\celsius": "^{\\circ}\\mathrm{C}",
  "\\vec": "\\overrightarrow",
  "\\hat": "\\widehat",
  "\\diff": "\\frac{d#1}{d#2}",
};

const REHYPE_KATEX_OPTIONS = {
  output: "html" as const,
  throwOnError: false,
  errorColor: "#f97316",
  strict: false as const,
  trust: true,
  macros: KATEX_MACROS,
};

const MULTI_LINE_ENVS = [
  "align",
  "align\\*",
  "aligned",
  "equation",
  "equation\\*",
  "gather",
  "gather\\*",
  "multline",
  "multline\\*",
  "cases",
  "matrix",
  "pmatrix",
  "bmatrix",
  "vmatrix",
  "Bmatrix",
  "Vmatrix",
];

function normalizeMath(content: string) {
  let text = content;

  // Convert \[ ... \] (display) and \( ... \) (inline) to $$ ... $$ / $ ... $
  // Use [\s\S] to match across newlines and non-greedy.
  text = text.replace(/\\\[([\s\S]+?)\\\]/g, (_m, inner) => `$$${inner}$$`);
  text = text.replace(/\\\(([\s\S]+?)\\\)/g, (_m, inner) => `$${inner}$`);

  // Wrap bare LaTeX environments in $$...$$ if not already inside math.
  // We'll do a simple pass: find \begin{env} ... \end{env} blocks that aren't
  // already preceded by `$$` and wrap them.
  for (const env of MULTI_LINE_ENVS) {
    const re = new RegExp(
      `(?<!\\$)\\\\begin\\{${env}\\}([\\s\\S]+?)\\\\end\\{${env}\\}(?!\\$)`,
      "g",
    );
    text = text.replace(
      re,
      (_m, inner) => `$$\n\\begin{${env.replace("\\*", "*")}}${inner}\\end{${env.replace("\\*", "*")}}\n$$`,
    );
  }

  return text;
}

type CodeProps = {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
};

function CodeRenderer({ inline, className, children, ...rest }: CodeProps) {
  const text = String(children ?? "");
  const match = /language-(\w+)/.exec(className ?? "");
  const lang = match?.[1];
  if (!inline && lang === "mermaid") {
    return <MermaidBlock code={text.replace(/\n$/, "")} />;
  }
  return (
    <code className={className} {...rest}>
      {children}
    </code>
  );
}

type AnchorProps = {
  href?: string;
  children?: React.ReactNode;
};

/**
 * Build the `a` renderer used by ReactMarkdown.
 *
 * If the link target is a `#glossary-<idx>` anchor, render a
 * `<GlossaryTerm>` overlay (orange underline + tooltip + ask-AI). For
 * any other URL fall through to a normal external `<a>` that opens in
 * a new tab.
 */
function makeAnchorRenderer(
  glossary: GlossaryEntry[] | undefined,
  onAskAbout: ((entry: GlossaryEntry) => void) | undefined,
) {
  return function AnchorRenderer({ href, children, ...rest }: AnchorProps) {
    if (href && glossary && glossary.length > 0) {
      const m = /^#glossary-(\d+)$/.exec(href);
      if (m) {
        const idx = Number(m[1]);
        const entry = glossary[idx];
        if (entry) {
          return (
            <GlossaryTerm entry={entry} onAsk={onAskAbout}>
              {children}
            </GlossaryTerm>
          );
        }
      }
    }
    return (
      <a
        href={href}
        target={href?.startsWith("http") ? "_blank" : undefined}
        rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
        {...rest}
      >
        {children}
      </a>
    );
  };
}

type MathMarkdownProps = {
  content: string;
  /**
   * Optional inline glossary. When supplied, the renderer overrides
   * `a[href="#glossary-<idx>"]` anchors with `<GlossaryTerm>` overlays.
   * The anchors themselves are produced upstream by
   * `injectGlossaryAnchors()` in `src/lib/glossary-markdown.ts`.
   */
  glossary?: GlossaryEntry[];
  /** Callback when the user clicks "Ask AI about this" on a term. */
  onAskGlossary?: (entry: GlossaryEntry) => void;
};

export function MathMarkdown({
  content,
  glossary,
  onAskGlossary,
}: MathMarkdownProps) {
  // If a glossary wasn't passed in, try to auto-detect one from a
  // `## Glossary` section inside `content`. This means any view whose
  // markdown carries a glossary section (Cheatsheet, PDF Notes,
  // Document, Notebook) gets inline term highlighting for free without
  // having to plumb `glossary` props through manually.
  //
  // SolverView passes `glossary` explicitly because its `result.solution`
  // sometimes feeds in mid-stream (no glossary yet) — the explicit
  // prop is the safer source of truth there.
  const effectiveGlossary = useMemo<GlossaryEntry[] | undefined>(() => {
    if (glossary && glossary.length > 0) return glossary;
    const auto = parseGlossaryFromMarkdown(content);
    return auto.length > 0 ? auto : undefined;
  }, [glossary, content]);

  // Anchor-inject only when we actually have a glossary; this keeps the
  // rendered markdown byte-identical for the common case of empty
  // glossary (no perf cost, no risk of regressing the markdown).
  const renderedContent = useMemo(() => {
    if (!effectiveGlossary) return content;
    return injectGlossaryAnchors(content, effectiveGlossary);
  }, [content, effectiveGlossary]);

  return (
    <div className="math-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, REHYPE_KATEX_OPTIONS]]}
        components={{
          code: CodeRenderer,
          a: makeAnchorRenderer(effectiveGlossary, onAskGlossary),
        }}
      >
        {normalizeMath(renderedContent)}
      </ReactMarkdown>
    </div>
  );
}
