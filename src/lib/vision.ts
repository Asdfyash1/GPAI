import type { UploadedAsset } from "@/types/education";

const visionBaseUrl = "https://integrate.api.nvidia.com/v1/chat/completions";
const visionModel = "mistralai/mistral-large-3-675b-instruct-2512";

type NvidiaVisionContent =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type NvidiaVisionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

function visionApiKey() {
  return (
    process.env.NVIDIA_VISION_API_KEY ??
    process.env.NVIDIA_IMAGE_TO_TEXT_API_KEY ??
    process.env.NVIDIA_API_KEY ??
    process.env.NIM_API_KEY
  );
}

async function describeImage(asset: UploadedAsset) {
  const key = visionApiKey();
  if (!key || !asset.dataUrl || !asset.type.startsWith("image/")) return undefined;

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
    throw new Error(`NVIDIA image analysis failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as NvidiaVisionResponse;
  return data.choices?.[0]?.message?.content;
}

export async function analyzeUploadedImages(attachments: UploadedAsset[]) {
  const analyzed: UploadedAsset[] = [];

  for (const asset of attachments) {
    if (!asset.type.startsWith("image/") || !asset.dataUrl) {
      analyzed.push(asset);
      continue;
    }

    try {
      analyzed.push({
        ...asset,
        extractedText: await describeImage(asset),
        dataUrl: undefined,
      });
    } catch (error) {
      analyzed.push({
        ...asset,
        extractedText: error instanceof Error ? error.message : "Image analysis failed.",
        dataUrl: undefined,
      });
    }
  }

  return analyzed;
}
