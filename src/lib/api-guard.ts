import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import type { SessionPayload } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Rate limiter — sliding-window counter keyed by user email hash.
//
// Serverless-safe: uses an in-memory Map that lives for the duration of the
// cold-start instance. Each Vercel isolate gets its own map, so the limits
// are approximate — but they're good enough to stop abuse without needing
// an external store (Redis, DynamoDB, etc.).
// ---------------------------------------------------------------------------

type RateBucket = { count: number; resetAt: number };

const rateBuckets = new Map<string, RateBucket>();

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 30;

function isRateLimited(
  key: string,
  maxRequests = DEFAULT_MAX_REQUESTS,
  windowMs = DEFAULT_WINDOW_MS,
): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  bucket.count++;
  return bucket.count > maxRequests;
}

// Prevent unbounded memory growth: periodically prune expired buckets.
// This runs lazily — at most once per minute.
let lastPrune = Date.now();
function maybePrune() {
  const now = Date.now();
  if (now - lastPrune < 60_000) return;
  lastPrune = now;
  for (const [key, bucket] of rateBuckets) {
    if (now >= bucket.resetAt) rateBuckets.delete(key);
  }
}

// ---------------------------------------------------------------------------
// Payload-size guard
// ---------------------------------------------------------------------------

const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MB

// ---------------------------------------------------------------------------
// Origin validation (CSRF protection)
//
// For state-changing requests (POST/PUT/PATCH/DELETE), verify that the
// Origin or Referer header matches the app's own host. This prevents
// cross-origin form submissions and fetch() calls from foreign sites
// even if the attacker somehow has the user's cookie.
//
// In development (localhost), all origins are allowed so hot-reload and
// testing tools work without friction.
// ---------------------------------------------------------------------------

function isOriginAllowed(request: Request): boolean {
  const host = request.headers.get("host");
  if (!host) return false;

  // Skip origin check for safe (read-only) methods
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return true;
  }

  // Allow all origins in development
  if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) {
    return true;
  }

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  // At least one of Origin or Referer must be present for non-safe requests
  if (!origin && !referer) return false;

  if (origin) {
    try {
      const originHost = new URL(origin).host;
      return originHost === host;
    } catch {
      return false;
    }
  }

  if (referer) {
    try {
      const refererHost = new URL(referer).host;
      return refererHost === host;
    } catch {
      return false;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Main guard
// ---------------------------------------------------------------------------

export type GuardResult =
  | { ok: true; session: SessionPayload }
  | { ok: false; response: Response };

/**
 * Authenticate + rate-limit a request.
 *
 * Security layers (checked in order):
 * 1. Payload size — rejects oversized requests (413)
 * 2. Origin validation — rejects cross-origin POST/PUT/PATCH/DELETE (403)
 * 3. JWT authentication — rejects missing/invalid session cookies (401)
 * 4. Rate limiting — rejects excessive requests per user (429)
 *
 * ```ts
 * const guard = await requireAuth(request);
 * if (!guard.ok) return guard.response;
 * // guard.session is now available
 * ```
 */
export async function requireAuth(
  request: Request,
  opts?: { maxRequests?: number; windowMs?: number; maxBodyBytes?: number },
): Promise<GuardResult> {
  maybePrune();

  // 1. Reject oversized payloads early
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  const maxBody = opts?.maxBodyBytes ?? MAX_BODY_BYTES;
  if (Number.isFinite(contentLength) && contentLength > maxBody) {
    return {
      ok: false,
      response: Response.json(
        { error: "Request payload too large." },
        { status: 413 },
      ),
    };
  }

  // 2. CSRF: validate Origin/Referer for state-changing methods
  if (!isOriginAllowed(request)) {
    return {
      ok: false,
      response: Response.json(
        { error: "Cross-origin requests are not allowed." },
        { status: 403 },
      ),
    };
  }

  // 3. Authenticate via JWT cookie
  const token = getTokenFromRequest(request);
  if (!token) {
    return {
      ok: false,
      response: Response.json(
        { error: "Authentication required." },
        { status: 401 },
      ),
    };
  }

  const session = await verifyToken(token);
  if (!session) {
    return {
      ok: false,
      response: Response.json(
        { error: "Invalid or expired session." },
        { status: 401 },
      ),
    };
  }

  // 4. Per-user rate limiting
  const rateKey = `api:${session.emailHash}`;
  if (isRateLimited(rateKey, opts?.maxRequests, opts?.windowMs)) {
    return {
      ok: false,
      response: Response.json(
        { error: "Too many requests. Please wait and try again." },
        { status: 429 },
      ),
    };
  }

  return { ok: true, session };
}
