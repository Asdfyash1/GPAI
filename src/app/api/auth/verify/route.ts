export const runtime = "nodejs";

export async function POST() {
  return Response.json(
    { error: "OTP verification has been replaced. Use /api/auth/signup or /api/auth/login with email + password." },
    { status: 410 },
  );
}
