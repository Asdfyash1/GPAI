/**
 * Telegram Bot API helper — uses a private channel with Topics as storage.
 *
 * Architecture:
 * - One pinned "registry" message in the General topic maps emailHash → { threadId, fileId }
 * - Each user gets a topic; their data is uploaded as a JSON file to that topic
 * - To read: getChat → pinned_message → registry → user's fileId → getFile → download
 * - To write: upload new file to topic → update registry with new fileId
 */

import crypto from "crypto";

const TOKENS = (process.env.TELEGRAM_BOT_TOKENS ?? "").split(",").filter(Boolean);
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID ?? "";

let botIdx = 0;
function nextToken(): string {
  if (TOKENS.length === 0) throw new Error("TELEGRAM_BOT_TOKENS not configured");
  return TOKENS[botIdx++ % TOKENS.length];
}

function apiUrl(method: string, token?: string): string {
  return `https://api.telegram.org/bot${token ?? nextToken()}/${method}`;
}

export function hashEmail(email: string): string {
  return crypto
    .createHash("sha256")
    .update(email.toLowerCase().trim())
    .digest("hex")
    .slice(0, 16);
}

// ── Registry ──

type RegistryEntry = { threadId: number; fileId?: string };
type Registry = Record<string, RegistryEntry>;

async function readRegistry(token: string): Promise<{ registry: Registry; msgId: number | null }> {
  const res = await fetch(apiUrl("getChat", token), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHANNEL_ID }),
  });
  if (!res.ok) return { registry: {}, msgId: null };

  const chat = (await res.json()) as {
    result: { pinned_message?: { message_id: number; text?: string; document?: { file_id: string } } };
  };
  const pinned = chat.result.pinned_message;
  if (!pinned) return { registry: {}, msgId: null };

  let raw = "";
  if (pinned.text?.startsWith("REG:")) {
    raw = pinned.text.slice(4);
  } else if (pinned.document) {
    raw = await downloadFile(pinned.document.file_id, token);
  }

  try {
    return { registry: JSON.parse(raw) as Registry, msgId: pinned.message_id };
  } catch {
    return { registry: {}, msgId: pinned.message_id };
  }
}

async function writeRegistry(registry: Registry, existingMsgId: number | null, token: string): Promise<void> {
  const json = JSON.stringify(registry);
  const text = `REG:${json}`;

  if (text.length <= 4096 && existingMsgId) {
    await fetch(apiUrl("editMessageText", token), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHANNEL_ID, message_id: existingMsgId, text }),
    });
    return;
  }

  // Send new message and pin it
  const sendRes = await fetch(apiUrl("sendMessage", token), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHANNEL_ID, text: text.length <= 4096 ? text : "REG:{}" }),
  });
  if (!sendRes.ok) throw new Error("Failed to send registry message");

  const sendData = (await sendRes.json()) as { result: { message_id: number } };
  await fetch(apiUrl("pinChatMessage", token), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHANNEL_ID, message_id: sendData.result.message_id, disable_notification: true }),
  });

  // If text was too long, edit via document approach (just truncate for now)
  if (text.length > 4096) {
    // For large registries (50+ users), we'd need a document-based approach.
    // For MVP, truncate old entries if needed.
    console.warn("Registry exceeds 4096 chars — consider migrating to document-based registry");
  }
}

// ── Topic management ──

