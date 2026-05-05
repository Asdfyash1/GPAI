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
// Main guard
// ---------------------------------------------------------------------------

export type GuardResult =
  | { ok: true; session: SessionPayload }
  | { ok: false; response: Response };

/**
 * Authenticate + rate-limit a request.
 *
 * Call this at the top of every protected API route handler:
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

  // 2. Authenticate via JWT cookie
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

  // 3. Per-user rate limiting
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
