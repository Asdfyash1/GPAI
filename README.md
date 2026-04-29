# eduForge STEM Copilot

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

For image-to-text analysis:

```bash
NVIDIA_VISION_API_KEY=your_nvidia_vision_key
NVIDIA_VISION_MODEL=mistralai/mistral-large-3-675b-instruct-2512
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

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
