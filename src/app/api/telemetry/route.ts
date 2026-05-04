const events: Array<{ event: string; props?: Record<string, unknown>; ts: string }> = [];

const MAX_EVENTS = 10_000;

export async function POST(request: Request) {
  let body: { event?: string; props?: Record<string, unknown> };
  try {
    body = (await request.json()) as { event?: string; props?: Record<string, unknown> };
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
    event: body.event,
    props: body.props,
    ts: new Date().toISOString(),
  });

  return Response.json({ ok: true });
}

export async function GET() {
  return Response.json({ events: events.slice(-100) });
}
