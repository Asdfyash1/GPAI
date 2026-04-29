"use client";

import { useEffect, useId, useRef, useState } from "react";

let mermaidPromise: Promise<typeof import("mermaid")["default"]> | null = null;

async function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((m) => {
      m.default.initialize({
        startOnLoad: false,
        theme: "dark",
        securityLevel: "loose",
        themeVariables: {
          background: "transparent",
          primaryColor: "#1f2937",
          primaryBorderColor: "#374151",
          primaryTextColor: "#f9fafb",
          lineColor: "#94a3b8",
          fontFamily: "system-ui, -apple-system, sans-serif",
        },
      });
      return m.default;
    });
  }
  return mermaidPromise;
}

export function MermaidBlock({ code }: { code: string }) {
  const reactId = useId();
  const id = `mmd-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = await loadMermaid();
        const { svg: out } = await mermaid.render(id, code.trim());
        if (!cancelled) {
          setSvg(out);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Failed to render diagram",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, id]);

  if (error) {
    return (
      <pre className="mermaid-error">
        <code>{code}</code>
        <span className="error-text">{error}</span>
      </pre>
    );
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-block"
      dangerouslySetInnerHTML={{ __html: svg || "" }}
    />
  );
}
