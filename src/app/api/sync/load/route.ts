export const runtime = "nodejs";

import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { loadUserData } from "@/lib/telegram";

export async function GET(request: Request) {
  const token = getTokenFromRequest(request);
  if (!token) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const session = await verifyToken(token);
  if (!session) return Response.json({ error: "Invalid session" }, { status: 401 });

  try {
    const data = await loadUserData(session.emailHash);
    return Response.json({ data: data ?? { chats: [], settings: {} } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Load failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}
