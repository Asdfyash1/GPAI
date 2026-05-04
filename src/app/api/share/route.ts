import crypto from "crypto";
import { saveSharedData } from "@/lib/telegram";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export const maxDuration = 30;

export async function POST(request: Request) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }
  const session = await verifyToken(token);
  if (!session) {
    return Response.json({ error: "Invalid session" }, { status: 401 });
  }

  const body = (await request.json()) as {
    type?: "solve" | "chat";
    title?: string;
    payload?: unknown;
  };

  if (!body.type || !body.payload) {
    return Response.json({ error: "Missing type or payload" }, { status: 400 });
  }

  const slug = crypto.randomBytes(6).toString("base64url");

  try {
    await saveSharedData(slug, {
      type: body.type,
      title: body.title ?? "Shared from Forge",
      payload: body.payload,
    });
  } catch (err) {
    console.error("Share save failed:", err);
    return Response.json({ error: "Failed to save share" }, { status: 500 });
  }

  return Response.json({ ok: true, slug, url: `/s/${slug}` });
}
