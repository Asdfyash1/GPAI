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

- [x] **AI Chat: "hi" no longer triggers a Pythagorean essay even with Deep Explain ON.** Default `deepExplain=false`, server-side `isTrivialMessage` gate switches to conversational system prompt + `maxOutputTokens: 256` for small-talk. _Files:_ `src/lib/orchestrator.ts:262-318`, `src/components/ChatView.tsx:35`, `src/lib/prompts.ts` (chat prompt explicitly forbids "Understanding the …" essay opener).
- [x] **Mode tabs (AI Chat / Visualizer / More items) silently un-clickable when accessed via 127.0.0.1.** Next.js 16 dev server blocked HMR for any host other than `localhost`, leaving the page hydrated but with no event handlers — the page LOOKED rendered, but clicks went nowhere. _Fix:_ added `allowedDevOrigins: ["localhost", "127.0.0.1", "*.local"]` to `next.config.ts`. **Test by visiting `http://localhost:3000` (NOT `127.0.0.1`) AND `http://127.0.0.1:3000` — both must work.**
- [x] **Web search button is real, not a no-op.** `POST /api/web-search` returns Wikipedia REST results + DuckDuckGo Instant Answer; falls back to **DuckDuckGo HTML SERP** when Instant Answer is empty (covers news / topical queries that Instant Answer misses). Wired into chat via Globe pill. _Files:_ `src/lib/web-search.ts`, `src/app/api/web-search/route.ts`, `src/app/api/chat/route.ts:39-49`, `src/components/Composer.tsx`, `src/components/ChatView.tsx:36`.
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
- [ ] **In-context follow-up composer wired to the original problem.** Today `QUICK_CHIPS` (Make it easy / List key concepts / etc.) and the right-rail input call `handleQuickAction(label)` which re-issues the prompt as `"<chip>: <original problem>"` — but the conversation thread is lost. Replace with a chat thread anchored to the solve so the user sees a real Q&A timeline below the answer instead of replacing the whole solver view on every chip click.
- [ ] **Quiz: hidden-answer MCQ format with reveal-per-question.** Today the quiz renders a question + reveal button using `QuizItem`; that's already most of the way there, but mix in MCQs with 4 options + correct-answer highlighting after reveal. Update the `/api/quiz` system prompt to optionally produce MCQs.
- [x] **Visualizer: render-quality fixes for Mermaid diagrams + view-source / copy / SVG download.** Tightened the visualize spec system prompt with strict syntax rules ("ALWAYS quote node labels containing parentheses, colons, slashes; only ASCII identifiers; 5-12 nodes; no markdown inside the diagram block") so the LLM's Mermaid output is render-safe more often. Added a server-side `sanitizeMermaid()` pass that auto-quotes `[label (foo)]` / `((label: bar))` / `{label/baz}` so common LLM mis-quoting still renders. New `<DiagramView>` component shows a small toolbar with View Source toggle, Copy Mermaid source, and Download as SVG (serialised from the rendered DOM via `XMLSerializer`). _Files:_ `src/app/api/visualize/route.ts` (`specSystem`, `sanitizeMermaid`), `src/components/VisualizerView.tsx` (`DiagramView`), `src/app/globals.css` (`.diagram-toolbar`, `.diagram-source`).
- [ ] **Visualizer: text-to-image fallback when LLM returns no diagram.** When `result.diagramSpec` is undefined and `result.imageDataUrl` is also undefined, we currently just show the description in `.visualizer-fallback`. Wire a retry that asks the model "produce a Mermaid block ONLY" and re-renders, or kick off the Flux illustration path automatically.
- [ ] **Visualizer: chemistry / SMILES rendering.** Today chemistry category goes to the illustration path (Flux) only. Add SMILES → SVG via a small client-side library (e.g. SmilesDrawer) so a chem prompt can produce a real molecule diagram.
- [x] **Cheatsheet: A4-printable density.** The Cheatsheet "Print / PDF" button used to open a popup window, write injected HTML, and fight ad-blockers. Replaced with `window.print()` plus a real `@media print` stylesheet that flips a `body[data-printing="cheatsheet"]` marker, hides every element except the `.cheatsheet-page` article, reflows it to A4 (`@page size: A4; margin: 12mm`) with `columns: 2; column-gap: 14mm; font-size: 9pt`. The `afterprint` event clears the marker so the live UI snaps back. Prompt was already tuned (`cheatsheetSystemPrompt` in `src/lib/prompts.ts`); UI gap is closed. _Files:_ `src/components/CheatsheetView.tsx` (`handlePrint`), `src/app/globals.css` (`@media print`).
- [ ] **Report Writer / PDF Notes / Notebook: structured exports.** Add real "Download as PDF" buttons. Use `print-page` styling.
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

## Changelog (append-only — every session adds an entry)

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
