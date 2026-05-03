import { Resend } from "resend";

// Resend's constructor throws when handed `undefined`, which means a single
// `new Resend(process.env.RESEND_API_KEY)` at module scope crashes any local
// or CI build that runs without the env var (Vercel has it; new contributors
// usually don't). Defer instantiation to the first send call so module
// evaluation never depends on the secret.
let resend: Resend | null = null;
function getResend(): Resend {
  if (resend) return resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error(
      "RESEND_API_KEY is not set. Add it to your environment to enable email-OTP sign-in.",
    );
  }
  resend = new Resend(key);
  return resend;
}

export async function sendOTPEmail(email: string, code: string): Promise<void> {
  const { error } = await getResend().emails.send({
    from: "Forge <onboarding@resend.dev>",
    to: email,
    subject: `${code} is your Forge verification code`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 400px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #f97316; margin-bottom: 8px;">Forge</h2>
        <p style="color: #888; margin-bottom: 24px;">Your verification code</p>
        <div style="background: #1a1a2e; color: #fff; font-size: 32px; letter-spacing: 8px; text-align: center; padding: 20px; border-radius: 12px; font-weight: 700;">
          ${code}
        </div>
        <p style="color: #888; font-size: 13px; margin-top: 24px;">
          This code expires in 5 minutes. If you didn't request this, ignore this email.
        </p>
      </div>
    `,
  });

  if (error) {
    throw new Error(`Email send failed: ${error.message}`);
  }
}
