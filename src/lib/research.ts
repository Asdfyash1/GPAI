export const gpaiFeatureFindings = [
  {
    title: "AI Solver",
    detail:
      "Primary task composer for STEM questions with typed prompt, file upload, demo cards, cross-check badge, a concise Answer section, detailed Solution section, detected mistakes, follow-up questions, quiz, report error, share, copy, regenerate, edit, and download affordances.",
  },
  {
    title: "AI Visualizer",
    detail:
      "Prompt-to-visual workspace with a blank canvas, references upload, ratio controls, model mix control, export to PNG/SVG, editable canvas/assets panels, and template galleries for illustration, graph, flowchart, diagram, circuit, chemistry, and logic diagrams.",
  },
  {
    title: "AI Chat / Deep Explain",
    detail:
      "General research and tutoring chat with PDF/image/site/YouTube context, a Deep Explain mode, and output framed for deeper explanations rather than a single final answer.",
  },
  {
    title: "AI Cheatsheet Builder",
    detail:
      "Prompt/file-driven study sheet generation with suggested prompts, page count language, block-based notes, version/editor intent, and export/share-style UX.",
  },
  {
    title: "Model trust signals",
    detail:
      "The reference product advertises cross-checking and top-tier model routing. The MVP keeps this as transparent verifier status instead of adding pricing or upgrade UI.",
  },
];

export const openSourcePatterns = [
  "Next.js + Vercel route handlers for a deployment-friendly frontend and backend-for-frontend.",
  "Vercel AI SDK OpenAI-compatible provider for cloud-hosted models.",
  "KaTeX-compatible markdown rendering through react-markdown, remark-math, and rehype-katex.",
  "Two-pass tutoring pattern from AI tutor research: solver generates a full solution, verifier locates errors or weak pedagogy, formatter remediates the final student-facing answer.",
  "Cloudflare AI Gateway/Workers can later proxy model calls for caching, rate limiting, analytics, dynamic routing, and fallback policies.",
];

export const architectureHighlights = [
  "Planner routes each request by mode, attachments, and requested style.",
  "Textbook-grade solver writes the core explanation with definitions, formulas, assumptions, derivations, checks, and common mistakes.",
  "Cross-check critics compare final answer, formulas, unit consistency, and skipped reasoning across any configured providers.",
  "Structural formatter rewrites the result into a stable schema: answer, step list, key concepts, common mistakes, checks, practice, quiz, visual plan, and cheatsheet blocks.",
  "UI renders the schema as an educational workspace rather than dumping raw model text.",
];
