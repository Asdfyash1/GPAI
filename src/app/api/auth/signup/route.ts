export const runtime = "nodejs";

import { hashPassword, createToken, sessionCookie } from "@/lib/auth";
import { hashEmail, findOrCreateUserTopic, saveUserData, loadUserData } from "@/lib/telegram";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string };
  const email = body.email?.toLowerCase().trim();
  const password = body.password;

  if (!email || !email.includes("@")) {
    return Response.json({ error: "Valid email is required." }, { status: 400 });
  }
  if (!password || password.length < 6) {
    return Response.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  const emailHash = hashEmail(email);

  try {
    const existing = await loadUserData(emailHash);
    if (existing && (existing as Record<string, unknown>).passwordHash) {
      return Response.json({ error: "Account already exists. Please sign in." }, { status: 409 });
    }

    await findOrCreateUserTopic(emailHash);

    const passwordHash = await hashPassword(password);

    await saveUserData(emailHash, {
      profile: { email, createdAt: new Date().toISOString() },
      passwordHash,
      chats: [],
      settings: {},
    });

    const token = await createToken({ email, emailHash });

    return new Response(
      JSON.stringify({ ok: true, email, emailHash, isNew: true }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": sessionCookie(token),
        },
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Signup failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}
