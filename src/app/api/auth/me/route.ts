export const runtime = "nodejs";

import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export async function GET(request: Request) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return Response.json({ user: null }, { status: 200 });
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return Response.json({ user: null }, { status: 200 });
  }

  return Response.json({
    user: {
      email: payload.email,
      emailHash: payload.emailHash,
    },
  });
}
