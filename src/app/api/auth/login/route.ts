export const runtime = "nodejs";

import { generateOTP } from "@/lib/auth";
import { sendOTPEmail } from "@/lib/email";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string };
  const email = body.email?.toLowerCase().trim();

  if (!email || !email.includes("@")) {
    return Response.json({ error: "Valid email is required." }, { status: 400 });
  }

  try {
    const code = generateOTP(email);
    await sendOTPEmail(email, code);
    return Response.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to send code";
    return Response.json({ error: msg }, { status: 429 });
  }
}
