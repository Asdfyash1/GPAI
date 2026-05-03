"use client";

import { useEffect, useId, useRef, useState } from "react";

function currentTheme(): "dark" | "light" {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

const darkVars = {
  background: "transparent",
  primaryColor: "#1f2937",
  primaryBorderColor: "#374151",
  primaryTextColor: "#f9fafb",
  lineColor: "#94a3b8",
  fontFamily: "system-ui, -apple-system, sans-serif",
};

const lightVars = {
  background: "transparent",
  primaryColor: "#e5e7eb",
  primaryBorderColor: "#d1d5db",
  primaryTextColor: "#1a1a1a",
  lineColor: "#6b7280",
  fontFamily: "system-ui, -apple-system, sans-serif",
};

let mermaidMod: typeof import("mermaid")["default"] | null = null;

async function loadMermaid(theme: "dark" | "light") {
  if (!mermaidMod) {
    const m = await import("mermaid");
    mermaidMod = m.default;
  }
  mermaidMod.initialize({
    startOnLoad: false,
    theme: theme === "light" ? "default" : "dark",
    securityLevel: "loose",
    themeVariables: theme === "light" ? lightVars : darkVars,
  });
  return mermaidMod;
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
        const theme = currentTheme();
        const mermaid = await loadMermaid(theme);
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
