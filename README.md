# Forge — STEM Copilot

A high-performance educational clone inspired by GPAI-style STEM workflows, built with a distinct UI and deployable on Vercel.

## Features

- AI Solver with answer, step-by-step derivation, cross-checks, common mistakes, follow-ups, quiz, copy/share/download actions.
- AI Visualizer with prompt-to-diagram planning, upload support, ratio/model controls, visual engine gallery, and export-style workflow.
- AI Chat / Deep Explain for deeper tutoring with uploaded documents/images/links as context.
- AI Cheatsheet Builder for prompt/file-driven printable study blocks.
- Multi-pass orchestrator: NVIDIA textbook solver → verifier/formatter → optional OpenAI-compatible cross-checkers.
- NVIDIA image-to-text analysis for uploaded homework screenshots, diagrams, and worksheet photos.
- KaTeX-ready markdown rendering for formulas.

## Environment

The app works without API keys using deterministic demo output. To enable NVIDIA NIM:

```bash
NVIDIA_API_KEY=your_nvidia_key
NVIDIA_SOLVER_MODEL=mistralai/mistral-large-3-675b-instruct-2512
NVIDIA_VERIFIER_MODEL=meta/llama-3.3-70b-instruct
NVIDIA_MODEL_MISTRAL_LARGE=mistralai/mistral-large-3-675b-instruct-2512
NVIDIA_MODEL_NEMOTRON=nvidia/llama-3.3-nemotron-super-49b-v1
NVIDIA_MODEL_DEEPSEEK_FLASH=deepseek-ai/deepseek-v4-flash
NVIDIA_MODEL_LLAMA=meta/llama-3.3-70b-instruct
```

For image-to-text analysis the app uses NVIDIA's `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` multimodal model (via the same hosted endpoint at `integrate.api.nvidia.com`). Reuses `NVIDIA_API_KEY` by default — no separate key required:

```bash
# Optional overrides; defaults shown.
NVIDIA_VISION_API_KEY=your_nvidia_vision_key   # falls back to NVIDIA_API_KEY
NVIDIA_VISION_MODEL=nvidia/nemotron-3-nano-omni-30b-a3b-reasoning
```

Optional additional OpenAI-compatible provider:

```bash
ADDITIONAL_OPENAI_COMPATIBLE_API_KEY=your_key
ADDITIONAL_OPENAI_COMPATIBLE_BASE_URL=https://api.openai.com/v1
ADDITIONAL_OPENAI_COMPATIBLE_MODEL=gpt-4o-mini
ADDITIONAL_OPENAI_COMPATIBLE_NAME=OpenAI
```

## Architecture

Route handlers under `src/app/api` keep model keys server-side. The UI sends a structured request to `/api/educate`; the orchestrator creates a textbook-quality draft, verifies/restructures it, and returns a stable JSON schema for the frontend workspace.

Cloudflare Workers / AI Gateway is a recommended future edge layer for rate limiting, caching repeated prompts, observability, and dynamic model routing. The current app is Vercel-compatible without requiring Workers.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Verification

```bash
npm run lint
npm run build
```

## Research artifacts

`research/gpai-research-report.md` documents GPAI feature findings, logged-in observations, architecture decisions, and serverless recommendations.

## Deploy on Vercel

This project is Vercel-ready out of the box. To deploy:

1. Push this repo to GitHub (or import directly into Vercel from the dashboard).
2. In Vercel → Project → Settings → Environment Variables, add at minimum:
   - `NVIDIA_API_KEY` — your NVIDIA NIM key (required for live model calls; the app falls back to deterministic demo output without it)
   - Optionally any of the model overrides listed in the **Environment** section above (e.g. `NVIDIA_SOLVER_MODEL`, `NVIDIA_VISION_API_KEY`)
3. Click **Deploy**. No `vercel.json` is required — Next.js 16 + Turbopack are detected automatically.

All API routes (`/api/educate`, `/api/educate/stream`, `/api/chat`, `/api/visualize`, `/api/parse-pdf`) run on the Node.js runtime with `maxDuration = 60`s, which works on the Vercel Hobby plan. Upgrade to Pro if you need longer timeouts for very large generations.

PDF parsing uses [`unpdf`](https://www.npmjs.com/package/unpdf), which is pure-JS and works on Vercel without any native binary. Mermaid diagrams are rendered fully on the client.
