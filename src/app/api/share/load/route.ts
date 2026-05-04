import { loadSharedData } from "@/lib/telegram";

export const maxDuration = 30;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");

  if (!slug) {
    return Response.json({ error: "Missing slug" }, { status: 400 });
  }

  try {
    const data = await loadSharedData(slug);
    if (!data) {
      return Response.json({ error: "Share not found" }, { status: 404 });
    }
    return Response.json({ ok: true, data });
  } catch (err) {
    console.error("Share load failed:", err);
    return Response.json({ error: "Failed to load share" }, { status: 500 });
  }
}
