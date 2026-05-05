# Forge — AI-Powered STEM Copilot

Forge is a full-stack AI education platform that turns any STEM problem — typed, photographed, or pasted from a URL — into a step-by-step solution, interactive quiz, diagram, cheatsheet, and more. Built with **Next.js 16**, **TypeScript**, and **NVIDIA NIM** models, deployed on **Vercel**.

---

## Features

### AI Solver
Upload a photo of a homework problem, paste LaTeX, or type a question. Forge returns:
- **Step-by-step derivation** with collapsible reveal (show one step at a time)
- **Final answer** with KaTeX-rendered formulas
- **Cross-check verification** — a second model independently validates the primary answer (agree / minor difference / disagree)
- **Key concepts** and **common mistakes** sections
- **Inline glossary** — orange-underlined terms with hover definitions
- **Follow-up chips** — one-click deeper dives ("Why does this step work?", "Show me a similar problem")
- **Built-in quiz panel** — paginated MCQ with hints, explanations, and scoring
- **Share** — generate a public link anyone can view (no login required)
- **Download / Copy** actions

### AI Chat
Streaming multi-turn conversations with persistent threads:
- Multiple frontier model selection (Nemotron, DeepSeek Flash, Llama, auto)
- **Deep Explain** toggle for rigorous, textbook-level responses
- **Web search** toggle — fetches live web context before answering
- **YouTube ingestion** — paste a YouTube URL, Forge auto-fetches the transcript and uses it as context
- File/image/PDF upload as conversation context
- Follow-up suggestion chips
- Regenerate any response
- Share chat threads via public link

### AI Visualizer
Turn a prompt into a visual output:
- **Mermaid diagrams** — flowcharts, sequence diagrams, class diagrams, ER diagrams
- **AI image generation** — Flux 1 Schnell for illustrations, charts, circuit diagrams
- Aspect ratio controls (16:9, 4:3, 1:1, A4 portrait/landscape)
- Category presets (illustration, graph, flowchart, diagram, circuit, chemistry, logic)

### Cheatsheet Builder
Generate compact, printable study cheatsheets from any topic, syllabus, or uploaded document. Organized into titled sections with formulas and key facts.

### Debate Mode
Pit **four models** against the same prompt simultaneously. A judge model picks the winner and explains why. Side-by-side answer cards reveal where models agree and disagree.

### Report Writer
Generate polished research-style documents with structured sections: abstract, introduction, background, methods, results, conclusion, references.

### PDF Notes
Upload a PDF → Forge extracts the text and generates study notes, summaries, and key takeaways. Uses `unpdf` for pure-JS parsing (no native binaries).

### Interactive Notebook
A scratchpad-style environment for iterative problem solving with AI assistance.

