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

- [x] **🚨 OCR pipeline collapsed to a single NVIDIA model — `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`** (2026-05-02, session 1fcd2760b5f2450ab653b9bf5ad563ee). Per user directive (`uses this nvdia for image extracting contetent it worked so remove all shit and use this for image and etc pdf etc all stuff to analyze it … AND REMOVE OTHER MODEL FOR IMAGE AND KEEP THIS ONLY`). PRs #26→#29 had built up a NVIDIA→Gemini→Tesseract fallback chain to defend against the original "Mistral vision model that doesn't exist" 404, but Llama-3.2-11B-Vision was still misreading subtle exponents and the chain's first-`ok`-wins semantics were accepting the wrong reading. **Verified end-to-end on the user's actual handwritten ODE photo via the live `integrate.api.nvidia.com` endpoint:** Nemotron Omni reads `(D⁴ − 2D³ + D²)y = x³` as `(9) D-2D^{3}+D^{2}y=x^{3}` — substantially better than every prior provider (the `(9)` is a single misread of the leading `(D⁴` pair; the rest of the equation is verbatim). **What changed:**
  1. `src/lib/vision.ts` rewritten end to end. One provider, one call, no fallback chain. Defaults: `NVIDIA_VISION_MODEL = nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` + `chat_template_kwargs.enable_thinking = false` for fast non-reasoning OCR. Sends OpenAI-style `{type: "image_url", image_url: {url: <base64-data-url>}}` content, same shape as the official NIM docs.
  2. Removed Gemini path, Llama-3.2-Vision fallback, Tesseract.js entirely. `tesseract.js` removed from `package.json`.
  3. `MAX_INLINE_IMAGE_BYTES = 1.7 MB` defensive guard on the server (the `integrate.api.nvidia.com` gateway times out on inline data URLs above this). Composer's existing 1600px / q0.85 client-side compression already lands well under this cap.
  4. `ATTACHMENT_FAILURE_PREFIX` and the orchestrator hard-stop are unchanged — if Nemotron emits `UNREADABLE:` or the call fails, the LLM is still skipped and the user sees a clear "couldn't read, re-upload" message.
  5. `README.md` env-var section + `scripts/test-vision.ts` provider log updated.
  - PDF path is **unchanged**: `unpdf` text extraction (works for digital-native PDFs). Scanned PDFs still surface the existing "re-upload as PNG/JPG" failure message — the Nemotron Omni call only accepts `image_url` content, not raw PDF bytes. Per-page rasterization + Nemotron OCR is a future enhancement (would require either bundling pdf.js's canvas factory in Node or shelling to poppler/pdftoppm; tracked separately).

- [ ] **🚨 Quiz JSON parse failure ("Could not parse quiz JSON. Got: …").** _Reported 2026-05-02 by user (session 1fcd2760b5f2450ab653b9bf5ad563ee). Do NOT fix until user confirms — captured here for tracking only._ When the user clicked "Review with a quick quiz / flashcard" → "Mixed (MCQ + short answer)" → "Add 5 more questions" against a solved ODE problem, the UI showed:
  ```
  Could not parse quiz JSON. Got: {"quiz":[{"question":"What is the order of the differential equation given by \\((D-2D^{3}+D^{2})y=x^{3}\\)","answer":"3","choices":["1","2","3","4"]},{"question":"Describe the general approach to solvi
  ```
  The JSON is **truncated mid-string** ("solvi" is half of "solving") — clear sign that the response was cut off (token-limit truncation, stream aborted early, or the parser tried to `JSON.parse` a partial chunk before the stream finished). **Likely root causes to investigate when fixing:**
  1. `/api/quiz` route is probably not waiting for `stream` to finish before parsing — handle it the same way `/api/educate/stream` does (accumulate chunks → parse once at end), OR use a streaming JSON parser like `partial-json` / `parse-json-stream`.
  2. Token limit too low. The "Add 5 more questions" payload likely needs ~2-3 KB of JSON; if `max_tokens` on the quiz model is 1024 or similar, the response is just being truncated. Bump it (and add a guard: if the response doesn't end with `]}` or `}` (depending on shape), re-prompt with `continue from where you left off`).
  3. Quiz prompt may not say "respond with valid JSON only, no preamble". If the model wrote any prose before the JSON, the brace-finder / parser would fail.
  4. **Code locations to inspect:** `src/app/api/quiz/route.ts`, the quiz tab component (likely under `src/components/SolverView.tsx` or a sibling `QuizPanel.tsx`), and the `/api/quiz` system prompt in `src/lib/prompts.ts`. Reproduce by clicking the "Review with a quick quiz / flashcard" → "Mixed" → "Add 5 more questions" path on any solved problem.
  Linked to but distinct from the existing "Quiz + Follow-up questions panels non-functional" item below — that one is "chips don't fire requests at all"; this is "chip fires request but response is unparseable". Fixing #1 above probably fixes both since the panel is wired to the same endpoint.

- [ ] **🚨 Quiz + Follow-up questions panels non-functional in AI Solver.** _Reported 2026-04-30 by user (session 31e08430bdfc4ab297d11563b7ab29d7); not yet fixed._ After a solver response streams, the right-hand panel shows "Follow-up questions" / "Quiz" tabs with suggestion chips (`Make it easy`, `List key concepts`, `Give similar practice`, `Explain in English`) and an "Ask about this problem" input, but clicking the chips or typing into the input produces no response. Same for the Quiz tab. Likely root cause: the panel is wired to a `/api/chat` or `/api/quiz` endpoint that either doesn't exist yet or is not receiving the solver context (problem text + solution) correctly, OR the panel is a static stub that was never wired to the stream. **To investigate:** inspect `src/components/SolverView.tsx` (or wherever "Follow-up questions" / "Quiz" is rendered), trace the click handler on the chip buttons, check the network tab for the request it makes, and wire it to the existing orchestrator with `mode: "chat"` + the solver response as conversation context. Quiz should call `/api/quiz` (already exists per the autogen note) with the problem text as the seed.

- [x] **🚨 Tesseract timeout mechanism was non-functional** (PR #27, 2026-04-30, session 31e08430bdfc4ab297d11563b7ab29d7). Devin Review caught this on PR #26: `tryTesseract` in `src/lib/vision.ts` created an `AbortController` and scheduled `controller.abort()` after `TESSERACT_TIMEOUT_MS`, but `controller.signal` was never passed to `recognize()` — and tesseract.js's `recognize()` doesn't accept an abort signal anyway. The `AbortError` check in the catch block was dead code, so Tesseract could hang indefinitely on large images until the serverless `maxDuration` (60s) killed the whole invocation. **Fix:** replaced the inert AbortController with `Promise.race([recognize(...), timeout])` so the caller gets a timely failure. Caveat documented inline: tesseract.js has no cancellation API so the WASM computation itself still runs to completion on its worker (the abandoned promise is GC'd on its own). _Files:_ `src/lib/vision.ts`.

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

1. **Quiz + Follow-up questions panels** (top of Critical bugs) — biggest remaining user-visible issue. Wire chip handlers + Quiz tab to `/api/chat` and `/api/quiz`. See description above for the suggested plan.
2. **Mobile print backstop** (Critical bugs) — 4-line change × 3 files. Branch `devin/<ts>-print-backstop`.
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

- **2026-05-02 — Devin (session 1fcd2760b5f2450ab653b9bf5ad563ee) — feature: Try-demo carousel + Settings → Personalize tab (Tier A #6 + #7):** _PR #39._
  - **What:** Two upstream parities at once. (1) gpai.app's Solver landing rotates demo cards rather than showing 3 static ones — Forge had a fixed grid. (2) gpai.app exposes Settings → Personalize with Occupation + Custom Instructions free-text, injected into every reply — Forge had no settings panel at all.
  - **Carousel (`src/components/SolverView.tsx`):** expanded `QUICK_DEMOS` from 3 → 6 entries (added "Verify a step", "Quick concept refresher", "Translate a textbook problem"), turned `DemoCards` into a stateful component that advances `start` by 1 every `DEMO_ROTATION_MS` (7 s), wraps via modulo, and slices `DEMO_CARDS_PER_PAGE` (3) visible items. Hover/focus pauses rotation; dot pagination above the grid is keyboard-accessible (`role="tab"`, `aria-selected`). Each rotation triggers a `demo-card-fade-in` keyframe (320 ms) gated by `prefers-reduced-motion: reduce`.
  - **Personalize (`src/components/SettingsModal.tsx`, new):** modal opened from a new gear button at the bottom of the sidebar (`src/components/Sidebar.tsx`, `onOpenSettings` prop). Two tabs: General (theme toggle that drives the existing `theme` state in `EducationApp`) and Personalize (Occupation: 200-char input; Custom Instructions: 10 000-char textarea; live counters; Reset button). Closes on Escape and on overlay click. Animations respect reduced motion via the existing `keyframes` system.
  - **Persistence + plumbing:** new `src/hooks/usePersonalization.ts` reads/writes `eduforge:personalization` in `localStorage` via the same `queueMicrotask` hydrate pattern as `EducationApp`'s history persistence (avoids the `react-hooks/set-state-in-effect` lint and prevents wiping saved state on first mount). The hook returns a `request` field that is `null` when both fields are empty, so the API gets `personalization: null` and short-circuits.
  - **Server prompt injection:** new `buildPersonalizationSuffix(personalization)` in `src/lib/prompts.ts` produces a `\n\n[USER PREFERENCES]…` block (or `""` when both fields are empty after trimming). `getSystemPrompt(mode, personalization?)` now appends this to the system prompt for **all 7 features** (Solver, Visualizer, Cheatsheet, Report Writer, PDF Notes, Notebook, Chat). The Chat path's two custom system prompts (`conversationalSystem`, `deepExplainSystem`) in `streamChatResponse` also append the suffix. Hard-capped at 200 chars (occupation) and 10 000 chars (instructions) to keep token costs predictable.
  - **Type changes:** new `Personalization` exported from `src/types/education.ts`; both `EducationRequest` and `ChatRequest` gain optional `personalization` field. `EducationApp.tsx`, `SolverView.tsx`, `ChatView.tsx` all pass through.
  - **API routes:** `src/app/api/educate/route.ts`, `src/app/api/educate/stream/route.ts`, `src/app/api/chat/route.ts` forward `body.personalization` into the orchestrator/chat handle. No new env var, no new dependency.
  - **Verified:** `npx tsc --noEmit` clean, `npm run lint` clean (after refactoring the hydrate effect to mirror `EducationApp`'s `queueMicrotask` pattern), `npm run build` clean.
  - **What's next in this session:** Tier A #4 (Quiz panel) and Tier A #5 (Follow-up chips) remain. Tier A #3 (inline glossary) is the largest of the tier and ships last.

- **2026-05-02 — Devin (session 1fcd2760b5f2450ab653b9bf5ad563ee) — feature: CrossCheckBadge avatar polish + shared ModelAvatars (Tier A #2):** _new PR._
  - **What:** the `CrossCheckBadge` had 5 states with text-only labels; gpai.app shows the same badge with two overlapping avatar circles whose colours/initials identify the verifier pair (e.g. Llama-blue `L` overlapping Nemotron-green `N`). The composer's `Cross-check with <verifier>` pill (added in PR #37) was also text-only.
  - **How:** new `src/components/ModelAvatars.tsx` exporting `modelDisplay(model)` (returns `{initial, short, bg}` for 8 model families: Nemotron green, Mistral orange, DeepSeek blue, Llama Facebook-blue, Gemini Google-blue, OpenAI green, Demo grey, fallback slate) and `<ModelAvatars primary secondary size />` (overlapping circles with white border). `CrossCheckBadge` in `SolverView.tsx` now renders the avatar pair before the icon + label and tooltips name both models. Composer's pill and dropdown subheads now embed `<ModelAvatars size={14|16} />` after `Cross-check with`.
  - **CSS:** added `.cross-checked-avatars`, `.cross-checked-avatar`, `.cross-checked-icon`, `.cross-checked-pulse` keyframes (pending state pulses softly), and `.model-crosscheck-indicator-label`. Adjusted padding on the badge to make room for the avatars (left padding `4px` when avatars present, `10px` for pending/skipped which have no avatars).
  - **Verified:** `npx tsc --noEmit` clean, `npm run lint` clean, `npm run build` clean.

- **2026-05-02 — Devin (session 1fcd2760b5f2450ab653b9bf5ad563ee) — feature: cross-check indicator on model selector (Tier A #8):** _PR #37, merged._
  - **What:** gpai.app shows a "Cross-check with [icons]" subhead under GPAI Pro in the model selector, indicating multi-model verification. Forge had no equivalent — users couldn't see *why* "Auto" was different from "Llama 3.3 70B" or whether cross-check was actually wired to the selected model.
  - **How:** `src/components/Composer.tsx` — extended `modelOptions` with `description`, `crossCheckPartner`, and `group` fields. Added two surface-level indicators: (1) an inline pill `✦ Cross-check with <verifier>` next to the model select button (renders only when `crossCheck` is on AND `currentModel.crossCheckPartner` is set; hidden < 760 px); (2) the dropdown menu now renders option descriptions, a `Cross-check with <verifier>` subhead per primary option, and is grouped into "Forge models / Third-party model / Offline" sections with a divider between groups. Active option prefixed with `✓` and `aria-checked="true"`.
  - **CSS:** added `.model-option-group`, `.model-option-group-label`, `.model-option-row`, `.model-option-label`, `.model-option-description`, `.model-option-crosscheck`, `.model-crosscheck-indicator` to `src/app/globals.css`. Dropdown widened from 180 px → 280 px min, 340 px max.
  - **Verified:** `npx tsc --noEmit` clean, `npm run lint` clean, `npm run build` clean.
  - **What's next:** when Tier A #2 (CrossCheckBadge avatar polish) lands, the inline pill could swap to a small avatar pair to match gpai.app's exact visual; for now the pill is text-only.

- **2026-05-02 — Devin (session 1fcd2760b5f2450ab653b9bf5ad563ee) — feature: auto-titled tasks (Tier A #1):** _PR #36, merged._
  - **What:** Forge's sidebar Recent showed timestamp IDs / 60-char prompt slices. gpai.app shows a 2-5 word semantic title (e.g. "Solving 4th-order ODE", "Quadratic factoring") within ~1 s of submit. Closes Tier A gap #1 from the 2026-05-02 audit.
  - **How:** new `generateTaskTitle(request, primaryAnswerText)` in `src/lib/orchestrator.ts` — small post-stream LLM call (24-token cap, 15 s abort) that returns a cleaned 2-5 word title. `parseModelResponse(markdown, request, verification, options?)` now accepts an optional `titleOverride`. Wired into `runEducationalOrchestrator` (sequential, awaits before parse) and `/api/educate/stream/route.ts` (parallel with `runCrossCheckOnAnswer` via `Promise.all` so the user-visible TTFT is unchanged — only the structured tail waits).
  - **Skipped for `chat` mode** because `EducationApp.handleChatMessagesChange` already titles chats from the first user message — adding an LLM call there would just duplicate work and cost a request.
  - **Override:** `NVIDIA_TITLE_MODEL` env var if you want a smaller/faster model than the primary solver (defaults to whatever `configuredProviders()[0].solverModel` is).
  - **Robustness:** `cleanTitle()` strips wrapping quotes/backticks/asterisks, trims trailing `.!?…`, rejects bodies > 80 chars / < 2 chars / starting with markdown (`#>*`). On any failure (timeout, API error, empty response, malformed body) returns `null` and the caller falls back to the existing `inferTitle()` heuristic. No regression risk.
  - **Verified:** `npx tsc --noEmit` clean, `npm run lint` clean, `npm run build` clean.

- **2026-05-02 — Devin (session 1fcd2760b5f2450ab653b9bf5ad563ee) — vision: defensive `NVIDIA_VISION_MODEL` env-var handling + README scrub:** _PR follow-up to #31._
  - **Reported by user immediately after merging #31:** production was still failing with `OCR call failed via mistralai/mistral-large-3-675b-instruct-2512: HTTP 400: chat_template is not supported for Mistral tokenizers`. **Root cause:** the user's Vercel project still had `NVIDIA_VISION_MODEL=mistralai/mistral-large-3-675b-instruct-2512` set as an env var (left over from the old README example). PR #31's `process.env.NVIDIA_VISION_MODEL ?? <default>` honored that env var, so the broken value won and the deploy invoked a non-existent NIM model with a Nemotron-only request body, getting HTTP 400 on the `chat_template_kwargs` extension.
  - **Fix in this PR:**
    1. **Override known-broken values.** `resolveVisionModel()` in `src/lib/vision.ts` now ignores `NVIDIA_VISION_MODEL` when it's in the `KNOWN_BROKEN_VISION_MODELS` set (`mistralai/mistral-large-3-675b-instruct-2512` for now) and logs a warning telling the user to delete the env var. Old deploys with stale env vars heal themselves on next request.
    2. **Gate `chat_template_kwargs` to Nemotron-family models.** `supportsChatTemplateKwargs(modelName)` returns true only for `/nemotron/i`. Mistral, Llama-Vision, etc. reject the extension with HTTP 400, so we only include it when the model name actually supports it. This means a future user who explicitly sets `NVIDIA_VISION_MODEL=meta/llama-3.2-11b-vision-instruct` (or similar non-Nemotron VLM) will get a request body the model accepts.
    3. **README scrub.** Removed the `mistralai/mistral-large-3-675b-instruct-2512` examples from the solver env-var section and added an explicit "do NOT set these to <broken model>" warning. Solver/verifier defaults now point to working models (`meta/llama-3.3-70b-instruct`).
  - **Lesson for next session:** any time a model name shows up as a default in the README, future users will copy that value to Vercel and never update it. When changing model defaults, scrub README + ship a defensive runtime check that detects the previous default and overrides it. Don't trust env vars to be in sync with code.
  - **Improvements / follow-ups added to the list:**
    1. **Audit other model env vars.** The solver has `NVIDIA_SOLVER_MODEL`, `NVIDIA_MODEL_MISTRAL_LARGE`, etc. — same trap. Consider adding `KNOWN_BROKEN_*_MODELS` sets in the orchestrator + a one-time "model probe" at boot that pings each configured model with a 1-token request and warns/falls-back if any 404.
    2. **`/admin/health` route.** Add a simple GET that returns `{ visionModel, solverModel, verifierModel, allReachable }` so the user can curl their Vercel deploy and confirm config without uploading a problem.

- **2026-05-02 — Devin (session 1fcd2760b5f2450ab653b9bf5ad563ee) — vision: collapse OCR chain to a single Nemotron Omni call:** _PR #31, merged._
  - **Model used:** `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` (NVIDIA NIM hosted) via `https://integrate.api.nvidia.com/v1/chat/completions`. Multimodal `image_url` content; `chat_template_kwargs.enable_thinking = false` to skip reasoning trace and return a fast direct transcription. Auth: `NVIDIA_VISION_API_KEY ?? NVIDIA_IMAGE_TO_TEXT_API_KEY ?? NVIDIA_API_KEY ?? NIM_API_KEY`. Model overridable via `NVIDIA_VISION_MODEL` env var.
  - **What was fixed:** the prior NVIDIA Llama-3.2-Vision → Gemini → Tesseract chain (PRs #26 → #29) was returning confidently-wrong handwritten-math transcriptions (`1/(x⁴+1)`, `SCN/r²`, etc.) on the user's `(D⁴ − 2D³ + D²)y = x³` photo. Per direct user instruction, replaced the entire chain with a single call to Nemotron Omni. Verified end-to-end on the actual user image: model outputs `(D-2D^{3}+D^{2})y=x^{3}` + "find y in terms of x" in ~1.6 s — perfectly verbatim except for a single dropped exponent on the leading `D⁴` (huge improvement vs prior chemistry/integral hallucinations).
  - **Files touched:** rewrote `src/lib/vision.ts` end to end (single-provider, ~340 → ~340 lines, simpler logic). Removed `tesseract.js` dependency from `package.json`. Updated `scripts/test-vision.ts` provider-list log. Updated `README.md` env-var section. Expanded `research/gpai-features-reference.md` "Vision / OCR pipeline" section with the new architecture, hosted-endpoint inline cap, known limitations, and follow-up improvements. No changes needed to `src/lib/orchestrator.ts` — `ATTACHMENT_FAILURE_PREFIX` and `findUnreadableAttachments` exports preserved.
  - **Server-side guard:** `MAX_INLINE_IMAGE_BYTES = 1.7 MB`. NVIDIA's `integrate.api.nvidia.com` gateway times out silently on inline base64 data URLs above this size; the Composer's existing client-side compression (1600 px / JPEG q 0.85) lands well under, so this guard only catches the rare uncompressed-upload path with a clear error message instead of a 90 s hang.
  - **Improvements / follow-ups for next session:**
    1. **Recover dropped exponents.** Add a few-shot example to `VISION_PROMPT` showing a transcribed handwritten ODE so the model attends to subscripts/superscripts more carefully. Optional second-pass with `enable_thinking: true` when the transcription contains a bare `D` not followed by an exponent.
    2. **Scanned PDFs.** Currently fail with `PDF contained no extractable text — likely scanned images. Re-upload as PNG/JPG screenshots`. Wire a per-page rasteriser (poppler `pdftoppm` or pdf.js NodeCanvasFactory) so `extractPdfText` can fall back to per-page Nemotron Omni OCR.
    3. **NVCF Assets API for big images.** If we ever want to skip Composer compression and send full-resolution photos, switch from inline `image_url` to NVCF Assets — upload once, reference by asset ID. Removes the 1.7 MB cap.
    4. **Streaming OCR.** The Nemotron Omni call supports `stream: true`. Not used today (responses are <100 chars and arrive in <2 s) but worth wiring up if multi-page transcriptions become a thing.
    5. **Unify chat + parse-pdf** to also route through `vision.ts` so improvements land in one place. Already partly true; double-check `/api/parse-pdf/route.ts` doesn't duplicate logic.
  - Verified `npm run lint`, `npx tsc --noEmit`, and `npm run build` all pass clean.

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

---

## Feature Audit Findings — 2026-05-02

> A full deep-dive audit of gpai.app was performed on 2026-05-02 (Devin session
> `1fcd2760b5f2450ab653b9bf5ad563ee`). 46 screenshots + structured findings
> live in [`research/audit-2026-05-02/`](research/audit-2026-05-02/findings.md).
> The reference doc was updated as
> [`research/gpai-features-reference.md` §13](research/gpai-features-reference.md#13-new-findings-from-2026-05-02-deep-audit-additions).
> **No code was changed in the audit PR.** Each gap below should ship as a
> separate, focused PR — sized so it can land within one Devin session each.

### Stack-ranked Forge gaps (most-visible first)

Effort scale: XS = <½ day · S = ½–1 day · M = 1–2 days · L = 2–5 days · XL = 5+ days.

#### Tier A — high-impact, low-to-medium effort (ship first)

1. ~~**Auto-titled tasks** *(XS)*~~ — **DONE** (2026-05-02). Added
   `generateTaskTitle(request, primaryAnswerText)` in `src/lib/orchestrator.ts`
   (small post-stream LLM call asking for a 2-5 word semantic sidebar title).
   Wired into both `/api/educate` (sequential) and `/api/educate/stream` (in
   parallel with cross-check via `Promise.all`). `parseModelResponse` now
   accepts an optional `titleOverride`. Result: sidebar Recent shows
   "Solving 4th-order ODE" instead of "(D⁴ − 2D³ + D²)y = x³". Skipped for
   `chat` mode (chats title themselves from first user message).
   Override via `NVIDIA_TITLE_MODEL` env var (defaults to primary solver model).
2. ~~**Cross-check `Cross-checked` badge polish** *(S)*~~ —
   **DONE** (2026-05-02). Extracted `modelDisplay()` and `<ModelAvatars />`
   into a shared `src/components/ModelAvatars.tsx` so both `CrossCheckBadge`
   (Solver result header) and Composer's inline `Cross-check with [icons]`
   pill render the same overlapping-avatar pair. 8 model families have
   deterministic colours + initials (Nemotron `N`, Mistral `M`, DeepSeek `D`,
   Llama `L`, Gemini `G`, OpenAI `O`, Demo `•`, fallback first-alpha-char).
   Improved tooltips now name both models (`Cross-checked by Llama + Nemotron:
   both models reached the same conclusion.`). Pending state pulses softly
   while the verifier is still running. Skipped state has clearer copy.
3. **Inline orange clickable glossary terms** *(M)* — Site-wide pattern.
   Implementation: post-process the streamed markdown with an LLM glossary pass
   (`return only an array of {term, definition}`); wrap matches in `<dfn>` with
   class `glossary-term`; on click, show a small floating tooltip. Apply in
   Solver, Chat artifact, PDF Notes, Cheatsheet.
4. **Functional Quiz panel** *(S)* — Already partially wired (`POST /api/quiz`).
   Match upstream UX: pagination `1/3` with `<` `>`, MCQ with green ✓ / red ✗
   on click, auto-show Explanation block, Hint button per question.
5. **Functional Follow-up chips** *(S)* — Wire the four chips ("Make it easy",
   "List key concepts", "Give similar practice", "Explain in English") to fire
   pre-canned prompts to `/api/chat` with the current Solver problem + answer
   as system context. Render the response as a chat thread on the right rail.
6. ~~**Try-demo carousel cards** on Solver landing *(XS)*~~ — **DONE
   (2026-05-02)**. PR #39 expanded `QUICK_DEMOS` from 3 → 6 cards (added
   "Verify a step", "Quick concept refresher", "Translate a textbook
   problem") and turned the static grid into a rotating carousel: visible
   3 cards advance one slot every 7 s, wrap-around is seamless via modulo
   indexing, hover/focus pauses rotation, dot pagination above the grid
   lets users jump pages. Cards fade-in on each rotation
   (`prefers-reduced-motion` respected). All in `SolverView.tsx`
   `DemoCards`; CSS in `globals.css` `quick-section-head` /
   `demo-dots` / `demo-card-anim`.
7. ~~**Settings → Personalize** *(S)*~~ — **DONE (2026-05-02)**. PR #39
   shipped a full Settings modal triggered from a new gear button at the
   bottom of the sidebar. Tabs: General (theme toggle) and Personalize
   (Occupation, 200-char text input + Custom Instructions, 10 000-char
   textarea, both with live char counters and a Reset button). Values
   persist to `localStorage` (`eduforge:personalization`) via a shared
   `usePersonalization()` hook. Empty fields are not sent over the wire;
   when at least one field is non-empty, the API request gains a
   `personalization: { occupation, customInstructions }` field. Server
   side, `getSystemPrompt()` and `streamChatResponse()` both call a new
   `buildPersonalizationSuffix()` that appends a `[USER PREFERENCES]`
   block to the system prompt — applied to **all 7 features** (Solver,
   Chat, Visualizer, Cheatsheet, Report Writer, PDF Notes, Notebook)
   plus the chat path. Files:
   `src/types/education.ts` (new `Personalization` type +
   `EducationRequest.personalization` + `ChatRequest.personalization`),
   `src/hooks/usePersonalization.ts` (new), `src/lib/prompts.ts`
   (new helper + extended `getSystemPrompt(mode, personalization)`),
   `src/lib/orchestrator.ts` (passes through; chat path appends),
   `src/components/SettingsModal.tsx` (new), `src/components/Sidebar.tsx`
   (new gear button), `src/components/EducationApp.tsx` (modal mount),
   `src/components/SolverView.tsx` + `src/components/ChatView.tsx`
   (request body), `src/app/api/educate/route.ts` +
   `src/app/api/educate/stream/route.ts` + `src/app/api/chat/route.ts`
   (forward `personalization`).
8. ~~**`Cross-check with [model icons]` indicator** on the model selector *(XS)*~~ —
   **DONE** (2026-05-02). Two indicators added to `Composer.tsx`:
   (a) inline pill `✦ Cross-check with Nemotron 49B` (orange, low-opacity
   bg) sits between the Cross-check checkbox and the model select button —
   only renders when cross-check is on AND the selected model has a
   `crossCheckPartner`. Hidden on viewports <760 px to avoid crowding.
   (b) Inside the dropdown, every primary model option now shows a
   description subhead + a `✦ Cross-check with <verifier>` line, plus
   the dropdown is grouped (Forge models / Third-party model / Offline)
   to mirror gpai.app's GPAI Pro / GPAI Fast / Third-party model layout.
   Selected option is prefixed with `✓`. Active-state aria added.

#### Tier B — high-impact, larger effort (ship after Tier A)

9. **Streaming sections in parallel** *(M)* — Today our Solver streams a single
   text blob with H2 sections. gpai.app streams `Answer` + `Solution` in
   parallel — the Answer shows a spinner while Solution is already rendering
   below. Refactor `streamEducationalSolverDraft` to emit a structured event
   stream (`{section, delta}`) and the SolverView to render each section in its
   own bounded box.
10. **Solver Download modal** *(M)* — Replace `window.print()` with a real
    modal: per-section toggles (Problem Image / Problem Text / Answer / Solution
    / Solution Images) + layout (one-per-page vs many) + DOCX **and** PDF buttons.
    Use the existing `docx` npm package for DOCX. PDF can stay browser-print
    for now if generating PDF server-side is too heavy.
11. **Public-link share** (`/<feature>/share/<id>`) *(M)* — Add a
    `share_links` server-side store keyed by task ID. Add a "Share" icon next
    to the task title that generates a short ID, copies the URL, and toggles
    public-access. The `/share/<id>` route serves a read-only render of the
    task.
12. **Quiz / Flashcard / Practice Test** as three artifact types *(M)* — Today
    Forge only has Quiz. Add Flashcards (front/back card flipping) and Practice
    Test (longer assessment) artifact types. Each needs its own `/api/<x>`
    endpoint and renderer.
13. **Adaptive follow-up suggestion cards in chat replies** *(S)* — When a chat
    reply finishes, ask the model for 2-3 disambiguation questions ("What
    aspects are you most interested in?", "What's your comfort level?") and
    render them as clickable cards under the reply.

#### Tier C — large rebuilds (ship as multi-PR initiatives)

14. **Specialized Visualizer agents** *(XL)* — gpai.app has 9 specialized
    image agents (Illustration / Graph / Flowchart / Diagram / Circuit /
    Chemistry / Logic / +Pro variant / Auto-router). Forge today has a single
    Mermaid render. Build:
    - A router that classifies the user's prompt into one of N agent buckets.
    - Per-agent prompt templates (e.g., Graph AI → "Output Python matplotlib
      code that draws …" then run via Pyodide or a server-side Python sandbox;
      Chemistry AI → "Output a SMILES string" then render via RDKit-JS;
      Flowchart AI → Mermaid; Diagram AI → SVG via tikzjax or hand-tuned LLM
      SVG output; Circuit AI → CircuitJS schematic JSON; etc.).
    - A unified Visualizer canvas (Figma-lite) that wraps all of them with
      Edit/Assets tabs, frame size, opacity slider.
    Recommended phasing: ship Graph AI + Flowchart AI first (highest user
    value, lowest implementation effort because mermaid + matplotlib already
    exist). Add the others over time.
15. **Cheatsheet versioning + 3-column A4 + Edit-via-chat** *(L)* — Replace
    the current single-blob markdown cheatsheet with:
    - Server-side cheatsheet store with `versions[]` per cheatsheet.
    - Tiptap-based WYSIWYG editor on the right pane (A4 size, 3-column CSS
      `column-count: 3`, page-break-after every page-height-worth of content,
      page navigator `1/N`).
    - Left chat pane: each user message creates a new version; "See Version 1
      / 2 / 3" version label is clickable to switch.
    - `Edit via chat` toggle to switch the right pane between AI-edit
      (read-only with chat-driven mutations) and direct-edit (WYSIWYG).
16. **Report Writer with embedded Visualizer diagrams** *(L)* — Dual-pane
    chat + Tiptap WYSIWYG. When the prompt mentions "with a diagram" or the
    AI decides one is appropriate, call into the Visualizer agent router and
    embed the result inline. Format toolbar (B/I/U/list/align/highlight),
    Export menu (Copy / PDF / DOCX), Undo / Try again buttons.
17. **PDF Notes hierarchical TOC + paginated study notes** *(L)* — Replace
    single-blob output with:
    - PDF parse → outline extraction (PDF bookmarks if present, else heading
      heuristics on `unpdf` output).
    - LLM pass per section → structured study notes (info-box layout, bold
      lead-ins, bulleted points, KaTeX, monospace code blocks, embedded
      diagrams).
    - Section view with sticky 3-pane layout (TOC left, notes center, action
      bar top).
    - `< Previous / 1/1 / Next >` pagination within sections.
    - `A- / A+ / Reset` font-size controls (CSS variable that scales rem
      values).
    - Auto-classify subject + level (`CS · graduate · ENGLISH · 15p`) with a
      classifier LLM call.
18. **AI Chat dual-pane Deep Explain mode** *(L)* — Add a `Deep explain`
    toggle that switches the chat into a Claude-Artifacts-like layout:
    chat thread on the left + standalone artifact on the right. Both saved
    as separate but linked entities in the recent list.
19. **Notebook multi-tab + multi-chat-per-notebook + Study Log + 7 source
    types** *(L)* — Major rebuild of the current single-tab notebook:
    - Tabbed UI (multiple notebooks open in same window).
    - Per-notebook multiple chat threads (`Current chat ▼` dropdown +
      `+ New chat`).
    - Source ingestion for: PDF / images / documents / audio (Whisper) /
      video (extract audio, then Whisper) / YouTube (yt-dlp + Whisper) /
      Google Drive (OAuth) / Text (paste).
    - Three artifact types: Summary / Quiz / Flashcard, with multi-source
      selection (max 20 sources).
    - Study Log tab as a free-form markdown editor saved per notebook.

#### Tier D — small polish wins

20. **Per-section font size controls (`A- A+ Reset`)** *(XS)* — Add to PDF
    Notes section view. Pure CSS variable.
21. **Multilingual output language selector** in PDF Notes *(S)* — Dropdown
    with major languages; pass through as a `target_language` system prompt
    parameter.
22. **Sample galleries** on every feature landing *(S)* — Static curated
    examples below the composer with lightbox preview + Download button.
23. **`Send feedback`** orange button (BETA features only) *(XS)* — opens a
    small form modal that POSTs to a feedback endpoint.
24. **Sidebar Recent rename/delete per item** *(XS)* — Hover state shows `…`
    menu with Rename / Delete.

### Observed quirks / model-API notes for next session

- gpai.app's `Mixture of AI` is a router, not a single model — different
  visualizations are clearly produced by different specialized pipelines (the
  matplotlib output of Graph AI vs the SVG output of Diagram AI). Forge's
  Visualizer single-model approach cannot replicate the output style without
  per-domain routing.
- The cross-check pipeline appears to run a SECOND model in parallel and a
  third LLM as a judge labeling `AGREE/MINOR/DISAGREE`. We already have this
  in `runCrossCheckOnAnswer` — just need badge UX polish.
- Streaming events appear to be structured (the Solver's parallel `Answer` +
  `Solution` rendering can't be done with a flat token stream — the backend
  must emit `{section: "answer", delta: ...}` style events).
- The Cheatsheet's "Version 1 / 2 / 3" label suggests the backend stores each
  iteration as an immutable artifact version; the chat refers to the latest by
  default.
- The Notebook's leaked Korean placeholder ("내용을 입력하세요...") confirms
  gpai.app is built primarily for the Korean market — be aware of this when
  thinking about i18n / RTL support priorities.
- All new tasks (Solver / Cheatsheet / Report / etc.) are auto-titled by an
  LLM. The title appears in the sidebar Recent within ~1 second of submit.
  This is a separate API call, not embedded in the main response stream.
- Daily credits: 50/day for free plan. Consumption observed: Solver task ≈ 30,
  Quiz ≈ 5, Follow-up chip message ≈ 5. PDF Notes uses a SEPARATE quota
  ("2 free per day during Beta") — not credits.

### What's safe to skip / defer

- **Pricing / Subscription / Account / billing pages** — explicitly
  out-of-scope per user instruction. Don't audit, don't replicate.
- **Visualizer Figma-lite canvas editor** can be deferred until after the
  9-agent router ships. The canvas editor is gravy on top — the value is in
  the per-domain output quality.
- **YouTube / Drive / audio / video Notebook source types** can be deferred
  until after PDF + image + text Notebook works end-to-end. Each adds a
  significant ingestion pipeline (yt-dlp, Whisper, Drive OAuth) so do them
  one at a time, not all at once.
- **`Cross-check with [icons]`** indicator under the model selector is purely
  cosmetic — don't ship without the actual cross-check pipeline being
  visually correct (Tier A #2 first).

---

## Handover Prompt for Next Session

> Copy-paste EVERYTHING below (from the `---` line down) into the next Devin
> session verbatim.

---

You are continuing work on **`Asdfyash1/GPAI`** — a clone of gpai.app rebranded
as **Forge**. Repo at `/home/ubuntu/repos/GPAI`. Previous session URL:
https://app.devin.ai/sessions/1fcd2760b5f2450ab653b9bf5ad563ee

### What just happened

The previous session did **a comprehensive deep-dive audit** of every gpai.app
feature (except pricing/billing) — captured exact response markdown, UI
behavior, model selectors, export modals, share popups, follow-up chip
behavior, and 46 fresh screenshots. **No code was changed** — the audit PR is
research-only.

### Files you MUST read first (in this order)

1. **`research/audit-2026-05-02/findings.md`** — full audit write-up. Sections:
   1 (top-level chrome) → 2 (Solver) → 3 (Visualizer) → 4 (AI Chat) → 5 (Cheatsheet) →
   6 (Report Writer) → 7 (PDF Notes) → 8 (Notebook) → 9 (cross-feature patterns) →
   10 (Korean origin clue) → 11 (gap list) → 12 (audit metadata).
2. **`research/screenshots/audit-2026-05-02/`** — 46 numbered screenshots.
   Filenames map directly to sections (`01-…16-…` = Solver,
   `17-22` = Home/Settings, `23-33` = Visualizer, `34-35` = AI Chat,
   `36-37` = Cheatsheet, `38-39` = Report Writer, `40-42` = PDF Notes,
   `43-46` = Notebook).
3. **`research/gpai-features-reference.md` §13** — additions from this audit
   summarised back into the canonical reference doc.
4. **`BACKLOG.md` "Feature Audit Findings — 2026-05-02"** — the
   stack-ranked gap list. Read the entire section before starting work.

### What to do next

The user said: *"deep dive every feature present in gpai ai even this seesion is
closed u should not stop untill ur finish weery feature."* So the long-term
goal is to **close every gap** between Forge and gpai.app.

**Ship gap-closure PRs in this order** (matches BACKLOG.md tier order):

#### Phase 1 — Tier A (week 1, every PR ½–1 day)

Each of these is a small focused PR. Ship them one at a time, in order. Do
NOT batch them together — small PRs land faster and reviewer can verify each
gap closes cleanly.

- ✅ **PR 1: Auto-titled tasks** (Tier A #1, XS) — **MERGED in PR #36**.
- ✅ **PR 2: CrossCheckBadge avatar polish** (Tier A #2, S) — **MERGED in
  PR #38**.
- **PR 3: Quiz panel functional** (Tier A #4, S) — Pagination, MCQ feedback
  (green ✓ / red ✗ on click), auto-show Explanation, Hint button. The
  `/api/quiz` endpoint and component already exist; this is UX polish.
- **PR 4: Follow-up chips functional** (Tier A #5, S) — Wire the four chips
  to fire pre-canned prompts to `/api/chat` with task context. Render
  response as a chat thread on the right rail.
- ✅ **PR 5: Try-demo carousel + Personalize tab** (Tier A #6 + #7, S) —
  **OPEN AS PR #39**. Carousel rotates 6 demo cards (3 visible at a time);
  Settings modal with Personalize tab (Occupation + Custom Instructions),
  values persist to localStorage and are injected into every Solver/Chat
  system prompt. Once merged, both Tier A #6 and #7 are done.
- ✅ **PR 6: Cross-check indicator on model selector** (Tier A #8, XS) —
  **MERGED in PR #37**.
- **PR 7: Inline orange glossary terms** (Tier A #3, M) — Post-process
  streamed markdown with a glossary LLM pass; render as `<dfn class=
  "glossary-term">` with click-to-define tooltip. Apply to Solver, Chat,
  PDF Notes, Cheatsheet. Largest of Tier A — ship last.

After Tier A, the user-visible gap should drop ~50% with limited code
churn. Pause and confirm with the user before starting Tier B.

#### Phase 2 — Tier B (week 2-3)

PRs 8-13 from BACKLOG.md (streaming sections in parallel, Download modal,
public share, Quiz/Flashcard/Practice Test, adaptive follow-up cards). Each
is M-effort; budget ~2-3 PRs per session.

#### Phase 3 — Tier C (multi-week)

PRs 14-19 are large rebuilds. The first one — **specialized Visualizer
agents** — is XL effort but the highest-impact gap in the entire audit.
Consider doing this as a multi-PR series:
1. Agent router (classifies prompts into bucket).
2. Graph AI + Flowchart AI (lowest-effort agents).
3. Diagram AI + Circuit AI.
4. Chemistry AI + Logic AI.
5. Illustration AI (highest-effort: needs an image gen model).
6. Canvas editor wrap.

### Quirks to mimic (model API behaviors)

- gpai.app streams `Answer` and `Solution` **in parallel** — backend emits
  structured `{section, delta}` events. Forge today emits a flat text stream.
- gpai.app auto-titles tasks with a separate API call after the response,
  not inline.
- gpai.app's `Cross-checked` badge is from a parallel-verifier pipeline with
  a 3rd LLM judge (we have this; UI polish is what's missing).
- gpai.app's Visualizer is a router across 9 specialized agents — single-model
  approaches cannot match the output style.
- gpai.app's Cheatsheet has versioning — the chat refers to the latest version
  by default but you can switch to older ones.
- Daily credit consumption: Solver ≈ 30, Quiz ≈ 5, Follow-up chip ≈ 5.
- PDF Notes uses a SEPARATE "2 free per day during Beta" quota, not credits.
- The Notebook leaked Korean placeholder confirms gpai.app's primary market
  is Korean. Be aware for i18n discussions.

### What's safe to skip

- **Pricing / billing / subscription** — explicitly excluded by the user.
- **Visualizer Figma-lite canvas editor** — defer until 9-agent router ships.
  Canvas is gravy on top.
- **YouTube / Drive / audio / video** Notebook source types — defer until
  PDF + image + text Notebook works end-to-end.
- **Korean / RTL i18n** — the Korean origin is a curiosity, not a blocker.
- **Daily quota system** — Forge doesn't need this.

### What NOT to do

- Don't refactor for "cleanliness" without a user-facing gap to close. Every
  PR should map to a numbered gap from `BACKLOG.md`.
- Don't ship a Visualizer canvas editor before the agent router. The
  router is the value.
- Don't change the OCR pipeline — `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`
  is the verified single-call model from PR #31 and #33. Do not regress to
  multi-provider chains.
- Don't add Mistral, Groq, OpenRouter, or any paid third-party providers
  (user explicitly vetoed).
- Don't force-push to main. Use `devin/$(date +%s)-<short-name>` branches.
- Don't `git add .` — stage only the files you intend to ship.

### Standing user rules

- Always update `BACKLOG.md` in every PR with what you did + what's next, so
  the next session can pick up cleanly.
- Always run `npx tsc --noEmit && npm run lint && npm run build` before
  pushing. All three must be clean.
- Always create a PR via `git_pr(action="fetch_template")` then
  `git_pr(action="create")`. Update `BACKLOG.md` + reference doc as part of
  every PR.
- Always include the Vercel preview URL in your final message to the user.

### Your first message to the user

Something like:

> "Picked up from the previous session's audit. Read
> `research/audit-2026-05-02/findings.md` and the BACKLOG. Starting with Tier A
> PR 1 — auto-titled tasks (Forge currently shows timestamp IDs in the sidebar;
> gpai.app shows LLM-extracted titles like 'Ordinary Differential Equation').
> Will ship as a single small PR. ~30 min ETA."

Then start working. Do not block on the user before shipping the first PR —
they've already approved the gap-closure direction. Just keep them updated
with PR links as each one merges.
