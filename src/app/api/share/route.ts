export async function POST(request: Request) {
  const body = (await request.json()) as { id?: string };
  const id = body.id ?? `share_${Date.now()}`;

  return Response.json({
    id,
    url: `/shared/${id}`,
    copied: true,
  });
}
