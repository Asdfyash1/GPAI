import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? "dev-secret-change-me");
const COOKIE_NAME = "forge_session";
const TOKEN_TTL = "7d";

export type SessionPayload = {
  email: string;
  emailHash: string;
};

export async function createToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

// Same as verifyToken but also surfaces the standard JWT timing claims
// so callers can implement sliding-session refresh ("if the token is
// older than N days, mint a new one"). Returns null on invalid /
// expired tokens, just like verifyToken.
export async function verifyTokenWithMeta(
  token: string,
): Promise<(SessionPayload & { iat?: number; exp?: number }) | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      email: payload.email as string,
      emailHash: payload.emailHash as string,
      iat: typeof payload.iat === "number" ? payload.iat : undefined,
      exp: typeof payload.exp === "number" ? payload.exp : undefined,
    };
  } catch {
    return null;
  }
}

export function sessionCookie(token: string): string {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function getTokenFromRequest(request: Request): string | null {
  const cookies = request.headers.get("cookie") ?? "";
  const match = cookies.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return match?.[1] ?? null;
}

// ── OTP store (in-memory, TTL 5 min) ──

const otpStore = new Map<string, { code: string; expires: number; attempts: number }>();

export function generateOTP(email: string): string {
  const normalized = email.toLowerCase().trim();

  // Rate limit: max 5 OTPs per email per hour
  const existing = otpStore.get(normalized);
  if (existing && existing.attempts >= 5 && existing.expires > Date.now()) {
    throw new Error("Too many attempts. Try again in a few minutes.");
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  otpStore.set(normalized, {
    code,
    expires: Date.now() + 5 * 60 * 1000,
    attempts: (existing?.attempts ?? 0) + 1,
  });

  // Clean up expired entries
  for (const [key, val] of otpStore) {
    if (val.expires < Date.now()) otpStore.delete(key);
  }

  return code;
}

export function verifyOTP(email: string, code: string): boolean {
  const normalized = email.toLowerCase().trim();
  const entry = otpStore.get(normalized);
  if (!entry) return false;
  if (entry.expires < Date.now()) {
    otpStore.delete(normalized);
    return false;
  }
  if (entry.code !== code) return false;

  otpStore.delete(normalized);
  return true;
}
