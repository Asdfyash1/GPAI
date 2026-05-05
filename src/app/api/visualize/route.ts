import { generateText } from "ai";
import {
  buildLanguageModel,
  configuredProviders,
  selectedModel,
} from "@/lib/orchestrator";
import { generateScientificImage } from "@/lib/image-generation";
import { requireAuth } from "@/lib/api-guard";
import type {
  FrameRatio,
  VerificationSignal,
  VisualizeResponse,
  VisualizerCategory,
} from "@/types/education";

export const runtime = "nodejs";
export const maxDuration = 60;

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
  const wantMermaid = category !== "illustration" && category !== "chemistry";
  const mermaidBlock = wantMermaid
    ? `\n\n## Mermaid\n\`\`\`mermaid\n<a COMPLETE, RENDERABLE Mermaid diagram. Pick the right diagram type for the topic:\n- flowchart TD / flowchart LR for processes, pipelines, decision trees, ${category}\n- graph LR for relationships / set diagrams\n- sequenceDiagram for protocol / interaction\n- classDiagram for data model\n- stateDiagram-v2 for state machines\n\nSTRICT RULES so the diagram actually renders:\n- ALWAYS quote node labels that contain parentheses, colons, slashes, or punctuation: A["Step (1): apply Newton's 2nd law"]\n- Use only ASCII letters / digits / underscore in node IDs (A, B, step1, not "A.1" or "A-B")\n- Keep labels under 60 characters; abbreviate long phrases\n- Do NOT include backticks or markdown inside the diagram\n- Do NOT mix multiple top-level diagram declarations in one block\n- 5-12 nodes is a good size for a study aid\n>\n\`\`\``
    : "";
  const smilesBlock = category === "chemistry"
    ? `\n\n## SMILES\nIf the topic involves specific molecules, provide their SMILES notation. List each molecule on its own line inside a fenced block:\n\`\`\`smiles\nCCO\nCC(=O)O\n\`\`\`\nOnly include valid SMILES strings. If the topic is a reaction pathway or concept without specific molecules, omit this section.`
    : "";
  return `You are an AI visualization engine for STEM education. The user wants a ${category} visualization.\n\nReturn:\n## Description\n2-3 sentences plain-English summary of what the diagram should show.\n\n## Variants\n3 short bullet points of alternative approaches.\n\n## Quality checks\n3 short bullet points (accuracy, completeness, clarity).${mermaidBlock}${smilesBlock}\n\nKeep prose under 220 words. Use markdown.`;
}

/**
 * Make best-effort fixes so a Mermaid block produced by an LLM actually
 * renders. The most common failure modes are unquoted labels containing
 * parentheses or colons, and stray Markdown emphasis around node IDs.
 */
