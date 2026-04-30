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
- [ ] **Shareable task URL.** gpai.app gives every solve a canonical URL like `/chat/s?id=tsk_<ts>_<rand>`. Today our solves only live in localStorage — they can't be linked. Mint an id at solve-completion, persist server-side (or a `?taskId=…` URL fragment that hydrates from localStorage), and add a real Share button next to the solve title.
- [ ] **In-context follow-up composer wired to the original problem.** Today `QUICK_CHIPS` (Make it easy / List key concepts / etc.) and the right-rail input call `handleQuickAction(label)` which re-issues the prompt as `"<chip>: <original problem>"` — but the conversation thread is lost. Replace with a chat thread anchored to the solve so the user sees a real Q&A timeline below the answer instead of replacing the whole solver view on every chip click.
- [ ] **Quiz tab generates real MCQs.** Today the Quiz tab has a single "+ Create new" button that re-prompts with `"Generate a 5-question quiz with answers from this problem."` and replaces the whole view. Make it stream MCQs into a structured component with hidden answers and a "Reveal" button per question (gpai.app pattern).
- [ ] **Visualizer: real diagrams, not just Mermaid blocks.** Audit `src/components/VisualizerView.tsx` and the visualizer prompt — confirm the model returns Mermaid for graphs / molecule SMILES diagrams / matplotlib spec for plots, and that each renders cleanly. Add image-mode (text-to-image via the upstream provider's image endpoint if available, else fall back to Mermaid + asciimath).
- [ ] **Cheatsheet: A4-printable density.** gpai.app cheatsheets are visibly print-grade. Today our prompt produces conversational bullets. Make the cheatsheet view an actual A4-aspect card with strict 2-column / 12-section layout, hidden-answer practice items, and a real "Print" button (`window.print()` + a `@media print` stylesheet). Prompt is partially tuned in `src/lib/prompts.ts` (`cheatsheetSystemPrompt`); UI is the gap.
- [ ] **Report Writer / PDF Notes / Notebook: structured exports.** Add real "Download as PDF" buttons. Use `print-page` styling.
- [ ] **Light theme polish.** Confirm dark + light themes both look right in solver / chat / cheatsheet. Today there's a theme toggle in the topbar but several views were styled for dark only.

## Medium priority

- [ ] **Solver: render Verification + Common-mistakes + Key-concepts sections inline,** not just at the end. The current `textbookSystemPrompt` prescribes order; verify the renderer respects it.
- [ ] **Better empty states.** Sidebar Recent currently says "No items yet" — add a one-liner CTA like "Solve your first problem to see it here". Visualizer / Cheatsheet / Report empty states could be more inviting.
- [ ] **Keyboard shortcuts.** `Cmd/Ctrl+K` for command palette / mode-switch, `Cmd/Ctrl+/` for help. Today there are none.
- [ ] **Multimodal input.** Composer already accepts attachments; verify image OCR is firing and the extracted text is being injected into the prompt (see `analyzeUploadedImages` in `src/app/api/chat/route.ts`).
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
- **2026-04-30 — Devin (session c9b3978799c6407c9f7acc3acb4173ec) — follow-up PR (cross-check + quota fallback):**
  - Real cross-check pipeline: `runCrossCheckOnAnswer` in `orchestrator.ts` solves the problem with a secondary model, then asks an LLM judge to label `AGREE / MINOR / DISAGREE`. The streaming route awaits this after the user has the primary answer and emits it in the structured tail.
  - Replaced the always-green "Cross-checked" pill with a real `CrossCheckBadge` component (5 states: pass / minor / fail / pending / skipped) including a tooltip with both candidate answers when models disagree.
  - Added `crossCheck?: CrossCheckResult` to the `EducationResponse` type and matching CSS variants.
  - Quota fallback in `/api/chat`: if the primary NVIDIA call dies before a single chunk streams, silently fall back to the demo provider with a one-line notice instead of leaving the user staring at an error bubble.
