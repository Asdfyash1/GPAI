"use client";

import type { CSSProperties } from "react";

/**
 * Friendly short-name + initial + colour for a model identifier.
 * Drives the small avatar circles next to the "Cross-checked" badge and
 * the composer's cross-check indicator pill — mirrors gpai.app's two-avatar
 * visual under "Cross-check with [icons]".
 */
export function modelDisplay(model: string | undefined): {
  initial: string;
  short: string;
  bg: string;
} {
  const m = (model ?? "").toLowerCase();
  if (m.includes("nemotron")) {
    return { initial: "N", short: "Nemotron", bg: "#76b900" };
  }
  if (m.includes("mistral")) {
    return { initial: "M", short: "Mistral", bg: "#e85d2c" };
  }
  if (m.includes("deepseek")) {
    return { initial: "D", short: "DeepSeek", bg: "#4a7cf6" };
  }
  if (m.includes("llama")) {
    return { initial: "L", short: "Llama", bg: "#1877f2" };
  }
  if (m.includes("gemini") || m.includes("gemma")) {
    return { initial: "G", short: "Gemini", bg: "#1a73e8" };
  }
  if (m.includes("gpt") || m.includes("openai")) {
    return { initial: "O", short: "OpenAI", bg: "#10a37f" };
  }
  if (m.includes("demo") || m.includes("local")) {
    return { initial: "•", short: "Demo", bg: "#94a3b8" };
  }
  // First alpha char fallback.
  const first = (model ?? "?").trim().match(/[A-Za-z]/)?.[0] ?? "?";
  return {
    initial: first.toUpperCase(),
    short: model ?? "model",
    bg: "#64748b",
  };
}

type ModelAvatarsProps = {
  primary: string | undefined;
  secondary?: string | undefined;
  size?: number;
  /** Visual class hook so callers can layer their own styles. */
  className?: string;
  style?: CSSProperties;
};

export function ModelAvatars({
  primary,
  secondary,
  size = 18,
  className,
  style,
}: ModelAvatarsProps) {
  const a = modelDisplay(primary);
  const b = secondary ? modelDisplay(secondary) : null;
  const dim: CSSProperties = {
    width: size,
    height: size,
    fontSize: Math.max(9, Math.round(size * 0.55)),
  };
  return (
    <span
      className={`cross-checked-avatars${className ? ` ${className}` : ""}`}
      aria-hidden="true"
      style={style}
    >
      <span
        className="cross-checked-avatar"
        style={{ ...dim, background: a.bg }}
      >
        {a.initial}
      </span>
      {b && (
        <span
          className="cross-checked-avatar"
          style={{ ...dim, background: b.bg }}
        >
          {b.initial}
        </span>
      )}
    </span>
  );
}
