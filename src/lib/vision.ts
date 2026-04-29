import type { UploadedAsset } from "@/types/education";

const visionBaseUrl = "https://integrate.api.nvidia.com/v1/chat/completions";
const visionModel = "mistralai/mistral-large-3-675b-instruct-2512";
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

type NvidiaVisionContent =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type NvidiaVisionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: { message?: string };
};

function visionApiKey() {
  return (
    process.env.NVIDIA_VISION_API_KEY ??
    process.env.NVIDIA_IMAGE_TO_TEXT_API_KEY ??
    process.env.NVIDIA_API_KEY ??
    process.env.NIM_API_KEY
  );
}

async function describeImage(asset: UploadedAsset): Promise<string | undefined> {
  const key = visionApiKey();
  if (!key) return "[Image uploaded but no vision API key configured]";
  if (!asset.dataUrl || !asset.type.startsWith("image/")) return undefined;

  if (asset.dataUrl.length > MAX_IMAGE_BYTES) {
    return "[Image too large for vision analysis — please upload a smaller image under 20 MB]";
  }

  const content: NvidiaVisionContent[] = [
    {
      type: "text",
      text:
        "Extract and explain every visible educational detail from this image. Transcribe text, equations, labels, diagrams, units, and answer choices. Then summarize what problem the solver should answer.",
    },
    {
      type: "image_url",
      image_url: {
        url: asset.dataUrl,
      },
    },
  ];

  const response = await fetch(visionBaseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.NVIDIA_VISION_MODEL ?? visionModel,
      messages: [{ role: "user", content }],
      max_tokens: 2048,
      temperature: 0.15,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      stream: false,
    }),
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const errorBody = (await response.json()) as NvidiaVisionResponse;
      if (errorBody.error?.message) detail = errorBody.error.message;
    } catch {
      /* use statusText */
    }
    throw new Error(
      `NVIDIA vision API returned ${response.status}: ${detail}`,
    );
  }

  const data = (await response.json()) as NvidiaVisionResponse;
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("NVIDIA vision API returned an empty response");
  }
  return text;
}

export async function analyzeUploadedImages(attachments: UploadedAsset[]) {
  const analyzed: UploadedAsset[] = [];

  for (const asset of attachments) {
    if (!asset.type.startsWith("image/") || !asset.dataUrl) {
      analyzed.push(asset);
      continue;
    }

    try {
      const extractedText = await describeImage(asset);
      analyzed.push({
        ...asset,
        extractedText,
        dataUrl: undefined,
      });
    } catch (error) {
      console.error(`[vision] Failed to analyze ${asset.name}:`, error);
      analyzed.push({
        ...asset,
        extractedText: `[Image analysis failed: ${error instanceof Error ? error.message : "unknown error"}]`,
        dataUrl: undefined,
      });
    }
  }

  return analyzed;
}
