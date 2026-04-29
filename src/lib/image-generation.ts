import type { FrameRatio } from "@/types/education";

const FLUX_ENDPOINT =
  "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell";

const ratioToSize: Record<FrameRatio, { width: number; height: number }> = {
  "16:9": { width: 1344, height: 768 },
  "4:3": { width: 1024, height: 768 },
  "1:1": { width: 1024, height: 1024 },
  "a4-portrait": { width: 896, height: 1280 },
  "a4-landscape": { width: 1280, height: 896 },
};

function imageApiKey() {
  return (
    process.env.NVIDIA_IMAGE_API_KEY ??
    process.env.NVIDIA_API_KEY ??
    process.env.NIM_API_KEY
  );
}

type FluxResponse = {
  artifacts?: Array<{ base64?: string; finishReason?: string }>;
  error?: { message?: string };
  detail?: unknown;
};

export async function generateScientificImage(options: {
  prompt: string;
  ratio: FrameRatio;
  steps?: number;
  seed?: number;
  signal?: AbortSignal;
}): Promise<string | undefined> {
  const key = imageApiKey();
  if (!key) return undefined;

  const size = ratioToSize[options.ratio] ?? ratioToSize["16:9"];

  const response = await fetch(FLUX_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      prompt: options.prompt,
      width: size.width,
      height: size.height,
      steps: options.steps ?? 4,
      seed: options.seed ?? Math.floor(Math.random() * 1_000_000),
      cfg_scale: 0,
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(
      `Image generation returned ${response.status}: ${text.slice(0, 240)}`,
    );
  }

  const data = (await response.json()) as FluxResponse;
  const base64 = data.artifacts?.[0]?.base64;
  if (!base64) {
    throw new Error("Image generation returned no artifact");
  }
  return `data:image/jpeg;base64,${base64}`;
}
