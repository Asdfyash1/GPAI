"use client";

import { useCallback, useRef } from "react";

export function useTelemetry() {
  const queueRef = useRef<Array<{ event: string; props?: Record<string, unknown> }>>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    const batch = queueRef.current.splice(0);
    if (batch.length === 0) return;
    for (const item of batch) {
      navigator.sendBeacon(
        "/api/telemetry",
        new Blob([JSON.stringify(item)], { type: "application/json" }),
      );
    }
  }, []);

  const track = useCallback(
    (event: string, props?: Record<string, unknown>) => {
      queueRef.current.push({ event, props });
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, 2000);
    },
    [flush],
  );

  return { track };
}