export async function findOrCreateUserTopic(emailHash: string): Promise<number> {
  const token = nextToken();
  const { registry, msgId } = await readRegistry(token);

  const key = emailHash;
  if (registry[key]?.threadId) return registry[key].threadId;

  // Create new topic
  const res = await fetch(apiUrl("createForumTopic", token), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHANNEL_ID, name: `user:${emailHash}` }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to create topic: ${errText}`);
  }

  const topicData = (await res.json()) as { result: { message_thread_id: number } };
  const threadId = topicData.result.message_thread_id;

  registry[key] = { threadId };
  await writeRegistry(registry, msgId, token);

  return threadId;
}

// ── User data storage ──

export async function saveUserData(emailHash: string, data: Record<string, unknown>): Promise<void> {
  const token = nextToken();
  const { registry, msgId } = await readRegistry(token);

  const entry = registry[emailHash];
  if (!entry?.threadId) throw new Error("User topic not found — call findOrCreateUserTopic first");

  const json = JSON.stringify(data);
  const blob = new Blob([json], { type: "application/json" });

  const form = new FormData();
  form.append("chat_id", CHANNEL_ID);
  form.append("message_thread_id", entry.threadId.toString());
  form.append("document", blob, "userdata.json");

  const uploadRes = await fetch(apiUrl("sendDocument", token), { method: "POST", body: form });
  if (!uploadRes.ok) throw new Error("Failed to upload user data to Telegram");

  const uploadData = (await uploadRes.json()) as {
    result: { document?: { file_id: string } };
  };
  const fileId = uploadData.result.document?.file_id;
  if (fileId) {
    entry.fileId = fileId;
    await writeRegistry(registry, msgId, token);
  }
}

export async function loadUserData(emailHash: string): Promise<Record<string, unknown> | null> {
  const token = nextToken();
  const { registry } = await readRegistry(token);

  const entry = registry[emailHash];
  if (!entry?.fileId) return null;

  const json = await downloadFile(entry.fileId, token);
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ── File download helper ──

async function downloadFile(fileId: string, token: string): Promise<string> {
  const fileRes = await fetch(apiUrl("getFile", token), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fileId }),
  });
  if (!fileRes.ok) throw new Error("Failed to get file info from Telegram");

  const fileData = (await fileRes.json()) as { result: { file_path: string } };
  const downloadUrl = `https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`;

  const dlRes = await fetch(downloadUrl);
  if (!dlRes.ok) throw new Error("Failed to download file from Telegram");

  return dlRes.text();
}

// ── Check if user exists ──

export async function userExists(emailHash: string): Promise<boolean> {
  const token = nextToken();
  const { registry } = await readRegistry(token);
  return !!registry[emailHash]?.threadId;
}

// ── Shared content storage ──
// Uses a dedicated "shared:public" topic in the same channel.
// Each share is uploaded as a JSON file; the slug → fileId mapping
// is stored inside the user registry under a special "__shares" key.

type ShareRegistry = Record<string, string>; // slug → fileId

async function readShareRegistry(token: string): Promise<{ shares: ShareRegistry; registry: Registry; msgId: number | null }> {
  const { registry, msgId } = await readRegistry(token);
  const shares = (registry as Record<string, unknown>).__shares as ShareRegistry | undefined;
  return { shares: shares ?? {}, registry, msgId };
}

async function findOrCreateSharedTopic(token: string): Promise<number> {
  const { registry, msgId } = await readRegistry(token);
  const key = "__shared_topic";
  const existing = (registry as Record<string, unknown>)[key] as number | undefined;
  if (existing) return existing;

  const res = await fetch(apiUrl("createForumTopic", token), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHANNEL_ID, name: "shared:public" }),
  });
  if (!res.ok) throw new Error("Failed to create shared topic");

  const topicData = (await res.json()) as { result: { message_thread_id: number } };
  const threadId = topicData.result.message_thread_id;
  (registry as Record<string, unknown>)[key] = threadId;
  await writeRegistry(registry, msgId, token);
  return threadId;
}

export async function saveSharedData(
  slug: string,
  data: { type: "solve" | "chat"; title: string; payload: unknown },
): Promise<void> {
  const token = nextToken();
  const threadId = await findOrCreateSharedTopic(token);

  const json = JSON.stringify({ slug, ...data, sharedAt: new Date().toISOString() });
  const blob = new Blob([json], { type: "application/json" });

  const form = new FormData();
  form.append("chat_id", CHANNEL_ID);
  form.append("message_thread_id", threadId.toString());
  form.append("document", blob, `${slug}.json`);

  const uploadRes = await fetch(apiUrl("sendDocument", token), { method: "POST", body: form });
  if (!uploadRes.ok) throw new Error("Failed to upload shared data");

  const uploadData = (await uploadRes.json()) as {
    result: { document?: { file_id: string } };
  };
  const fileId = uploadData.result.document?.file_id;
  if (!fileId) throw new Error("No file_id returned from Telegram upload");

  // Store slug → fileId in registry under __shares
  const { registry, msgId } = await readRegistry(token);
  const shares = ((registry as Record<string, unknown>).__shares ?? {}) as ShareRegistry;
  shares[slug] = fileId;
  (registry as Record<string, unknown>).__shares = shares;
  await writeRegistry(registry, msgId, token);
}

export async function loadSharedData(slug: string): Promise<Record<string, unknown> | null> {
  const token = nextToken();
  const { shares } = await readShareRegistry(token);
  const fileId = shares[slug];
  if (!fileId) return null;

  const json = await downloadFile(fileId, token);
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}
