export const runtime = "nodejs";

import { verifyPassword, createToken, sessionCookie } from "@/lib/auth";
import { hashEmail, loadUserData } from "@/lib/telegram";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string };
  const email = body.email?.toLowerCase().trim();
  const password = body.password;

  if (!email || !email.includes("@")) {
    return Response.json({ error: "Valid email is required." }, { status: 400 });
  }
  if (!password) {
    return Response.json({ error: "Password is required." }, { status: 400 });
  }

  const emailHash = hashEmail(email);

  try {
    const userData = await loadUserData(emailHash);
    if (!userData) {
      return Response.json({ error: "No account found. Please sign up first." }, { status: 401 });
    }

    const storedHash = (userData as Record<string, unknown>).passwordHash;
    if (!storedHash || typeof storedHash !== "string") {
      return Response.json({ error: "Account was created with OTP. Please sign up again with a password." }, { status: 401 });
    }

    const valid = await verifyPassword(password, storedHash);
    if (!valid) {
      return Response.json({ error: "Incorrect password." }, { status: 401 });
    }

    const token = await createToken({ email, emailHash });

    return new Response(
      JSON.stringify({ ok: true, email, emailHash, isNew: false }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": sessionCookie(token),
        },
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Login failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}
