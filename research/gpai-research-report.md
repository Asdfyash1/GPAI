# GPAI Research and eduForge Architecture Report

## Scope

The goal was to study gpai.app deeply enough to build a high-performance educational clone with feature parity, superior teaching structure, NVIDIA API integration, and a distinct frontend/brand.

## Public and logged-in GPAI findings

### Core shell
- Left sidebar with New task, Recent tasks, usage/plan affordances, and profile.
- Main task switcher: AI Solver, AI Visualizer, AI Chat, and More / AI Cheatsheet Builder.
- Credit gating and pricing were observed, but the current MVP intentionally omits pricing/upgrade UI per product direction.
- Model trust is presented through transparent verifier/cross-check status instead.

### AI Solver
- Prompt box placeholder: "Get a detailed solution".
- File upload button for images/PDF-style homework input.
- Cross-check UI with model badges and a Pro model selector.
- Demo cards include teaching material, simple explanations, and multi-problem analysis.
- Result page structure:
  - title from problem,
  - timestamp,
  - Problem block,
  - Answer block with "Cross-checked",
  - detailed Solution,
  - "Revising mistakes AI detected" / common mistakes,
  - report error,
  - follow-up questions,
  - quiz,
  - ask-about-this-problem field,
  - quick actions: Make it easy, List key concepts, Give similar practice, Explain in English,
  - copy, share, edit, regenerate, and download controls.

### AI Visualizer
- Prompt box placeholder: "Enter what you want to visualize (add references for better accuracy)".
- Supports references/upload.
- Controls observed: Start from scratch / blank canvas, Ratio, Mixture of AI.
- Explore gallery includes Illustration AI, Graph AI, Flowchart AI, Diagram AI, Circuit AI, Chemistry AI, and Logic AI.
- Result workspace includes canvas, assets/edit panels, background settings, zoom, copy/export as PNG/SVG, and feedback.

### AI Chat / Deep Explain
- Prompt box placeholder: "Type a message...".
- Deep Explain mode visible in composer.
- Supports PDF, image (JPG/PNG), website, and YouTube link context.
- Positioned as "Study with chat — from simple questions to deep research".

### AI Cheatsheet Builder
- Prompt box placeholder: "Enter a topic or upload files".
- Suggested prompts: mechanics cheatsheet, Halliday Physics cheatsheet, CLRS algorithms cheatsheet.
- Public documentation indicates block-based editing, drag/drop reordering, chat edits, version history, line-height/letter-spacing/zoom controls, share, and A4 PDF export.

### Model trust signals
- The reference product advertises multiple top-tier models and cross-verified answers.
- The MVP implements the trust concept as solver/verifier/critic status panels.
- Pricing, subscriptions, upgrade modals, and paid-plan gates are intentionally excluded for now.

## Output quality observations

Test prompt: `Solve x^2 - 5x + 6 = 0. Explain like a patient textbook teacher, show checks, and include common mistakes.`

Observed GPAI output:
- Correct final answer: `x = 2, 3`.
- Good solution flow: coefficients, factor pair, factoring, zero product property, verification.
- Useful common mistakes: sign errors, incorrect factoring, confusing factor signs with root signs.
- Weaknesses to improve:
  - Some math rendering duplicated symbols in copied text.
  - The answer was solid but not strongly modular for reuse as notes, quiz, visual plan, or practice.
  - No explicit "knowns/unknowns/strategy" metadata panel.

eduForge improvement target:
- Answer early, then teach.
- Stable structured schema with answer, steps, concepts, checks, mistakes, practice, quiz, visual plan, and cheatsheet blocks.
- Dedicated verifier/formatter pass after the solver model.
- UI-side rendering that separates reasoning, checks, and practice into teachable panels.

## Comparable patterns and reusable tooling

- Vercel AI SDK supports NVIDIA NIM via OpenAI-compatible provider at `https://integrate.api.nvidia.com/v1`.
- NVIDIA NIM exposes `/v1/chat/completions` and related OpenAI-compatible endpoints.
- Current NVIDIA model menu targets Mistral Large 3, Nemotron Super 49B, DeepSeek V4 Flash, Llama 3.3, and a local demo fallback. Model ids can be overridden with environment variables.
- React markdown + remark-math + rehype-katex is a standard formula rendering stack.
- Existing math solver repos often use Next.js, OCR/upload flows, Tesseract or vision models, and KaTeX. The useful reusable pattern is not copying code, but copying architecture: upload → OCR/context extraction → LLM solver → rendered LaTeX answer.
- AI tutor research supports two-stage tutoring: independent verification first, then targeted remediation.

## Proposed orchestrator

### Request path
1. UI sends `mode`, `prompt`, `style`, `audience`, `attachments`, and `crossCheck` to `/api/educate`.
2. Uploaded images are analyzed by NVIDIA vision/image-to-text when `NVIDIA_VISION_API_KEY` or compatible env vars are configured.
3. Planner decides the mode template:
   - solver,
   - visualizer,
   - chat/deep explain,
   - cheatsheet.
4. NVIDIA textbook solver receives the standalone `textbookSystemPrompt`.
5. NVIDIA verifier/formatter receives the draft and restructures it.
6. Optional additional OpenAI-compatible critics cross-check the answer.
7. Frontend renders the stable education schema.

### Textbook NVIDIA system prompt
The app contains a separate prompt in `src/lib/prompts.ts`. It instructs the model to:
- identify task, knowns, unknowns, assumptions, and topic,
- give the answer early,
- use LaTeX,
- explain every transformation,
- verify by substitution/unit/limit checks,
- include common mistakes,
- describe diagrams when relevant,
- create cheatsheet-ready blocks when relevant,
- avoid third-party product branding.

### Structural verifier / formatter
The second pass checks:
- correctness,
- formula ordering,
- missing assumptions,
- skipped steps,
- final answer clarity,
- beginner readability,
- quiz/follow-up/practice usefulness.

## Serverless deployment recommendation

Keep the primary application on Vercel:
- Next.js App Router frontend,
- `/api/educate` route handler for model orchestration,
- `/api/share` for share-link metadata,
- Vercel preview deployments.

Use Cloudflare Workers / AI Gateway later for:
- global model proxy,
- repeated-prompt response caching,
- rate limits and abuse control,
- token analytics,
- dynamic routing/fallbacks across NVIDIA and additional providers,
- cheaper edge observability.

Do not move heavy PDF parsing or long OCR to an edge function until limits are confirmed. For large files, use background jobs or object storage.

## Current implementation

The local app is in `/home/ubuntu/gpai-edu-clone`.

Implemented:
- full educational workspace UI with feature-parity modes,
- local deterministic fallback when API keys are absent,
- NVIDIA/OpenAI-compatible orchestrator hooks,
- NVIDIA image-to-text analysis for uploaded images through server-side environment variables,
- separate textbook system prompt,
- verifier/formatter pass,
- KaTeX markdown rendering,
- upload metadata,
- result share/copy/download/edit/regenerate flows,
- visualizer gallery,
- research/architecture display in-app.

Needed for production:
- Add real API keys as Vercel environment variables.
- Connect persistent storage for history/share links.
- Add OCR/PDF text extraction service if exact file-content solving is required.
- Add auth/billing only if pricing is brought back later.
