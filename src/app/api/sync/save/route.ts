export const runtime = "nodejs";

import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { saveUserData } from "@/lib/telegram";

export async function POST(request: Request) {
  const token = getTokenFromRequest(request);
  if (!token) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const session = await verifyToken(token);
  if (!session) return Response.json({ error: "Invalid session" }, { status: 401 });

  const body = (await request.json()) as { data: Record<string, unknown> };
  if (!body.data) return Response.json({ error: "Data is required" }, { status: 400 });

  try {
    await saveUserData(session.emailHash, body.data);
    return Response.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Save failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}
