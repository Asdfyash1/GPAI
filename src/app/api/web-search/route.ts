import { searchWeb } from "@/lib/web-search";

export const runtime = "nodejs";
export const maxDuration = 30;

type WebSearchBody = {
  query?: string;
  limit?: number;
};

export async function POST(request: Request) {
  let body: WebSearchBody;
  try {
    body = (await request.json()) as WebSearchBody;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const query = (body.query ?? "").trim();
  if (!query) {
    return Response.json({ error: "query required" }, { status: 400 });
  }

  const limit = Math.max(1, Math.min(10, body.limit ?? 5));
  const results = await searchWeb(query, limit);
  return Response.json({ query, results });
}
