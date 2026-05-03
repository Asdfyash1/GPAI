"use client";

import { useEffect, useRef } from "react";
import type { SyncSnapshot } from "@/lib/sync";

// Debounce window for the auto-save: every state change kicks the
// timer; the actual POST runs once activity quiets down. 5s matches
// the spec in BACKLOG.md "Telegram Auth + Storage Plan" so a user
// rapidly editing their prompt or typing into chat doesn't generate
// a save on every keystroke.
const DEBOUNCE_MS = 5000;

type Status = "idle" | "saving" | "saved" | "error";

type UseSyncArgs = {
  // Off when no user is signed in OR while we're still loading the
  // remote snapshot (so we don't push an empty / stale local payload
  // over real cloud data on login).
  enabled: boolean;
  snapshot: SyncSnapshot;
  onStatusChange?: (status: Status, err?: Error) => void;
};

// Auto-saves the given snapshot to /api/sync/save with a 5-second
// debounce. Only runs while `enabled` is true. On failure, the most
// recent payload stays pending so the next state change re-triggers
// the debounce and we get another shot.
export function useSync({ enabled, snapshot, onStatusChange }: UseSyncArgs): void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<string>("");
  const inflight = useRef<Promise<void> | null>(null);
  const status = useRef<Status>("idle");

  // Stringify once per render — JSON.stringify on the snapshot is
  // also our equality check, so dependent state is stable when the
  // user is just hovering / scrolling without changing data.
  const serialized = JSON.stringify(snapshot);

  useEffect(() => {
    if (!enabled) return;
    if (serialized === lastSaved.current) return;
    if (timer.current) clearTimeout(timer.current);

    timer.current = setTimeout(async () => {
      // Wait for any in-flight save to finish before launching the
      // next one — otherwise two POSTs can race on Telegram and the
      // older one wins, losing the newer state.
      if (inflight.current) {
        try {
          await inflight.current;
        } catch {
          /* prior save error already surfaced; we'll attempt a fresh save below */
        }
      }
      const payloadToSend = serialized;
      status.current = "saving";
      onStatusChange?.("saving");
      const send = (async () => {
        try {
          const res = await fetch("/api/sync/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: JSON.parse(payloadToSend) as SyncSnapshot }),
          });
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(`save failed: ${res.status} ${text}`);
          }
          lastSaved.current = payloadToSend;
          status.current = "saved";
          onStatusChange?.("saved");
        } catch (err) {
          // Leave lastSaved.current alone so the next change retries.
          // Spec calls this the "offline retry queue" — implicit via
          // dirty-state comparison rather than an explicit list.
          status.current = "error";
          onStatusChange?.("error", err instanceof Error ? err : new Error(String(err)));
        }
      })();
      inflight.current = send;
      try {
        await send;
      } finally {
        if (inflight.current === send) inflight.current = null;
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [enabled, serialized, onStatusChange]);
}
