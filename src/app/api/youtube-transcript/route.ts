import { requireAuth } from "@/lib/api-guard";

export const runtime = "nodejs";
export const maxDuration = 30;

const YT_URL_RE =
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;

type CaptionTrack = {
  baseUrl: string;
  languageCode: string;
  kind?: string;
};

type TranscriptSegment = {
  text: string;
  start: number;
  duration: number;
};

export async function POST(request: Request) {
  const guard = await requireAuth(request);
  if (!guard.ok) return guard.response;

  let body: { url: string };
  try {
    body = (await request.json()) as { url: string };
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.url) {
    return Response.json({ error: "A YouTube URL is required." }, { status: 400 });
  }

  const match = body.url.match(YT_URL_RE);
  if (!match) {
    return Response.json({ error: "Invalid YouTube URL." }, { status: 400 });
  }
  const videoId = match[1];

  try {
    const { title, transcript } = await fetchTranscript(videoId);
    return Response.json({ videoId, title, transcript });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch transcript";
    return Response.json({ error: msg }, { status: 422 });
  }
}

async function fetchTranscript(
  videoId: string,
): Promise<{ title: string; transcript: string }> {
  // Fetch the video page to extract caption tracks from the player config
  const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!pageRes.ok) {
    throw new Error("Could not load the YouTube video page.");
  }
  const html = await pageRes.text();

  // Extract video title
  const titleMatch = html.match(/"title":"([^"]+)"/);
  const title = titleMatch
    ? decodeJsonString(titleMatch[1])
    : `YouTube Video ${videoId}`;

  // Extract captions player response
  const captionsMatch = html.match(new RegExp('"captions":\\s*(\\{.*?"captionTracks":\\s*\\[.*?\\].*?\\})', 's'));
  if (!captionsMatch) {
    throw new Error(
      "No captions available for this video. Try a video with subtitles enabled.",
    );
  }

  let tracks: CaptionTrack[];
  try {
    // The captions JSON is embedded in the page — extract captionTracks array
    const tracksMatch = captionsMatch[1].match(new RegExp('"captionTracks":\\s*(\\[.*?\\])', 's'));
    if (!tracksMatch) throw new Error("no tracks");
    tracks = JSON.parse(tracksMatch[1]) as CaptionTrack[];
  } catch {
    throw new Error(
      "No captions available for this video. Try a video with subtitles enabled.",
    );
  }

  if (tracks.length === 0) {
    throw new Error(
      "No captions available for this video. Try a video with subtitles enabled.",
    );
  }

  // Prefer English manual captions, then English auto, then any manual, then any auto
  const pick =
    tracks.find((t) => t.languageCode === "en" && t.kind !== "asr") ??
    tracks.find((t) => t.languageCode === "en") ??
    tracks.find((t) => t.kind !== "asr") ??
    tracks[0];

  // Fetch the caption XML (timedtext format)
  const captionUrl = pick.baseUrl.startsWith("http")
    ? pick.baseUrl
    : `https://www.youtube.com${pick.baseUrl}`;
  const capRes = await fetch(captionUrl);
  if (!capRes.ok) {
    throw new Error("Failed to fetch caption data from YouTube.");
  }
  const xml = await capRes.text();

  // Parse the XML to extract text segments
  const segments = parseTimedText(xml);
  const transcript = segments.map((s) => s.text).join(" ");

  if (!transcript.trim()) {
    throw new Error(
      "Transcript is empty. The video may not have usable captions.",
    );
  }

  return { title, transcript };
}

function parseTimedText(xml: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const re = /<text start="([^"]*)" dur="([^"]*)"[^>]*>([\s\S]*?)<\/text>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    segments.push({
      start: parseFloat(m[1]),
      duration: parseFloat(m[2]),
      text: decodeHtmlEntities(m[3].replace(/<[^>]+>/g, "").trim()),
    });
  }
  return segments;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/\n/g, " ");
}

function decodeJsonString(str: string): string {
  try {
    return JSON.parse(`"${str}"`);
  } catch {
    return str;
  }
}
