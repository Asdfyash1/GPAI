# GPAI Clone — Improvement & Fix Backlog

**Goal:** match and out-perform [gpai.app](https://gpai.app). Living checklist that any session can update. Mark items with one of:

- `[x]` = done and verified
- `[~]` = in progress / partially done / unverified
- `[ ]` = not started
- `[!]` = blocked (explain why)

**Each session must update this file after every fix/change. Commit it.**

Repo: `Asdfyash1/GPAI` · Active PR: [#8](https://github.com/Asdfyash1/GPAI/pull/8) · Branch: `devin/1777531056-chat-fixes-websearch-history`

---

## Critical bug fixes (do these first if any regress)

- [x] **🚨 Image upload returned a chemistry hallucination instead of the actual problem.** _Fixed in this PR (2026-04-30, session 31e08430bdfc4ab297d11563b7ab29d7) — branch `devin/1777554013-vision-fix-and-fallback`._ User uploaded a handwritten ODE `(D⁴ − 2D³ + D²)y = x³` and the Solver replied with a balanced redox equation about NO₂/O₃/SO₃. **Root cause:** the default vision model in `src/lib/vision.ts` was `mistralai/mistral-large-3-675b-instruct-2512`, which **does not exist** in NVIDIA NIM's catalog. Every vision call 404'd silently, the OCR transcription was empty, and the downstream Solver LLM invented a chemistry problem from nothing. **Fix (multi-part):**
  1. **Real vision models on NVIDIA** — switched to `meta/llama-3.2-11b-vision-instruct` (primary, ~3-7 s) with `meta/llama-3.2-90b-vision-instruct` as a slower fallback. Both env-var-overridable via `NVIDIA_VISION_MODEL` / `NVIDIA_VISION_FALLBACK_MODEL`.
  2. **Multi-provider OCR fallback chain:** NVIDIA → Google Gemini 2.0 Flash (free tier, opt-in via `GEMINI_API_KEY`) → Tesseract.js (offline WASM, no API key). First successful OCR wins; failures aggregate into an `[ATTACHMENT_UNREADABLE]` marker.
  3. **Hard-stop in the orchestrator** (`src/lib/orchestrator.ts`): if every uploaded attachment has `extractedText` starting with `ATTACHMENT_FAILURE_PREFIX`, both `runEducationalOrchestrator` and `streamEducationalSolverDraft` now return a deterministic markdown response ("I couldn't read your file, please re-upload …") and **never call the LLM**, eliminating the hallucination path entirely.
  4. **Sentinel `UNREADABLE:` from the model itself.** The vision prompt instructs the model to reply with `UNREADABLE: <reason>` when the image is blank/blurry. Both `tryNvidiaModel` and `tryGemini` recognise that sentinel and treat it as a failure so the fallback chain advances.
  5. **Backend test scripts** (`scripts/test-vision.ts`, `scripts/test-api.ts`) so future sessions can repro: `npx tsx scripts/test-vision.ts /tmp/test-ode.png` exercises the OCR chain, `npx tsx scripts/test-api.ts /tmp/test-ode.png` round-trips the full `/api/educate/stream` against a local dev server.
  6. **Removed leaked NVIDIA key.** Previous session pasted a key in chat — that key is treated as compromised, never committed, and a fresh session-only secret was used for testing.
  
  **Known limitation (open follow-up):** NIM's free-tier Llama-3.2-11B-Vision is deterministic but inconsistent on subtle handwritten exponents (e.g. it sometimes reads `D^4` as `D^5` or `D_1`). The chemistry-hallucination root cause is fixed, but for **reliable** handwritten-math accuracy, set `GEMINI_API_KEY` (free tier) — Gemini 2.0 Flash is dramatically more accurate on this kind of input. Tesseract.js is the last-resort fallback for environments with no cloud keys at all. _Files:_ `src/lib/vision.ts`, `src/lib/orchestrator.ts`, `package.json`, `scripts/test-vision.ts`, `scripts/test-api.ts`, `.gitignore`.

- [x] **🚨 Cheatsheet / Notebook / PDF Notes / Report Writer "Download" emitted `.md` instead of PDF.** _Fixed in this PR (2026-04-30, session 31e08430bdfc4ab297d11563b7ab29d7)._ All four views had a separate Download icon next to the Print/PDF button that wrote a `text/markdown` blob (`cheatsheet.md`, `pdf-notes-<ts>.md`, `<mode>-<ts>.md`, `<title>.md`). Upstream gpai.app's Export menu only ships PDF / DOCX / Copy — no `.md` — and our users expect a PDF when they click Download. Pointed all four Download buttons at the existing `handlePrint()` (which sets `body[data-printing="cheatsheet"|"document"]`, calls `window.print()`, has the mobile-`afterprint` backstop, and is already governed by the `@media print` rules in `globals.css`). User clicks Download → browser print dialog with "Save as PDF" — produces a real `.pdf`, not a `.md`. _Files:_ `src/components/CheatsheetView.tsx`, `src/components/DocumentView.tsx`, `src/components/NotebookView.tsx`, `src/components/PdfNotesView.tsx` (+ small refactor: extracted `handlePrint` in `PdfNotesView` so both buttons share it).

- [x] **🚨 Uploads + prompts in Notebook / PDF Notes / Report modes silently 400.** _Fixed in this PR (2026-04-30, session 31e08430bdfc4ab297d11563b7ab29d7)._ `src/components/NotebookView.tsx`, `src/components/PdfNotesView.tsx`, and `src/components/DocumentView.tsx` all POST to `/api/educate/stream` with `mode: "notebook"` / `"pdf-notes"` / `"report"`, but `isValidMode` in both `src/app/api/educate/stream/route.ts` and `src/app/api/educate/route.ts` only accepted `solver | visualizer | chat | cheatsheet`. Every submit in those three views returned `{ error: "A prompt and valid mode are required." }` with HTTP 400, the stream hook surfaced a generic error, and uploaded images / PDFs were never analyzed even though `analyzeUploadedImages` (PR #22) supports them. The orchestrator's `streamEducationalSolverDraft` and the prompt builders already key off `request.mode` and have system + task prompts for `notebook`, `pdf-notes`, and `report`, so the fix is a one-liner — widening `isValidMode` to accept all 7 `FeatureMode` values. _Files:_ `src/app/api/educate/stream/route.ts`, `src/app/api/educate/route.ts`. _Pass criteria:_ uploading the same handwritten ODE image into PDF Notes / Notebook / Report Writer streams a real response that references the operator equation instead of a 400 toast.

- [x] **🚨 Image upload to AI Solver returns the WRONG answer.** _Fixed in PR #22 (2026-04-30)._ Reproduced on 2026-04-30: uploading a 2.6 MB photo of a handwritten ODE `(D⁴ − 2D³ + D²) y = x³` produced a Solver answer about *electric potential of two charges* (`V_net = 2kQ/r`). The vision call ran ~3 min then the model hallucinated a problem because the failure mode silently feeds an `[Image analysis failed: ...]` string into the prompt and the LLM ignores it. **On the deployed Vercel preview the same submit just glitches back to the AI Solver hero** — almost certainly because the 2.6 MB base64 payload exceeds Vercel's 4.5 MB request body limit and/or the 60s function timeout for the vision call, so the request 413/504s and the client treats the abort as a reset. **Fix plan (single PR, multiple files):**
  1. **Client-side image compression** in `src/components/Composer.tsx`. When a chosen image is `> 1 MB` or `> 1600 px` on its long edge, draw it onto a hidden `<canvas>`, downscale to 1600 px max edge, and re-encode as JPEG `q=0.85` before stuffing into the `dataUrl`. Cuts a 2.6 MB photo to ~250 KB. Keep PDFs/text untouched.
  2. **Vision API timeout + smaller payload** in `src/lib/vision.ts`. Add an `AbortController` with a 45s deadline. Lower `max_tokens` from 2048 → 1024. Add an explicit error string that *names* the failure mode (`[Image analysis failed: timeout after 45s]` vs `[Image analysis failed: NVIDIA returned 429]`).
  3. **Hard-stop hallucination** in `src/lib/prompts.ts` `buildTaskPrompt`. When ANY attachment carries an `extractedText` starting with `[Image analysis failed`, `[PDF parse failed`, or `[…too large`, prepend a directive to the user prompt: *"An attachment was provided but could not be read. Do NOT guess at the problem. Reply with: 'I couldn't read your attachment — please re-upload …' and nothing else."* The `textbook` / `solver` system prompts must also forbid inventing a problem when no problem text exists.
  4. **Server-side body size guard** in `src/app/api/educate/stream/route.ts` and `src/app/api/educate/route.ts`. Reject `> 5 MB` payloads with HTTP 413 and a clear `{ error: "Attachment too large — please upload a smaller image (under 4 MB)." }` body that the client surfaces in a toast instead of "glitching back".
  5. **Client error toast** in Composer / SolverView. When `/api/educate/stream` returns non-200, show an inline error in the Solver view (`Could not solve: <reason>`) instead of resetting state. Today the stream hook just resets and the user thinks the click did nothing.
  - _Repro recording (failed run):_ saved to session attachments — solver answered electric-potential physics for the ODE image.
  - _Test image used:_ `~/attachments/9300a84a-8b57-4f0e-8366-34903ce7b721/763a6d0e-5169-4e94-906f-3884c39a546a.png` (handwritten `(D⁴ − 2D³ + D²)y = x³`, 1.95 MB on disk, 2.6 MB as base64).
  - _Pass criteria:_ on Vercel preview, uploading the same image → Solver streams a real solution that explicitly references the operator equation, gives `y_c = c₁ + c₂x + (c₃ + c₄x)e^x`, and computes a degree-5 particular integral for `x³`.

- [x] **🚨 Mobile print backstop missing in 3 of 4 print handlers.** _Fixed in PR #23 (2026-04-30)._ Devin Review on PR #19 (already merged) flagged that `afterprint` doesn't always fire on mobile browsers, leaving `body[data-printing="document"|"notebook"|"pdf-notes"]` set forever, which means `@media print { *:not(...) { visibility: hidden } }` blanks the *entire app* until a full page reload. `CheatsheetView` already has a 4 s backstop; `DocumentView`, `NotebookView`, `PdfNotesView` do not. **Fix:** in each handler, replace
  ```ts
  window.addEventListener("afterprint", cleanup);
  setTimeout(() => window.print(), 50);
  ```
  with
  ```ts
  window.addEventListener("afterprint", cleanup);
  const backstop = setTimeout(cleanup, 4000); // mobile browsers may never fire afterprint
  const oldCleanup = cleanup;
  cleanup = () => { clearTimeout(backstop); oldCleanup(); };
  requestAnimationFrame(() => window.print());
  ```
  _Files:_ `src/components/DocumentView.tsx`, `src/components/NotebookView.tsx`, `src/components/PdfNotesView.tsx`. Single small PR — branch was `devin/1777538776-print-backstop` (never finished).

- [x] **AI Chat: "hi" no longer triggers a Pythagorean essay even with Deep Explain ON.** Default `deepExplain=false`, server-side `isTrivialMessage` gate switches to conversational system prompt + `maxOutputTokens: 256` for small-talk. _Files:_ `src/lib/orchestrator.ts:262-318`, `src/components/ChatView.tsx:35`, `src/lib/prompts.ts` (chat prompt explicitly forbids "Understanding the …" essay opener).
- [x] **Mode tabs (AI Chat / Visualizer / More items) silently un-clickable when accessed via 127.0.0.1.** Next.js 16 dev server blocked HMR for any host other than `localhost`, leaving the page hydrated but with no event handlers — the page LOOKED rendered, but clicks went nowhere. _Fix:_ added `allowedDevOrigins: ["localhost", "127.0.0.1", "*.local"]` to `next.config.ts`. **Test by visiting `http://localhost:3000` (NOT `127.0.0.1`) AND `http://127.0.0.1:3000` — both must work.**
- [x] **Web search overhaul: parallel fan-out + ranked results + numbered citations + Sources pill stack.** Replaced the sequential Wikipedia REST + DDG Instant Answer pipeline with a parallel fan-out across Wikipedia search API (action=query → REST summaries for top 3), DDG Instant Answer, and DDG HTML SERP (top 5 organic results with page-snippet enrichment via `fetchPageSnippet`). All sources run via `Promise.allSettled` with a 4-second per-source timeout. Results are deduped by canonical host+path and ranked: wikipedia > ddg-ia > page > ddg-serp, capped at 5. The system prompt now injects numbered `[1] (url) title -- snippet` citations and instructs the model to cite inline as `[1], [2], ...`. The chat route appends a `<!-- SOURCES:...:SOURCES -->` trailer to the stream; ChatView parses it and renders a Sources pill stack (favicon + host + link) under each reply. Route backwards-compat preserved (`urls: string[]` still returned). _Files:_ `src/lib/web-search.ts`, `src/app/api/web-search/route.ts`, `src/app/api/chat/route.ts`, `src/lib/orchestrator.ts:417-419`, `src/components/ChatView.tsx`, `src/app/globals.css`.
- [x] **Chat history persists.** Stored in `localStorage` under `eduforge:chats`; appears in left rail Recent with per-mode badge; click-to-resume; trash-to-delete; survives reload. _Files:_ `src/components/EducationApp.tsx:28-115,140-211`, `src/components/Sidebar.tsx`, `src/app/globals.css`.
- [x] **Tightened system prompts for Chat / Solver / Visualizer / Cheatsheet / Report / PDF Notes / Notebook.** Anti-padding, no fake citations, strict LaTeX rules, no "As an AI…" / "Understanding the …" essay framings. _File:_ `src/lib/prompts.ts`.
- [x] **Chat duplicates every reply as a separate sidebar entry.** `handleChatMessagesChange` was minting a new `chat_<ts>` id on every call because the second call's closure still saw `activeChatId === null` (React hadn't committed the first `setActiveChatId`). _Fix:_ added `activeChatIdRef` mirror to read the freshly minted id synchronously. _File:_ `src/components/EducationApp.tsx`.
- [x] **Plain Enter sends in chat (Shift+Enter newline); long-form prompts still need Cmd/Ctrl+Enter.** Composer now takes an `enterToSend` prop wired from `ChatView`. _Files:_ `src/components/Composer.tsx:54-60,94-105`, `src/components/ChatView.tsx:155`.
- [x] **Chat history was being wiped on every page reload.** The persist-on-change `useEffect`s ran for the initial empty state BEFORE the load step (which was `queueMicrotask`-deferred), overwriting localStorage with `[]`. Added a `hydrated` ref the persist effects check; they no-op until the load step has populated state. Verified by sending a chat, hitting F5, and seeing the Recent entry survive + click-to-resume the thread. _File:_ `src/components/EducationApp.tsx:53-129`.

## High priority — gpai.app feature parity / outperform

- [x] **"Cross-checked" badge is real, not decorative.** After the primary stream completes, the streaming route runs a real second-model solve (a different model on the same provider, configurable via `NVIDIA_CROSSCHECK_MODEL`, falling back to nemotron→mistral→deepseek→llama) and asks an LLM judge to compare the two final answers. Tri-state badge:
  - `Cross-checked` (green) — models agree
  - `Minor mismatch` (amber) — equivalent up to rounding/units
  - `Models disagree` (red) — genuinely different conclusions, both shown in the tooltip
  - `Verifying` (grey) — request still in flight
  - `Cross-check skipped` (grey) — no secondary model configured or verifier failed

  _Files:_ `src/lib/orchestrator.ts` (`runCrossCheckOnAnswer`), `src/app/api/educate/stream/route.ts` (runs cross-check after the stream and emits it in the structured tail), `src/components/SolverView.tsx` (`CrossCheckBadge` component), `src/types/education.ts` (`CrossCheckResult`), `src/app/globals.css` (.cross-checked-pass / -minor / -fail / -pending / -skipped).
- [x] **Quota fallback to demo mode in chat.** When the primary NVIDIA call fails before sending a single chunk (e.g. 429 rate limit, upstream 5xx), the chat route silently retries with `modelChoice: "demo"` and emits a one-line "live model unavailable, falling back to a local demo answer" notice. _File:_ `src/app/api/chat/route.ts`.
- [x] **Shareable task URL.** Solves now share a canonical link `?taskId=<id>`. The `<ShareButton>` next to the solve title copies the link to clipboard (uses `navigator.share` when available) and on next page load `EducationApp` reads `?taskId` from `URLSearchParams` and opens the matching solve / chat from localStorage. _Caveat:_ same-device only — server-side cross-device sharing still requires a backing store (see open work below). _Files:_ `src/components/SolverView.tsx` (`ShareButton`), `src/components/EducationApp.tsx`.
- [x] **Quiz tab generates real questions in-place, doesn't replace the view.** New `POST /api/quiz` endpoint solves a strict-JSON quiz off the original problem + reference solution, and the Quiz rail now appends the parsed questions into `result.quiz` (so they render in the existing "Quick quiz" section beneath the solution) instead of re-issuing a follow-up that wipes the solver. Loading state, error message, and "+ Add 5 more questions" CTA included. _Files:_ `src/app/api/quiz/route.ts`, `src/components/SolverView.tsx`.
- [ ] **Cross-device shareable URL.** The `?taskId=` link only works on the same device. Add an opt-in publish endpoint (POST a solve to a server-side store, get back a short `/s/<slug>` URL) so users can paste a link in another browser / phone.
- [x] **In-context follow-up composer wired to the original problem.** Right-rail chips and "Ask about this problem" input now stream a follow-up answer into a Q&A timeline below them via `/api/chat`, instead of wiping the whole solver view by re-issuing the educate stream. A system primer feeds the model the original problem + the reference solution + the prior follow-ups so answers stay grounded. _Files:_ `src/components/SolverView.tsx` (`sendFollowUp`, thread state, JSX), `src/app/globals.css` (`.followup-thread`, `.followup-turn`, `.followup-q`, `.followup-a`, `.followup-pending`).
- [x] **Quiz: MCQ format with 4 options + reveal-per-question.** `/api/quiz` now accepts a `format` field (`"mcq"`, `"short"`, `"mixed"` — default mixed). The system prompt instructs the model to return a `choices: string[]` field per item when MCQ is required, with `answer` matching one of the choices verbatim. The route validates each MCQ item (drops `choices` if `< 3 options` or `answer` not in `choices`, falling back gracefully to short-answer rendering). `<QuizItem>` renders MCQ items as 4 radio-style buttons (A/B/C/D); on click, it locks the row and highlights the correct option green and the user's wrong pick red, plus a "Try again" button to reset. The right rail has a Format selector (Mixed / Multiple choice only / Short answer only). _Files:_ `src/types/education.ts`, `src/app/api/quiz/route.ts`, `src/components/SolverView.tsx` (`QuizItem`, rail UI), `src/app/globals.css` (`.quiz-choice*`, `.quiz-feedback*`).
- [x] **Visualizer: render-quality fixes for Mermaid diagrams + view-source / copy / SVG download.** Tightened the visualize spec system prompt with strict syntax rules ("ALWAYS quote node labels containing parentheses, colons, slashes; only ASCII identifiers; 5-12 nodes; no markdown inside the diagram block") so the LLM's Mermaid output is render-safe more often. Added a server-side `sanitizeMermaid()` pass that auto-quotes `[label (foo)]` / `((label: bar))` / `{label/baz}` so common LLM mis-quoting still renders. New `<DiagramView>` component shows a small toolbar with View Source toggle, Copy Mermaid source, and Download as SVG (serialised from the rendered DOM via `XMLSerializer`). _Files:_ `src/app/api/visualize/route.ts` (`specSystem`, `sanitizeMermaid`), `src/components/VisualizerView.tsx` (`DiagramView`), `src/app/globals.css` (`.diagram-toolbar`, `.diagram-source`).
- [x] **Visualizer: text-to-image fallback when LLM returns no diagram.** `/api/visualize` now does a stricter "ONLY a mermaid block" retry when the first spec call comes back without a parseable Mermaid block. If even the retry can't produce one and the user picked a non-illustration category, the route automatically runs the Flux illustration pipeline so the canvas always shows *some* visual instead of dropping to the prose-only `.visualizer-fallback`. Verification trail records whether the image came from the explicit illustration path or the diagram-fallback path. _Files:_ `src/app/api/visualize/route.ts`.
- [ ] **Visualizer: chemistry / SMILES rendering.** Today chemistry category goes to the illustration path (Flux) only. Add SMILES → SVG via a small client-side library (e.g. SmilesDrawer) so a chem prompt can produce a real molecule diagram.
- [x] **Cheatsheet: A4-printable density.** The Cheatsheet "Print / PDF" button used to open a popup window, write injected HTML, and fight ad-blockers. Replaced with `window.print()` plus a real `@media print` stylesheet that flips a `body[data-printing="cheatsheet"]` marker, hides every element except the `.cheatsheet-page` article, reflows it to A4 (`@page size: A4; margin: 12mm`) with `columns: 2; column-gap: 14mm; font-size: 9pt`. The `afterprint` event clears the marker so the live UI snaps back. Prompt was already tuned (`cheatsheetSystemPrompt` in `src/lib/prompts.ts`); UI gap is closed. _Files:_ `src/components/CheatsheetView.tsx` (`handlePrint`), `src/app/globals.css` (`@media print`).
- [x] **Report Writer / PDF Notes / Notebook: structured exports.** All three views' Print/PDF buttons used to spawn a popup window, write injected HTML, and re-link KaTeX from a CDN — same anti-pattern PR #11 already fixed for the Cheatsheet. Replaced with `window.print()` + a `body[data-printing="document"]` marker and an `@media print` rule that hides everything except the `.document-page` article (Notebook reuses the same shell), reflows it to A4, forces `color: #111` and `background: transparent` on every descendant so the dark theme palette doesn't survive into the printed page, and wires `afterprint` cleanup. Print/PDF is also now disabled until the body has streamed in. _Files:_ `src/components/DocumentView.tsx`, `src/components/NotebookView.tsx`, `src/components/PdfNotesView.tsx`, `src/app/globals.css` (`@media print` `body[data-printing="document"]`).
- [ ] **Light theme polish.** Confirm dark + light themes both look right in solver / chat / cheatsheet. Today there's a theme toggle in the topbar but several views were styled for dark only.

## Medium priority

- [ ] **Solver: render Verification + Common-mistakes + Key-concepts sections inline,** not just at the end. The current `textbookSystemPrompt` prescribes order; verify the renderer respects it.
- [ ] **Better empty states.** Sidebar Recent currently says "No items yet" — add a one-liner CTA like "Solve your first problem to see it here". Visualizer / Cheatsheet / Report empty states could be more inviting.
- [ ] **Keyboard shortcuts.** `Cmd/Ctrl+K` for command palette / mode-switch, `Cmd/Ctrl+/` for help. Today there are none.
- [x] **Multimodal input.** Composer accepts attachments and `analyzeUploadedImages` now extracts text from images (NVIDIA vision), PDFs (unpdf), and text-like files (UTF-8 decode). Extracted text is injected into the prompt via the existing `attachmentSummary` block in `src/lib/prompts.ts`.
- [ ] **YouTube / web URL ingestion.** gpai.app composer footer says "Add PDF, image (JPG, PNG), website and Youtube link". Today we accept files; add URL paste that fetches the page (and YouTube transcript via `youtubetranscript`-style endpoint) and injects as context.
- [ ] **Streaming "Thinking…" steps.** Already exists (`THINKING_STEPS` in `SolverView.tsx`); verify it actually advances during streaming, not just on a 1.1s timer.
- [ ] **Better error messages.** Today a failed `/api/educate/stream` shows generic `error.message`. Surface friendlier "We couldn't reach the model — try again?" with a retry button.
- [ ] **Quota fallback to demo mode.** When `NVIDIA_API_KEY` upstream returns 429 / 5xx, fall back to `demoChatStream` so the user gets *something* instead of a broken stream.
- [ ] **Composer attachments visible after send.** When a user attaches a file in chat and sends, the attachment row clears — but there's no visual chip in the user-message bubble showing what was sent. Add a small attachment-chip in the rendered chat bubble.
- [ ] **Mode badge color polish.** Recent items have a per-mode letter badge (`C / S / V / etc`); colors are inconsistent. Audit `.recent-mode.mode-*` rules in `src/app/globals.css` and align with the mode tab icon colors.
- [ ] **Mobile responsiveness.** The sidebar+main layout breaks below ~720px. Add a hamburger to collapse the sidebar on small screens.

## Low priority / nice-to-have

- [ ] **Auth.** No login today. Add Google/Apple OAuth + an email magic-link path so chats can sync across devices.
- [ ] **Server-side history sync.** Today `eduforge:chats` is local-only. Add Supabase / Postgres + `/api/chats` so history follows the user across devices.
- [ ] **Model picker UX.** Composer shows a pill labelled "Auto" today; clicking it should open a model picker with cost/quality stats per model.
- [ ] **Telemetry.** Add anonymous usage events so we can see which modes get used.
- [ ] **Onboarding tour.** First-visit modal walking through Solver → Chat → Visualizer → Cheatsheet.
- [ ] **Light-mode cheatsheet print test.** End-to-end: request a cheatsheet, hit Print, verify the PDF is one A4 page.
- [ ] **A11y pass.** Tab order, aria-labels, focus rings — none have been audited.
- [ ] **i18n.** UI is English-only.

## Tooling / DevOps

- [x] `next.config.ts` `allowedDevOrigins` — done above.
- [ ] **Vercel preview previews failing on PRs.** CI shows 1 failed Vercel deployment with: _"No GitHub account was found matching the commit author email address."_ The fix is to use a commit author email tied to a GitHub account (e.g. `Asdfyash1@users.noreply.github.com`). Owner of the repo needs to either set that as the commit-email or remove the gate in Vercel settings.
- [ ] **CI: add `npm run lint` + `npm run build` jobs.** Today only Vercel preview runs. Add a GitHub Action so PRs are gated on lint+build green.
- [ ] **Pre-commit hooks.** No `.pre-commit-config.yaml` today; consider adding `eslint --fix` + `prettier --check` on staged files.
- [ ] **Snapshot tests.** No tests at all today. Even one Playwright smoke test that boots the app and asserts the four mode tabs are clickable would catch the kind of regression we just had.

## Notes for future sessions

- The dev server logs to `/tmp/dev.log` (not `dev.log` in the repo). Tail with `tail -f /tmp/dev.log`.
- gpai.app's free plan gives 50 credits and exhausts quickly — Solver = 30 credits, Chat = 1 credit/turn. If you need to compare side-by-side, ask the user for a fresh email / paid account because tearing through 50 credits in a single session is normal.
- Repo-scoped secrets: `NVIDIA_API_KEY` is org-saved; Devin envs auto-inject it on session boot (per the env config that was approved).
- Repo's CLAUDE/AGENTS rule says: read `node_modules/next/dist/docs/` before changing anything Next.js-API-shaped, because Next 16 has breaking changes vs. training data.

## Feature planning — proposals not yet started

These are gpai.app gaps and outperform-opportunities that haven't been scoped into a PR yet. Promote them up into the High / Medium priority lists with concrete file references when work begins.

- **Cross-device shareable URL via `/api/publish`.** Today `?taskId=<id>` only works on the same device because solves live in `localStorage`. Need an opt-in publish endpoint: POST a solve to a server-side store (KV / SQLite / file blob), get back `/s/<slug>`. On GET, hydrate the solve into the existing `taskId` flow. Should support solver, chat threads, and cheatsheets uniformly.
- **Light theme polish.** There's a topbar theme toggle but several views were styled for dark only. Audit `solver-view`, `chat`, `cheatsheet-page`, `notebook-page`, `visualizer-canvas` against `[data-theme="light"]` and ship token-only fixes.
- **Visualizer: chemistry / SMILES rendering.** Today chemistry category routes to Flux only. Add SMILES → SVG via SmilesDrawer or RDKit-WASM so a SMILES string in the prompt produces a real molecule diagram alongside any illustration.
- **Solver: step-by-step reveal mode.** Hide subsequent steps behind a "Show next step" button so students can attempt before peeking. gpai.app does this; we currently dump all steps at once.
- **Chat: image-output answers.** When the chat prompt is "show me a diagram of X" and Web Search is off, route through `/api/visualize` and inline the resulting image in the chat reply (similar to how Sources stack renders today).
- **Cheatsheet: per-section regenerate.** Right now you regenerate the whole sheet. Let the user click any heading to refresh just that section without losing the rest.
- **Mobile / responsive pass.** The right-rail collapses, but the composer + topbar haven't been audited at 360px. Add a responsive breakpoint sweep.
- **Print backstop timeout (mobile).** `afterprint` doesn't always fire on mobile browsers, so `body[data-printing]` can stay set forever and `visibility: hidden` blanks the entire UI. Wrap every print handler (`CheatsheetView`, `DocumentView`, `NotebookView`, `PdfNotesView`) in a `setTimeout(cleanup, 4000)` backstop.
- **Solver: voice-in / dictation.** Wire the existing mic icon to the Web Speech API.
- **Solver: handwriting / inkboard input.** Free-draw a problem on a canvas, OCR via the existing vision pipeline, route to solver. gpai.app teases this.
- **Notebook: nested folders.** Pages today are flat. Add a folder tree in the left rail (already a sidebar slot for it).
- **Quiz: spaced-repetition review queue.** Persist quiz results, surface "due for review" cards on the home screen.
- **Settings page.** Today there's no place to switch model defaults, manage saved chats in bulk, or see remaining quota. Add a real `/settings` route.

## Next-session priority order (read this first)

If you only have a few hours, ship in this order — each one is independently small enough to be a single PR:

1. **Image upload bug** (top of Critical bugs) — single biggest user-visible issue. Branch off `main` as `devin/<ts>-image-solver-fix`. Touch ~5 files. Test on Vercel preview by uploading the same handwritten ODE image.
2. **Mobile print backstop** (second item in Critical bugs) — 4-line change × 3 files. Branch `devin/<ts>-print-backstop`.
3. **Cross-device shareable URL `/api/publish`** — see Feature planning. Without this, `?taskId=` is useless across devices and "share" UX feels broken.
4. **Light theme polish** — there's a topbar toggle but several views were dark-only. Audit `solver-view`, `chat`, `cheatsheet-page`, `notebook-page`, `visualizer-canvas` against `[data-theme="light"]`.
5. **Visualizer SMILES rendering** for chemistry prompts.
6. **Solver step-by-step reveal mode** (gpai.app does this; we dump all steps at once).
7. Items 6-13 in Feature planning, in any order.

After each PR: run `npm run lint`, `npx tsc --noEmit`, then `git_pr(action="create")` after `git_pr(action="fetch_template")`. Wait for CI green via `git(action="pr_checks")`. Append a Changelog entry below and tick the BACKLOG checkbox in the same PR.

## Open Devin Review findings (carry-over across sessions)

- **PR #17 (solver follow-up thread, merged):** new Devin Review batch flagged 5+ additional findings on 2026-04-30. Not yet read or addressed. To inspect: `git(action="view_pr", repo="Asdfyash1/GPAI", pull_number=17)`.
- **PR #19 (PDF export, merged):** print backstop finding — captured as the second Critical bug above.

## Changelog (append-only — every session adds an entry)

- **2026-04-30 — Devin (session 31e08430bdfc4ab297d11563b7ab29d7) — research + brand + cheatsheet PDF download:** _PR #25._
  - **`research/gpai-features-reference.md`** — full info.md walkthrough of gpai.app for Cheatsheet Builder, Report Writer, PDF Notes, Notebook (+ Solver / Visualizer / Chat for context). 21 embedded screenshots in `research/screenshots/`. Feature-by-feature UX shape, modal contents, URL patterns, source types, output structure (LaTeX + Mermaid + bullets + tables), exports, daily quotas, sticky outlines, font-size controls, `beforeunload` guards, etc. Future sessions should read this before re-walking gpai.app.
  - **Brand: `eduForge` → `Forge`.** Updated `src/app/layout.tsx` `metadata.title` to "Forge — STEM Copilot", `metadata.description` to cover all 7 features, and added an `icons` block linking the new SVG favicon. Replaced the sidebar wordmark, Solver share-sheet title, web-search User-Agent, `globals.css` header comment, and `README.md` heading. Tagline: "STEM Copilot that actually thinks". (Open: future session may want to roll the rebrand into more places — search for stale `eduForge` references in any new copy.)
  - **Favicon** — added `public/favicon.svg`. Geometric "F" monogram in white on a vertical orange→deep-orange gradient (#FF8A3D → #E2552A) with a small spark to evoke "forge". Vector, scales for any tab/icon size. Falls back to the existing `src/app/favicon.ico` for browsers that don't speak SVG.
  - **Cheatsheet / Notebook / PDF Notes / Report Writer Download `.md` → PDF fix.** All four views had a Download icon that wrote a `text/markdown` blob. Pointed every one at the existing `handlePrint()` so clicking Download opens the browser's print dialog (where "Save as PDF" is the default). Added a small `handlePrint` extraction in `PdfNotesView` so both Print and Download share the same logic. Upstream gpai.app does not ship a `.md` export — Cheatsheet downloads `.pdf`, Report Writer Export menu has Copy / PDF / DOCX. We now match the PDF half. (DOCX is a follow-up — see Gap analysis #3 in the research doc.)
  - **BACKLOG.md** — promoted the `.md`-instead-of-PDF bug into Critical (since the user reported it explicitly), and added this changelog entry.
  - Verified `npm run lint` + `npx tsc --noEmit` pass clean.

- **2026-04-30 — Devin (session 31e08430bdfc4ab297d11563b7ab29d7) — fix: Notebook / PDF Notes / Report uploads:**
  - Both `/api/educate/route.ts` and `/api/educate/stream/route.ts` rejected every mode except `solver | visualizer | chat | cheatsheet` via a too-narrow `isValidMode` check, even though the orchestrator + prompt builders already supported `notebook | pdf-notes | report`. Result: any submit in NotebookView / PdfNotesView / DocumentView (Report Writer) returned HTTP 400 with `{ error: "A prompt and valid mode are required." }`, so the entire feature was a dead-end no matter how good `analyzeUploadedImages` was. The image / PDF was never even sent to the vision pipeline.
  - Widened `isValidMode` in both routes to accept all 7 `FeatureMode` values. No prompt or orchestrator changes needed — `getSystemPrompt(mode)` and `buildTaskPrompt(request)` already key off mode and were fully wired up for the three "document" modes from earlier PRs.
  - Verified `npm run lint` + `npx tsc --noEmit` pass clean.
  - This finally makes the user's reported "uploaded images aren't identified in features beyond Solver" work end-to-end. The PR #22 vision pipeline (compression, timeout, failure markers, body guard) is intact; this is the missing route-validation piece on top of it.

- **2026-04-30 — Devin (session c9b3978799c6407c9f7acc3acb4173ec) — mobile print backstop:** PR #23.
  - `DocumentView`, `NotebookView`, `PdfNotesView` print handlers now register a `setTimeout(cleanup, 4000)` backstop alongside the `afterprint` listener and replace `setTimeout(window.print, 50)` with `requestAnimationFrame(window.print)`. Matches the pattern `CheatsheetView` already used. Closes the second critical bug (PR #19 Devin Review finding) — `body[data-printing]` will no longer get stuck on mobile browsers that never fire `afterprint`, so the UI can't get blanked indefinitely after a print attempt.

- **2026-04-30 — Devin (session c9b3978799c6407c9f7acc3acb4173ec) — image-upload Solver fix:** PR #22.
  - **Composer client-side image compression.** Images > 1 MB or > 1600 px on long edge are downscaled to 1600 px max edge and re-encoded as JPEG q=0.85 onto a hidden canvas before being base64'd into the dataURL. PDFs and text files passed through untouched. Cuts a 2.6 MB photo to ~250 KB so it fits Vercel's 4.5 MB body limit and the vision call returns in ~10s instead of timing out.
  - **Vision pipeline reliability.** `src/lib/vision.ts` now wraps the NVIDIA call in an `AbortController` with a 45s deadline and lowers `max_tokens` to 1024. Failure messages are now prefixed with `[ATTACHMENT_UNREADABLE]` and name the failure (`timeout after 45s`, `NVIDIA returned 429: ...`, etc.) instead of an opaque "[Image analysis failed]".
  - **Hallucination hard-stop.** `src/lib/prompts.ts` `buildTaskPrompt` detects any `[ATTACHMENT_UNREADABLE]` extractedText and appends a `[SERVER NOTICE]` instructing the model not to invent a problem; the textbook system prompt now has an explicit Attachments policy clause that mirrors this.
  - **Server-side body guard** (HTTP 413) on both `/api/educate/stream` and `/api/educate` for payloads > 5 MB, with a clear JSON `error` field.
  - **Client error surfacing.** `useStream` now parses JSON error bodies properly. `SolverView` shows an inline `Could not solve` block with a "Back to composer" button instead of silently glitching back to the hero (root cause of the Vercel preview symptom: when the request errored, `streamText` reset and `showResults` flipped false → SolverHero re-rendered with no error visible).

- **2026-04-30 — Devin (session c9b3978799c6407c9f7acc3acb4173ec) — image-upload bug captured + remaining roadmap pushed:**
  - Reproduced the image-upload regression locally: uploading a 2.6 MB photo of a handwritten ODE caused the Solver to answer a completely unrelated electric-potential problem (vision call ran ~3 min then the LLM hallucinated). On Vercel preview the same submit "glitches back" to the Solver hero — strongly indicates payload-size / function-timeout abort.
  - Documented the 5-step fix plan as the top Critical bug entry (client-side compression, vision timeout, hallucination hard-stop in prompts, server-side body guard, error toast).
  - Added "Next-session priority order" + "Open Devin Review findings" sections so the next session has a 1-screen handoff.
  - Promoted the mobile print backstop (PR #19 review finding) into Critical bugs from the previous session's Feature planning slot.

- **2026-04-30 — Devin (session c9b3978799c6407c9f7acc3acb4173ec) — Visualizer fallback + Feature planning:**
  - When `/api/visualize` returns no parseable Mermaid block on the first spec call, do exactly one stricter retry asking for ONLY the mermaid code block. If that retry also fails for a non-illustration category, automatically run the Flux illustration pipeline so the canvas is never empty.
  - Added a "Feature planning" section to BACKLOG.md tracking proposals (cross-device share, light theme, SMILES, step-by-step reveal, image-output chat, per-section cheatsheet regen, responsive pass, print backstop timeout, voice / inkboard input, notebook folders, spaced-repetition review, /settings).
- **2026-04-30 — Devin (session c9b3978799c6407c9f7acc3acb4173ec) — Report / Notebook / PDF-Notes export:**
  - Replaced popup-based print path in `DocumentView`, `NotebookView`, and `PdfNotesView` with the same `window.print()` + `data-printing="document"` marker pattern Cheatsheet already uses.
  - Added an `@media print` block scoped to `body[data-printing="document"] .document-page` that hides the rest of the chrome, forces white background + `#111` text on every descendant (so dark-theme colours don't survive into the printed page), and reflows headings to A4-friendly point sizes.
  - Print/PDF buttons now disable when there's no streamed content.
- **2026-04-30 — Devin (session c9b3978799c6407c9f7acc3acb4173ec) — solver follow-up thread:**
  - Right-rail chips and "Ask about this problem" input no longer wipe the solver view. They call `sendFollowUp(question)` which streams a response from `/api/chat` into a Q&A timeline anchored under the answer.
  - Stale-closure fix on the streaming-update index: `nextIdxRef` hands out unique stable indices and a `threadRef` mirror feeds the prior-turns primer so concurrent follow-ups don't corrupt each other's streams.
  - Chips / input / Send disabled while any turn is streaming.
- **2026-04-30 — Devin (session c9b3978799c6407c9f7acc3acb4173ec) — attachment ingest:**
  - PDF and text-file uploads were silently broken — Composer accepted them but `analyzeUploadedImages` only filled `extractedText` for image MIME types.
  - `src/lib/vision.ts` now also handles PDFs (via `unpdf` — same lib used by `/api/parse-pdf`) and text-like files (`.txt`, `.md`, `.csv`, `.tsv`, `.json`, `.xml`, `.yaml`, `.log`, source code) via UTF-8 decode of the data URL.
  - Per-file limits: PDFs ≤ 25 MB, text files ≤ 2 MB, extracted text truncated to 12,000 chars with a `[…document truncated]` marker so the model still gets a coherent excerpt.
  - Composer's `accept` attribute expanded to advertise the newly supported types.
- **2026-04-30 — Devin (session c9b3978799c6407c9f7acc3acb4173ec) — quiz MCQ:**
  - `/api/quiz` accepts a `format: "mcq" | "short" | "mixed"` field (default `mixed`). System prompt asks for a `choices` array of 4 plausible options on MCQ items with `answer` matching verbatim.
  - Server-side validator only keeps `choices` when there are ≥3 options AND the answer matches one — otherwise gracefully falls back to short-answer.
  - `<QuizItem>` renders MCQ items as A/B/C/D buttons. On click, the row locks, the correct option turns green, and (if user picked wrong) the wrong option turns red. "Try again" resets state.
  - Right rail has a Format dropdown (Mixed / MCQ / Short answer).
- **2026-04-30 — Devin (session c9b3978799c6407c9f7acc3acb4173ec) — visualizer mermaid:**
  - Tighter visualize spec system prompt: strict Mermaid syntax rules (quote labels with `()` / `:` / `/`, ASCII-only IDs, 5-12 nodes, no markdown inside the diagram block).
  - Server-side `sanitizeMermaid()` auto-fixes the most common LLM mis-quotings before sending the spec back to the client.
  - New `<DiagramView>` component with a toolbar: **View Source** toggle, **Copy Mermaid source**, **Download as SVG** (serialises the rendered SVG via `XMLSerializer` and triggers a blob download).
- **2026-04-30 — Devin (session c9b3978799c6407c9f7acc3acb4173ec) — cheatsheet A4 print:**
  - Cheatsheet print no longer opens a popup window. `handlePrint` flips `document.body.dataset.printing = "cheatsheet"` then calls `window.print()`. A new `@media print` block in `globals.css` reads the body marker, hides every element except `.cheatsheet-page`, and reflows the page to true A4 (`@page size: A4; margin: 12mm`, `columns: 2; column-gap: 14mm; font-size: 9pt`). `afterprint` event clears the marker so the live UI returns to normal.
- **2026-04-30 — Devin (session c9b3978799c6407c9f7acc3acb4173ec) — PR #8 (merged):** Created this file. Done so far:
  - Small-talk gate for chat (`isTrivialMessage`).
  - `next.config.ts allowedDevOrigins` fix — was the root cause of "tabs unclickable" (Next.js 16 was blocking HMR for non-localhost hosts so handlers never attached).
  - Web search backend + DDG HTML SERP fallback for sparse Instant Answer queries.
  - Tightened prompts across all features.
  - Chat history persistence: localStorage + sidebar Recent + per-mode badge + click-resume + delete.
  - Fixed duplicate sidebar entries on every assistant reply (`activeChatIdRef` mirror).
  - Fixed chat history wiped on reload (persist-after-hydrate guard).
  - Plain Enter sends in chat; Shift+Enter newline.
  - End-to-end verified: tab switching, "hi" + Deep Explain → 21-char reply, integration-by-parts → LaTeX answer, F5 reload preserves Recent + click-restores thread, `/api/web-search` returns real Wikipedia URLs.
- **2026-04-30 — Devin (session c9b3978799c6407c9f7acc3acb4173ec) — share + quiz endpoint:**
  - `<ShareButton>` next to the solve title copies a canonical `?taskId=<id>` link to clipboard (with `navigator.share` fallback). `EducationApp` honors that param on load and opens the matching solve / chat from localStorage. Same-device only — cross-device share would need a server-side store.
  - `POST /api/quiz` returns strict JSON quiz items grounded in the user's solution. Quiz rail now calls this endpoint and appends questions in place, so the solver view is preserved. Loading + error states wired in `SolverView` (`handleGenerateQuiz`).
- **2026-04-30 — Devin (session c9b3978799c6407c9f7acc3acb4173ec) — follow-up PR (cross-check + quota fallback):**
  - Real cross-check pipeline: `runCrossCheckOnAnswer` in `orchestrator.ts` solves the problem with a secondary model, then asks an LLM judge to label `AGREE / MINOR / DISAGREE`. The streaming route awaits this after the user has the primary answer and emits it in the structured tail.
  - Replaced the always-green "Cross-checked" pill with a real `CrossCheckBadge` component (5 states: pass / minor / fail / pending / skipped) including a tooltip with both candidate answers when models disagree.
  - Added `crossCheck?: CrossCheckResult` to the `EducationResponse` type and matching CSS variants.
  - Quota fallback in `/api/chat`: if the primary NVIDIA call dies before a single chunk streams, silently fall back to the demo provider with a one-line notice instead of leaving the user staring at an error bubble.
- **2026-04-30 — Devin (session a8d98ff2d65c417f840ab00e696da598) — web search overhaul:**
  - Replaced sequential Wikipedia REST + DDG IA pipeline with parallel fan-out (`Promise.allSettled` + 4 s per-source timeout) across: Wikipedia search API (`action=query, list=search`) → REST summaries for top 3 titles; DDG Instant Answer; DDG HTML SERP (top 5 organic results) with page-snippet enrichment via `fetchPageSnippet(url)`.
  - Results deduped by canonical host+path, ranked wikipedia > ddg-ia > page > ddg-serp, capped at 5.
  - `formatWebContext` now emits numbered `[1] (url) title -- snippet` block with citation instructions for the model.
  - Chat system prompt injects the citation block; model told to cite `[1], [2], ...` inline.
  - Chat route appends `<!-- SOURCES:JSON:SOURCES -->` trailer; ChatView parses it and renders a Sources pill stack (favicon + host + clickable link) under each reply.
  - `/api/web-search` route returns both `results: SearchResult[]` and `urls: string[]` for backwards compatibility.
  - CSS for `.sources-pills`, `.source-pill`, `.source-favicon`, `.source-host`, `.source-index` added to `globals.css`.
- **2026-04-30 — Devin (session 31e08430bdfc4ab297d11563b7ab29d7) — vision OCR fix:**
  - **Root cause of the "image upload returns chemistry hallucination" bug:** default vision model in `src/lib/vision.ts` was `mistralai/mistral-large-3-675b-instruct-2512` — a model that does NOT exist in NVIDIA NIM's catalog. Calls 404'd silently, OCR was empty, the Solver LLM invented a chemistry redox problem from nothing.
  - **Switched to real NVIDIA NIM vision models:** `meta/llama-3.2-11b-vision-instruct` (primary, ~3-7s) with `meta/llama-3.2-90b-vision-instruct` as a fallback. Env-var-overridable.
  - **Multi-provider OCR fallback chain:** NVIDIA → Google Gemini 2.0 Flash (free tier, opt-in via `GEMINI_API_KEY`) → Tesseract.js (offline WASM, no API key). First success wins; failures aggregate into an `[ATTACHMENT_UNREADABLE]` marker.
  - **Hard-stop in `src/lib/orchestrator.ts`:** if every uploaded attachment has an `extractedText` starting with `ATTACHMENT_FAILURE_PREFIX`, both `runEducationalOrchestrator` and `streamEducationalSolverDraft` short-circuit with a deterministic markdown response ("I couldn't read your file …") and **never call the LLM**, eliminating the hallucination path completely.
  - **Self-reported `UNREADABLE:` sentinel:** vision prompt instructs the model to emit `UNREADABLE: <reason>` when the image is blank/blurry. NVIDIA + Gemini provider wrappers now treat that as a failure so the chain advances.
  - **Backend test scripts:** `scripts/test-vision.ts` (tests the OCR chain in isolation) and `scripts/test-api.ts` (round-trips the full `/api/educate/stream`). Use with `npx tsx scripts/test-vision.ts <image>`.
  - **Verified end-to-end:** `npx tsx scripts/test-api.ts /tmp/test-ode-compressed.jpg` against `npm run dev` returned a 4th-order linear ODE solution in 51.8s (vs. previous chemistry hallucination). Lint + typecheck + Next.js build all clean.
  - **Known limitation:** NIM Llama-3.2-11B-Vision is deterministic but inconsistent on subtle handwritten exponents (sometimes reads `D^4` as `D^5`/`D_1`). The chemistry-hallucination root cause is fixed — the answer is now in the right subject area — but for **reliable** handwriting accuracy users should set `GEMINI_API_KEY` (free tier). 90B is more accurate but consistently times out at 40s on NIM's free tier so it sits as a fallback.
  - **Removed leaked NVIDIA key.** Previous session pasted a key in chat — that key is treated as compromised, never committed, and a fresh session-only secret was used for testing.
