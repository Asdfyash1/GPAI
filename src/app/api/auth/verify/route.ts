export const runtime = "nodejs";

import { verifyOTP, createToken, sessionCookie } from "@/lib/auth";
import { hashEmail, findOrCreateUserTopic, saveUserData, loadUserData } from "@/lib/telegram";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; code?: string };
  const email = body.email?.toLowerCase().trim();
  const code = body.code?.trim();

  if (!email || !code) {
    return Response.json({ error: "Email and code are required." }, { status: 400 });
  }

  if (!verifyOTP(email, code)) {
    return Response.json({ error: "Invalid or expired code." }, { status: 401 });
  }

  const emailHash = hashEmail(email);

  try {
    // Ensure user has a topic in Telegram
    await findOrCreateUserTopic(emailHash);

    // Check if user already has stored data
    const existing = await loadUserData(emailHash);
    const isNew = !existing;

    if (isNew) {
      // Create initial profile
      await saveUserData(emailHash, {
        profile: { email, createdAt: new Date().toISOString() },
        chats: [],
        settings: {},
      });
    }

    const token = await createToken({ email, emailHash });

    return new Response(
      JSON.stringify({ ok: true, email, emailHash, isNew }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": sessionCookie(token),
        },
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Verification failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}
