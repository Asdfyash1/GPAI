import { generateText } from "ai";
import {
  buildLanguageModel,
  configuredProviders,
  selectedModel,
} from "@/lib/orchestrator";
import { generateScientificImage } from "@/lib/image-generation";
import type {
  FrameRatio,
  VerificationSignal,
  VisualizeResponse,
  VisualizerCategory,
} from "@/types/education";

export const runtime = "nodejs";
export const maxDuration = 120;

type VisualizeBody = {
  prompt?: string;
  ratio?: FrameRatio;
  category?: VisualizerCategory;
  style?: "illustration" | "diagram";
};

const validCategories: VisualizerCategory[] = [
  "illustration",
  "graph",
  "flowchart",
  "diagram",
  "circuit",
  "chemistry",
  "logic",
];

function categoryStylePrefix(category: VisualizerCategory): string {
  switch (category) {
    case "illustration":
      return "Highly detailed scientific illustration in textbook style. ";
    case "graph":
      return "Clean labeled mathematical/data graph with axes, gridlines and annotations. ";
    case "flowchart":
      return "Crisp clean educational flowchart with labeled boxes and arrows. ";
    case "diagram":
      return "Labeled scientific diagram with arrows, callouts and clear annotations. ";
    case "circuit":
      return "Schematic-style electrical circuit diagram with components, nodes, and labels. ";
    case "chemistry":
      return "Chemistry diagram with molecular structures, reaction arrows and labels. ";
    case "logic":
      return "Clean logical reasoning / set / Venn / truth-table diagram with labels. ";
  }
}

function specSystem(category: VisualizerCategory) {
  return `You are an AI visualization engine for STEM education. The user wants a ${category} visualization.\n\nReturn:\n## Description\n2-3 sentences plain-English summary of what the diagram should show.\n\n## Variants\n3 short bullet points of alternative approaches.\n\n## Quality checks\n3 short bullet points (accuracy, completeness, clarity).\n\nKeep the whole response under 220 words. Use markdown only — no code fences.`;
}

export async function POST(request: Request) {
  let body: VisualizeBody;
  try {
    body = (await request.json()) as VisualizeBody;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.prompt) {
    return Response.json({ error: "prompt required" }, { status: 400 });
  }

  const ratio: FrameRatio = body.ratio ?? "16:9";
  const category: VisualizerCategory = validCategories.includes(
    body.category as VisualizerCategory,
  )
    ? (body.category as VisualizerCategory)
    : "illustration";
  const style = body.style ?? (category === "illustration" ? "illustration" : "diagram");

  const verification: VerificationSignal[] = [];
  const providers = configuredProviders();

  let description = "";
  let variants: string[] = [];
  let qualityChecks: string[] = [];

  if (providers.length > 0) {
    try {
      const primary = providers[0];
      const modelName = selectedModel("auto");
      const text = await generateText({
        model: buildLanguageModel(
          primary,
          modelName === "local-demo" ? primary.solverModel : modelName,
        ),
        system: specSystem(category),
        prompt: body.prompt,
        temperature: 0.4,
        maxOutputTokens: 600,
      });
      const md = text.text;
      description = matchSection(md, "Description") || md.split("\n").slice(0, 4).join(" ");
      variants = matchBullets(matchSection(md, "Variants"));
      qualityChecks = matchBullets(matchSection(md, "Quality checks"));
      verification.push({
        model: `Cloud:${modelName}`,
        role: "visualizer",
        status: "complete",
        notes: "Generated visual specification.",
      });
    } catch (error) {
      verification.push({
        model: "Cloud",
        role: "visualizer",
        status: "fallback",
        notes: error instanceof Error ? error.message : "Spec generation failed.",
      });
    }
  }

  let imageDataUrl: string | undefined;
  if (style === "illustration") {
    try {
      imageDataUrl = await generateScientificImage({
        prompt: `${categoryStylePrefix(category)}${body.prompt}. White background, clean lines, educational style, no watermark.`,
        ratio,
      });
      verification.push({
        model: "Flux 1 Schnell",
        role: "visualizer",
        status: imageDataUrl ? "complete" : "fallback",
        notes: imageDataUrl
          ? "Generated scientific illustration."
          : "Image generation skipped (no key).",
      });
    } catch (error) {
      verification.push({
        model: "Flux 1 Schnell",
        role: "visualizer",
        status: "fallback",
        notes: error instanceof Error ? error.message : "Image generation failed.",
      });
    }
  }

  const response: VisualizeResponse = {
    id: `viz_${Date.now()}`,
    prompt: body.prompt,
    category,
    ratio,
    imageDataUrl,
    description: description || `Visualization plan for: ${body.prompt}`,
    variants:
      variants.length > 0
        ? variants
        : [
            "Annotated still illustration with labels.",
            "Step-by-step diagram with numbered callouts.",
            "Data-driven chart with reference values.",
          ],
    qualityChecks:
      qualityChecks.length > 0
        ? qualityChecks
        : [
            "Every component is labeled with a short name.",
            "Arrows show direction or relationships, not just adjacency.",
            "Equations or units appear next to relevant elements.",
          ],
    verification,
    createdAt: new Date().toISOString(),
  };

  return Response.json(response);
}

function matchSection(markdown: string, heading: string): string {
  const re = new RegExp(
    `^#{1,3}\\s*${heading}[^\\n]*\\n([\\s\\S]*?)(?=^#{1,3}\\s|$)`,
    "im",
  );
  const m = re.exec(markdown);
  return m ? m[1].trim() : "";
}

function matchBullets(section: string): string[] {
  return section
    .split("\n")
    .map((l) => l.replace(/^[-*•]\s*/, "").replace(/^\d+[.)]\s*/, "").trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
}