### OCR / Vision
Upload a photo of handwritten work, a textbook page, or a diagram. NVIDIA Nemotron Omni reads the image and feeds the extracted text into the solver. Client-side compression (1600px / q0.85) keeps payloads under the 1.7 MB API gateway limit.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript (strict) |
| UI | React 19, Lucide icons, CSS custom properties (no Tailwind) |
| Math rendering | KaTeX via `rehype-katex` + `remark-math` |
| Markdown | `react-markdown` + `remark-gfm` |
| Diagrams | Mermaid.js (client-side rendering) |
| LLM API | NVIDIA NIM (Nemotron, DeepSeek Flash, Llama 3.3) via Vercel AI SDK |
| Vision/OCR | NVIDIA Nemotron Omni 30B |
| Image gen | Flux 1 Schnell (via NVIDIA NIM) |
| Auth | Email OTP → JWT (HttpOnly cookie, 7-day sliding window) |
| Email | Resend API (lazy-initialized) |
| Storage | Telegram Bot API (server-side only, invisible to users) |
| Hosting | Vercel (serverless, Hobby-tier compatible) |
| PDF parsing | `unpdf` (pure JS, no native deps) |

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.ts      # POST — send OTP (alias of signup)
│   │   │   ├── logout/route.ts     # POST — clear JWT cookie
│   │   │   ├── me/route.ts         # GET  — check session + sliding refresh
│   │   │   ├── signup/route.ts     # POST — send OTP email via Resend
│   │   │   └── verify/route.ts     # POST — verify OTP, mint JWT, create user topic
│   │   ├── chat/route.ts           # POST — streaming chat endpoint
│   │   ├── debate/route.ts         # POST — 4-model debate mode
│   │   ├── educate/
│   │   │   ├── route.ts            # POST — non-streaming solver
│   │   │   └── stream/route.ts     # POST — streaming step-by-step solver
│   │   ├── parse-pdf/route.ts      # POST — PDF text extraction
│   │   ├── quiz/route.ts           # POST — generate quiz from problem text
│   │   ├── share/
│   │   │   ├── route.ts            # POST — create shareable link
│   │   │   └── load/route.ts       # GET  — load shared content by slug
│   │   ├── sync/
│   │   │   ├── load/route.ts       # GET  — load user data from cloud
│   │   │   └── save/route.ts       # POST — save user data to cloud
│   │   ├── visualize/route.ts      # POST — diagram/image generation
│   │   ├── web-search/route.ts     # POST — web search for chat context
│   │   └── youtube-transcript/route.ts  # POST — fetch YouTube captions
│   ├── app/page.tsx                # /app — main workspace (auth-guarded)
│   ├── login/page.tsx              # /login — dedicated login page
│   ├── s/[slug]/page.tsx           # /s/:slug — shared content viewer
│   ├── page.tsx                    # / — public landing page
│   ├── layout.tsx                  # Root layout (fonts, metadata)
│   └── globals.css                 # ALL styles (~5300 lines, design system)
│
├── components/
│   ├── EducationApp.tsx            # Main workspace — all state lives here
│   ├── LandingPage.tsx             # Public marketing page at /
│   ├── LoginPage.tsx               # Split-screen login (feature showcase + auth form)
│   ├── AuthGuard.tsx               # Wraps /app — redirects to /login if unauthenticated
│   ├── AuthModal.tsx               # In-app login modal (workspace topbar)
│   ├── MigrationPrompt.tsx         # First-login "Import local data?" dialog
│   ├── SharedPage.tsx              # Read-only viewer for /s/:slug shared content
│   ├── SolverView.tsx              # AI solver — step reveal, cross-check, quiz, follow-ups
│   ├── ChatView.tsx                # Streaming chat with persistent threads
│   ├── CheatsheetView.tsx          # Topic → printable cheatsheet
│   ├── VisualizerView.tsx          # Mermaid diagrams + image generation
│   ├── DocumentView.tsx            # Report writer mode
│   ├── PdfNotesView.tsx            # PDF upload → AI notes
│   ├── NotebookView.tsx            # Interactive notebook
│   ├── Composer.tsx                # Shared input (text + file upload + model selector)
│   ├── Sidebar.tsx                 # Navigation sidebar with history
│   ├── ModeTabs.tsx                # Feature mode tab bar
│   ├── MathMarkdown.tsx            # KaTeX + markdown renderer
│   ├── MermaidBlock.tsx            # Client-side Mermaid diagram renderer
│   ├── GlossaryTerm.tsx            # Orange-underlined glossary term with tooltip
│   ├── ModelAvatars.tsx            # Model icons for debate mode
│   ├── SettingsModal.tsx           # Theme + preferences
│   └── OnboardingTour.tsx          # First-visit guided tour
│
├── hooks/
│   ├── useStream.ts                # SSE streaming hook for chat/solver
│   ├── useSync.ts                  # 5s debounced auto-save to cloud
│   └── usePersonalization.ts       # User preferences (occupation, custom instructions)
│
├── lib/
│   ├── auth.ts                     # JWT (jose), OTP generation/verification
│   ├── telegram.ts                 # Telegram Bot API storage (server-side only)
│   ├── email.ts                    # Resend OTP email (lazy-init)
│   ├── sync.ts                     # SyncSnapshot type, buildSnapshot, parseSnapshot
│   ├── orchestrator.ts             # LLM pipeline — multi-model coordination
│   ├── vision.ts                   # OCR via NVIDIA Nemotron Omni
│   ├── prompts.ts                  # System prompt library
│   ├── response-parser.ts          # Regex decomposition of LLM markdown
│   ├── streaming-protocol.ts       # SSE protocol helpers
│   ├── client-extract.ts           # Browser-side PDF/text parsing
│   ├── demo-solver.ts              # Deterministic demo output (no API key needed)
│   ├── glossary-markdown.ts        # Glossary term highlighting in markdown
│   ├── image-generation.ts         # Flux 1 Schnell image generation
│   ├── web-search.ts               # Web search provider
│   └── research.ts                 # Research report generation
│
└── types/
    └── education.ts                # All TypeScript interfaces
