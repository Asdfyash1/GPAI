import { SignJWT, jwtVerify } from "jose";
import crypto from "crypto";

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

// ── Password hashing (PBKDF2 via Node crypto) ──

const ITERATIONS = 100_000;
const KEY_LEN = 64;
const DIGEST = "sha512";

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, ITERATIONS, KEY_LEN, DIGEST, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(`${salt}:${derivedKey.toString("hex")}`);
    });
  });
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, ITERATIONS, KEY_LEN, DIGEST, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey.toString("hex") === hash);
    });
  });
}
