"use client";

import { useCallback, useRef, useState } from "react";
import { STRUCTURED_TAIL_SENTINEL } from "@/lib/streaming-protocol";

export type StreamState = {
  text: string;
  isStreaming: boolean;
  error: string | null;
};

export type StreamHandlers<TFinal> = {
  onChunk?: (textSoFar: string, chunk: string) => void;
  onFinal?: (finalText: string, structured: TFinal | null) => void;
  onError?: (message: string) => void;
};

export function useStream<TFinal = unknown>() {
  const [state, setState] = useState<StreamState>({
    text: "",
    isStreaming: false,
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setState({ text: "", isStreaming: false, error: null });
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState((prev) => ({ ...prev, isStreaming: false }));
  }, []);

  const start = useCallback(
    async (
      url: string,
      body: unknown,
      handlers: StreamHandlers<TFinal> = {},
    ) => {
      stop();
      const controller = new AbortController();
      abortRef.current = controller;
      setState({ text: "", isStreaming: true, error: null });

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          let message = response.statusText || `Request failed (${response.status})`;
          try {
            const ct = response.headers.get("content-type") ?? "";
            if (ct.includes("application/json")) {
              const json = (await response.json()) as { error?: string };
              if (json?.error) message = json.error;
            } else {
              const text = await response.text();
              if (text) message = text;
            }
          } catch {
            /* keep statusText */
          }
          throw new Error(message);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          setState((prev) => {
            const visible = stripStructuredTail(buffer);
            handlers.onChunk?.(visible, chunk);
            return { ...prev, text: visible };
          });
        }

        const sentinelIndex = buffer.indexOf(STRUCTURED_TAIL_SENTINEL);
        let finalText = buffer;
        let structured: TFinal | null = null;
        if (sentinelIndex >= 0) {
          finalText = buffer.slice(0, sentinelIndex);
          const tail = buffer
            .slice(sentinelIndex + STRUCTURED_TAIL_SENTINEL.length)
            .trim();
          if (tail.length > 0) {
            try {
              structured = JSON.parse(tail) as TFinal;
            } catch {
              structured = null;
            }
          }
        }

        setState({ text: finalText, isStreaming: false, error: null });
        handlers.onFinal?.(finalText, structured);
      } catch (error) {
        if (controller.signal.aborted) {
          setState((prev) => ({ ...prev, isStreaming: false }));
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        setState({ text: "", isStreaming: false, error: message });
        handlers.onError?.(message);
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [stop],
  );

  return { ...state, start, stop, reset };
}

function stripStructuredTail(s: string) {
  const idx = s.indexOf(STRUCTURED_TAIL_SENTINEL);
  return idx < 0 ? s : s.slice(0, idx);
}
