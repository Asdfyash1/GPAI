"use client";

import "katex/dist/katex.min.css";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { MermaidBlock } from "@/components/MermaidBlock";

function normalizeMath(content: string) {
  return content
    .replaceAll("\\[", "$$")
    .replaceAll("\\]", "$$")
    .replaceAll("\\(", "$")
    .replaceAll("\\)", "$");
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
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code: CodeRenderer,
        }}
      >
        {normalizeMath(content)}
      </ReactMarkdown>
    </div>
  );
}
