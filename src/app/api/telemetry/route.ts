import { requireAuth } from "@/lib/api-guard";

const events: Array<{ event: string; ts: string }> = [];

const MAX_EVENTS = 10_000;

export async function POST(request: Request) {
  const guard = await requireAuth(request, { maxRequests: 60 });
  if (!guard.ok) return guard.response;

  let body: { event?: string };
  try {
    body = (await request.json()) as { event?: string };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.event || typeof body.event !== "string") {
    return Response.json({ error: "event is required" }, { status: 400 });
  }

  if (events.length >= MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS + 1000);
  }

  events.push({
    event: body.event.slice(0, 200),
    ts: new Date().toISOString(),
  });

  return Response.json({ ok: true });
}

export async function GET(request: Request) {
  const guard = await requireAuth(request);
  if (!guard.ok) return guard.response;

  return Response.json({ events: events.slice(-100) });
}