```

---

## Getting Started

### Prerequisites

- **Node.js 18+** (20+ recommended)
- **npm** (comes with Node)

### Install & Run

```bash
# Clone
git clone https://github.com/Asdfyash1/GPAI.git
cd GPAI

# Install dependencies
npm install

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app works without any API keys — it falls back to deterministic demo output.

### Verify

```bash
npm run lint    # ESLint
npm run build   # Production build (Next.js 16 + Turbopack)
```

> **Note:** If building locally without `RESEND_API_KEY`, the build still succeeds because Resend is lazy-initialized (deferred to first `sendOTPEmail()` call). OTP emails won't send, but nothing crashes.

---

## Environment Variables

The app is fully functional without any env vars (demo mode). Add these for production features:

### Required for AI Features

| Variable | Source | Purpose |
|----------|--------|---------|
| `NVIDIA_API_KEY` | [nvidia.com/nim](https://build.nvidia.com/) | LLM + vision API calls |

### Required for Auth & Storage

| Variable | Source | Purpose |
|----------|--------|---------|
| `JWT_SECRET` | Self-generated (64-char hex) | JWT signing for auth tokens |
| `RESEND_API_KEY` | [resend.com](https://resend.com) | OTP email delivery |
| `TELEGRAM_BOT_TOKENS` | [@BotFather](https://t.me/BotFather) (comma-separated) | Cloud storage backend (multi-bot rotation) |
| `TELEGRAM_CHANNEL_ID` | Private channel with Topics enabled | `-100xxxxxxxxxx` format |

### Optional Model Overrides

```bash
NVIDIA_SOLVER_MODEL=meta/llama-3.3-70b-instruct
NVIDIA_VERIFIER_MODEL=meta/llama-3.3-70b-instruct
NVIDIA_MODEL_NEMOTRON=nvidia/llama-3.3-nemotron-super-49b-v1
NVIDIA_MODEL_DEEPSEEK_FLASH=deepseek-ai/deepseek-v4-flash
NVIDIA_MODEL_LLAMA=meta/llama-3.3-70b-instruct
NVIDIA_VISION_API_KEY=your_nvidia_vision_key   # falls back to NVIDIA_API_KEY
NVIDIA_VISION_MODEL=nvidia/nemotron-3-nano-omni-30b-a3b-reasoning
```

### Optional Cross-Check Provider

```bash
ADDITIONAL_OPENAI_COMPATIBLE_API_KEY=your_key
ADDITIONAL_OPENAI_COMPATIBLE_BASE_URL=https://api.openai.com/v1
ADDITIONAL_OPENAI_COMPATIBLE_MODEL=gpt-4o-mini
ADDITIONAL_OPENAI_COMPATIBLE_NAME=OpenAI
```

> **Warning:** Do NOT set any model to `mistralai/mistral-large-3-675b-instruct-2512` — it's not in the NVIDIA NIM catalog and every call will 404.

---

## Auth Flow

1. User visits `/` → landing page → clicks "Get started" → navigates to `/login`
2. Enters email → `POST /api/auth/signup` → Resend sends 6-digit OTP
3. Enters OTP → `POST /api/auth/verify` → server verifies, creates cloud storage topic for new users, mints JWT
4. JWT set as `forge_session` HttpOnly cookie (7-day, SameSite=Lax)
5. Redirected to `/app` → `AuthGuard` checks `GET /api/auth/me` → renders workspace
6. Session sliding refresh: if JWT is >6 days old, `/api/auth/me` mints a fresh 7-day token
7. OTP: in-memory store, 5-min TTL, 5 attempts/hour rate limit per email

---

## Data Sync

All user data (history, solver results, chat sessions, theme) syncs automatically to the cloud:

- **Auto-save**: 5-second debounced writes via `useSync` hook — every state change kicks the timer
- **Page unload**: `beforeunload` handler fires `navigator.sendBeacon` to flush the current snapshot
- **Load on login**: cloud data replaces local state; if cloud is empty and local has data, a migration prompt asks the user to import or start fresh
- **localStorage**: used as the primary working copy; cloud sync is the backup layer
- **Completely invisible**: users never see any storage-related UI — sync happens silently

### localStorage Keys

| Key | Content | Synced |
|-----|---------|--------|
| `eduforge:history` | `SidebarItem[]` (max 25) | Yes |
| `eduforge:responses` | `Record<string, EducationResponse>` | Yes |
| `eduforge:chats` | `Record<string, ChatSession>` | Yes |
| `eduforge:theme` | `"dark"` or `"light"` | Yes |
| `eduforge:onboarding` | `"done"` | No |

---

## Share URLs

Solver results and chat threads can be shared via public URLs:

1. Click the share button on any solve result or chat thread
2. `POST /api/share` saves the content to a public storage topic, returns a slug
3. The shareable URL is `https://your-domain.com/s/<slug>`
4. `/s/[slug]` renders the content read-only with full KaTeX/markdown support
5. No login required to view shared content

---

## Design System

All styles live in `src/app/globals.css` (~5300 lines). The design system uses CSS custom properties for theming:

```css
--bg              /* page background */
--bg-elev         /* elevated surface (cards, modals) */
--ink             /* primary text */
--ink-muted       /* secondary text */
--accent          /* orange brand color */
--accent-soft     /* light orange background */
--accent-strong   /* darker orange for hover */
--line            /* border color */
--line-strong     /* stronger border */
--shadow-soft     /* box-shadow */
--user-bubble     /* chat user message bg */
--muted           /* very faint text */
```

Theme is toggled via `<html data-theme="dark|light">` with CSS `[data-theme="light"]` overrides.

**Mobile breakpoint:** 720px. The sidebar becomes an off-canvas drawer on mobile.

---

## Routes

| Route | Auth | Purpose |
|-------|------|---------|
| `/` | No | Public landing page — hero, feature cards, how-it-works |
| `/login` | No | Split-screen login — feature showcase + email OTP form |
| `/app` | Yes | Main workspace — solver, chat, visualizer, etc. |
| `/s/[slug]` | No | Read-only shared content viewer |

---

## API Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/auth/signup` | POST | No | Create account (email + password) |
| `/api/auth/login` | POST | No | Sign in (returning users) |
| `/api/auth/verify` | POST | No | Legacy OTP verify (deprecated, returns 410) |
| `/api/auth/me` | GET | No | Check session + sliding refresh |
| `/api/auth/logout` | POST | No | Clear JWT cookie |
| `/api/sync/save` | POST | Yes | Save user data to cloud |
| `/api/sync/load` | GET | Yes | Load user data from cloud |
| `/api/share` | POST | Yes | Create shareable link |
| `/api/share/load` | GET | No | Load shared content by slug |
| `/api/educate/stream` | POST | Yes | Streaming step-by-step solver |
| `/api/educate` | POST | Yes | Non-streaming solver |
| `/api/chat` | POST | Yes | Streaming chat |
| `/api/quiz` | POST | Yes | Generate quiz from problem |
| `/api/debate` | POST | Yes | 4-model debate (rate: 10/min) |
| `/api/visualize` | POST | Yes | Diagram / image generation |
| `/api/parse-pdf` | POST | Yes | PDF text extraction |
| `/api/web-search` | POST | Yes | Web search for chat context |
| `/api/youtube-transcript` | POST | Yes | Fetch YouTube captions |
| `/api/fetch-url` | POST | Yes | Fetch + extract text from URL |
| `/api/telemetry` | POST/GET | Yes | Event logging (rate: 60/min) |

All API routes run on Node.js runtime with `maxDuration = 60s` (Vercel Hobby compatible).

---

## Deploy on Vercel

1. Push to GitHub or import directly into Vercel
2. Add environment variables (see table above)
3. Click **Deploy** — no `vercel.json` needed, Next.js 16 + Turbopack auto-detected

PDF parsing uses [`unpdf`](https://www.npmjs.com/package/unpdf) (pure JS, no native binaries). Mermaid diagrams render client-side.

---

## Backend Security

All AI-powered endpoints are **secured by default** — unauthenticated requests from external tools (Colab, Postman, curl) are rejected with `401`.

### Authentication

Every AI endpoint requires a valid JWT session via the `requireAuth()` guard (`src/lib/api-guard.ts`). The guard:

1. Validates the `forge_session` HttpOnly cookie (JWT signed with `JWT_SECRET`)
2. Returns `401` for missing or expired tokens
3. Enforces per-user rate limiting (returns `429` when exceeded)
4. Rejects oversized payloads (returns `413`)

```ts
// Usage in any API route:
import { requireAuth } from "@/lib/api-guard";

export async function POST(request: Request) {
  const guard = await requireAuth(request);
  if (!guard.ok) return guard.response;
  // guard.session.email / guard.session.emailHash available
}
```

### Rate Limiting

| Endpoint | Limit |
|----------|-------|
| Most AI endpoints | 30 requests / 60 seconds per user |
| `/api/debate` | 10 requests / 60 seconds (4 model calls per request) |
| `/api/telemetry` | 60 requests / 60 seconds |

In-memory sliding-window counters, per Vercel isolate. Expired buckets are pruned periodically to prevent memory leaks.

### SSRF Protection

`/api/fetch-url` blocks requests to internal/private addresses:

- Loopback: `127.0.0.0/8`, `localhost`, `[::1]`
- Private: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
- Link-local: `169.254.0.0/16`
- Cloud metadata: `169.254.169.254`, `metadata.google.internal`
- Local domains: `*.local`, `*.internal`

### Security Headers

Applied globally via `next.config.ts`:

| Header | Value |
|--------|-------|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `X-Powered-By` | Removed |

API routes additionally get `Cache-Control: no-store, no-cache, must-revalidate`.

### Error Handling

- **No internal details leak to clients** — error responses return generic messages
- Stack traces, model errors, and API key status are logged server-side only (`console.error`)
- Telemetry events are truncated to 200 characters; arbitrary properties are stripped

### Public Endpoints

These endpoints intentionally do **not** require authentication:

- `/api/auth/*` — login, signup, session check
- `/api/share/load` — shared content is viewable without login
- `/s/[slug]` — public shared content viewer

---

## Key Technical Notes

- **Next.js 16** — has breaking changes vs. training data. Read `node_modules/next/dist/docs/` before writing code.
- **All state lives in `EducationApp.tsx`** — no Redux/Zustand. Props drilled to child views.
- **Lucide React v1.12.0** — `Youtube` icon doesn't exist; use `Video` or `CirclePlay`.
- **OTP store is in-memory** — serverless cold starts lose pending OTPs (acceptable for MVP).
- **Cloud storage limit** — registry pinned message caps at 4096 chars (~50 users). Document-based registry needed for scale.
- **`buildSnapshot` caps at 25 history items** — older items pruned from sync but remain in localStorage.
- **Vision limit** — `MAX_INLINE_IMAGE_BYTES = 1.7 MB`. Client-side compression keeps uploads under this.

---

## Research Artifacts

`research/gpai-research-report.md` documents GPAI feature findings, architecture decisions, and serverless recommendations.

---

## License

Private repository. All rights reserved.
