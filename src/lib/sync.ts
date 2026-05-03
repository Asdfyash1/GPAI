import type { ChatSession, EducationResponse } from "@/types/education";
import type { SidebarItem } from "@/components/Sidebar";

// Wire-format payload that goes between the browser and Telegram (via
// /api/sync/save and /api/sync/load). We snapshot exactly the same
// state shape that EducationApp persists to localStorage today, plus
// a `schema` version so future migrations have a hook.
export type SyncSnapshot = {
  schema: 1;
  history: SidebarItem[];
  responses: Record<string, EducationResponse>;
  chats: Record<string, ChatSession>;
  settings: { theme?: "dark" | "light" };
};

export function buildSnapshot(args: {
  history: SidebarItem[];
  responses: Record<string, EducationResponse>;
  chats: Record<string, ChatSession>;
  theme: "dark" | "light";
}): SyncSnapshot {
  // Trim history to the same 25-item cap localStorage uses so the
  // payload stays bounded as users solve more problems.
  const cappedHistory = args.history.slice(0, 25);
  const allowedIds = new Set(cappedHistory.map((h) => h.id));
  const responses: Record<string, EducationResponse> = {};
  for (const id of allowedIds) {
    if (args.responses[id]) responses[id] = args.responses[id];
  }
  const chats: Record<string, ChatSession> = {};
  for (const id of allowedIds) {
    if (args.chats[id]) chats[id] = args.chats[id];
  }
  return {
    schema: 1,
    history: cappedHistory,
    responses,
    chats,
    settings: { theme: args.theme },
  };
}

// Parse a Telegram-stored payload into a SyncSnapshot. We accept three
// shapes for backward compatibility:
//   1. The current schema (returned by buildSnapshot).
//   2. The legacy bootstrap shape that /api/auth/verify writes for
//      brand-new users: `{ profile, chats: [], settings: {} }`. We
//      treat that as "empty".
//   3. Anything malformed → return null.
export function parseSnapshot(raw: unknown): SyncSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as {
    schema?: number;
    history?: unknown;
    responses?: unknown;
    chats?: unknown;
    settings?: unknown;
  };
  // Legacy fresh-account placeholder where chats is an empty array.
  if (!Array.isArray(obj.history) && Array.isArray(obj.chats)) {
    return null;
  }
  if (!Array.isArray(obj.history)) return null;
  return {
    schema: 1,
    history: obj.history as SidebarItem[],
    responses:
      obj.responses && typeof obj.responses === "object" && !Array.isArray(obj.responses)
        ? (obj.responses as Record<string, EducationResponse>)
        : {},
    chats:
      obj.chats && typeof obj.chats === "object" && !Array.isArray(obj.chats)
        ? (obj.chats as Record<string, ChatSession>)
        : {},
    settings:
      obj.settings && typeof obj.settings === "object" && !Array.isArray(obj.settings)
        ? (obj.settings as { theme?: "dark" | "light" })
        : {},
  };
}

export function isEmptySnapshot(s: { history: SidebarItem[] } | null | undefined): boolean {
  return !s || !Array.isArray(s.history) || s.history.length === 0;
}
