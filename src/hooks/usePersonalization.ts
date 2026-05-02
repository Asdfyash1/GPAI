"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Personalization } from "@/types/education";

const STORAGE_KEY = "eduforge:personalization";
const OCCUPATION_LIMIT = 200;
const CUSTOM_INSTRUCTIONS_LIMIT = 10_000;

const EMPTY: Personalization = {
  occupation: "",
  customInstructions: "",
};

function clamp(value: string | undefined, max: number): string {
  return (value ?? "").slice(0, max);
}

function readFromStorage(): Personalization {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Personalization>;
    return {
      occupation: clamp(parsed.occupation, OCCUPATION_LIMIT),
      customInstructions: clamp(
        parsed.customInstructions,
        CUSTOM_INSTRUCTIONS_LIMIT,
      ),
    };
  } catch {
    return EMPTY;
  }
}

/**
 * `usePersonalization()` exposes the user's saved Settings → Personalize
 * preferences with a localStorage backing. Returns a stable `request`
 * value (suitable for spreading into `EducationRequest.personalization`)
 * that is `null` when both fields are empty so the API can detect "no
 * personalisation" without having to inspect strings.
 */
export function usePersonalization() {
  // We start with EMPTY for SSR safety, then hydrate from localStorage on
  // mount via a microtask (mirroring `EducationApp.tsx`'s persistence
  // pattern). The `hydrated` ref ensures we only persist back to disk
  // AFTER the hydrate completes, so we never wipe saved values with the
  // initial EMPTY state on first render.
  const [value, setValue] = useState<Personalization>(EMPTY);
  const hydrated = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    queueMicrotask(() => {
      const fromStorage = readFromStorage();
      hydrated.current = true;
      setValue(fromStorage);
    });
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      /* ignore quota errors */
    }
  }, [value]);

  const update = useCallback((patch: Partial<Personalization>) => {
    setValue((prev) => ({
      occupation: clamp(
        patch.occupation ?? prev.occupation,
        OCCUPATION_LIMIT,
      ),
      customInstructions: clamp(
        patch.customInstructions ?? prev.customInstructions,
        CUSTOM_INSTRUCTIONS_LIMIT,
      ),
    }));
  }, []);

  const reset = useCallback(() => {
    setValue(EMPTY);
  }, []);

  // The shape we hand to API requests: null when both fields are empty
  // so the orchestrator can short-circuit the personalisation block.
  const occupation = value.occupation?.trim() ?? "";
  const customInstructions = value.customInstructions?.trim() ?? "";
  const hasAny = occupation.length > 0 || customInstructions.length > 0;
  const request: Personalization | null = hasAny
    ? {
        occupation: occupation || undefined,
        customInstructions: customInstructions || undefined,
      }
    : null;

  return { value, update, reset, request, OCCUPATION_LIMIT, CUSTOM_INSTRUCTIONS_LIMIT };
}