function sanitizeMermaid(code: string): string {
  let out = code.trim();
  // Strip leading "diagram:" / "Mermaid:" headers some models add.
  out = out.replace(/^(?:Mermaid|Diagram)\s*:\s*/i, "");
  // Replace [Some (foo) bar] -> ["Some (foo) bar"] when the label contains
  // characters that Mermaid cannot parse without quoting.
  out = out.replace(/\[([^\]\n"][^\]\n]*[(:][^\]\n]*)\]/g, (_, inner) => {
    const cleaned = inner.replace(/"/g, "'").trim();
    return `["${cleaned}"]`;
  });
  // Same for ((Text)) and {Text} shapes when they contain ()/:.
  out = out.replace(/\(\(([^)\n"][^)\n]*[(:][^)\n]*)\)\)/g, (_, inner) => {
    const cleaned = inner.replace(/"/g, "'").trim();
    return `(("${cleaned}"))`;
  });
  out = out.replace(/\{([^}\n"][^}\n]*[(:][^}\n]*)\}/g, (_, inner) => {
    const cleaned = inner.replace(/"/g, "'").trim();
    return `{"${cleaned}"}`;
  });
  return out;
}

function extractSmiles(md: string): string[] {
  const m = /\u0060\u0060\u0060smiles\s*([\s\S]*?)\u0060\u0060\u0060/i.exec(md);
  if (!m) return [];
  return m[1]
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && /^[A-Za-z0-9@+\-\[\]()\\/#=%.$:*~]/.test(l));
}

function extractMermaid(md: string): string | undefined {
  const m = /\u0060\u0060\u0060mermaid\s*([\s\S]*?)\u0060\u0060\u0060/i.exec(md);
  if (!m) return undefined;
  const code = m[1].trim();
  return code.length > 0 ? code : undefined;
}

export async function POST(request: Request) {
  const guard = await requireAuth(request);
  if (!guard.ok) return guard.response;

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
  let diagramSpec: string | undefined;
  let smilesData: string[] = [];

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
      const rawMermaid = extractMermaid(md);
      diagramSpec = rawMermaid ? sanitizeMermaid(rawMermaid) : undefined;
      if (category === "chemistry") {
        smilesData = extractSmiles(md);
      }

      // If the model omitted the mermaid block (or it was empty) and we
      // were expecting one, do exactly one stricter retry that asks for
      // ONLY the mermaid block. This is much cheaper than failing over
      // to the image-generation pipeline.
      const wantMermaid = category !== "illustration" && category !== "chemistry";
      if (!diagramSpec && wantMermaid) {
        try {
          const retry = await generateText({
            model: buildLanguageModel(
              primary,
              modelName === "local-demo" ? primary.solverModel : modelName,
            ),
            system: `You produce ONLY a Mermaid code block — nothing else. Pick the right diagram type for the topic (flowchart TD/LR, graph LR, sequenceDiagram, classDiagram, stateDiagram-v2). 5-12 nodes. Quote any label containing parentheses, colons or slashes. Only ASCII identifiers. No prose, no markdown headings, no explanation — just the \`\`\`mermaid block.`,
            prompt: body.prompt,
            temperature: 0.2,
            maxOutputTokens: 400,
          });
          const retryRaw = extractMermaid(retry.text);
          if (retryRaw) diagramSpec = sanitizeMermaid(retryRaw);
        } catch {
          // ignore - we'll fall through to the illustration path below
        }
      }

      verification.push({
        model: `Cloud:${modelName}`,
        role: "visualizer",
        status: "complete",
        notes: diagramSpec
          ? "Generated visual specification."
          : "Spec OK but no parseable diagram block.",
      });
    } catch (error) {
      console.error("[visualize] spec generation failed:", error);
      verification.push({
        model: "Cloud",
        role: "visualizer",
        status: "fallback",
        notes: "Spec generation failed.",
      });
    }
  }

  // For non-illustration categories we normally rely on the Mermaid
  // diagram. But if Mermaid extraction failed (e.g. the LLM returned
  // prose only, or the only block was unparseable) we don't want the
  // user staring at the description text — fall back to the
  // illustration pipeline so they always see *some* visual.
  const usingFallback: boolean = style !== "illustration" && !diagramSpec;
  const needIllustration: boolean = style === "illustration" || usingFallback;

  let imageDataUrl: string | undefined;
  if (needIllustration) {
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
          ? usingFallback
            ? "Diagram spec missing — fell back to scientific illustration."
            : "Generated scientific illustration."
          : "Image generation skipped (no key).",
      });
    } catch (error) {
      console.error("[visualize] image generation failed:", error);
      verification.push({
        model: "Flux 1 Schnell",
        role: "visualizer",
        status: "fallback",
        notes: "Image generation failed.",
      });
    }
  }

  const response: VisualizeResponse = {
    id: `viz_${Date.now()}`,
    prompt: body.prompt,
    category,
    ratio,
    imageDataUrl,
    diagramSpec,
    smilesData: smilesData.length > 0 ? smilesData : undefined,
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
