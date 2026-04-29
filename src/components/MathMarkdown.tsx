"use client";

import "katex/dist/katex.min.css";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { MermaidBlock } from "@/components/MermaidBlock";

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

export function MathMarkdown({ content }: { content: string }) {
  return (
    <div className="math-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, REHYPE_KATEX_OPTIONS]]}
        components={{
          code: CodeRenderer,
        }}
      >
        {normalizeMath(content)}
      </ReactMarkdown>
    </div>
  );
}
