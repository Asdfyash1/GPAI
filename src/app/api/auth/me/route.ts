export const runtime = "nodejs";

import {
  createToken,
  getTokenFromRequest,
  sessionCookie,
  verifyTokenWithMeta,
} from "@/lib/auth";

// Sliding-session refresh: if the cookie is older than 6 days we mint
// a fresh 7-day token so an active user never gets bumped out at the
// boundary. Quiet (the cookie just gets refreshed via Set-Cookie).
const REFRESH_AFTER_S = 6 * 24 * 60 * 60;

export async function GET(request: Request) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return Response.json({ user: null });
  }

  const payload = await verifyTokenWithMeta(token);
  if (!payload) {
    return Response.json({ user: null });
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const nowS = Math.floor(Date.now() / 1000);
  if (typeof payload.iat === "number" && nowS - payload.iat > REFRESH_AFTER_S) {
    const fresh = await createToken({ email: payload.email, emailHash: payload.emailHash });
    headers["Set-Cookie"] = sessionCookie(fresh);
  }

  return new Response(
    JSON.stringify({
      user: {
        email: payload.email,
        emailHash: payload.emailHash,
      },
    }),
    { status: 200, headers },
  );
}
