# Test Plan — PR #8 (Asdfyash1/GPAI)

## What's being tested

The fixes/features in PR #8 against the local dev server at `http://localhost:3000`, with `NVIDIA_API_KEY` configured in `.env.local`:

1. AI Chat — `deepExplain` defaults to OFF; small-talk gating overrides Deep Explain ON for trivial inputs (no forced Pythagorean essay for "hi")
2. AI Chat — Deep Explain ON for a substantive STEM topic still produces a structured multi-section answer
3. Web search — `POST /api/web-search` returns Wikipedia/DuckDuckGo results; chat with the Globe toggle ON cites those sources in its reply
4. Chat history — chats appear in the sidebar Recent list with a per-mode badge, click-to-resume restores the full thread, the trash button deletes a chat, and chats persist across reloads via `localStorage`
5. (Regression) AI Solver — submitting a STEM problem still streams a structured answer

## Adversarial framing

For each step, I state the exact action and what would be visibly different if the fix were broken:

- If small-talk gating were broken: "hi" with Deep Explain ON would return a multi-section markdown document with `## Core idea`, `## Formula/Definition`, etc., or start with "Understanding the …".
- If web search were broken: `POST /api/web-search` would 404 / 500, or return an empty `results: []`. Chat with Globe ON would NOT contain any URL from `en.wikipedia.org` or `duckduckgo.com`.
- If chat history were broken: after sending a message, the left rail "Recent" stays at "No items yet" or the chat doesn't reappear after reload.
- If the prompt-quality changes were a no-op: the chat reply for "hi" would still open with the exact phrase "Understanding the …" or include `## Core idea` etc.

## Reference: code paths I traced

- Default `deepExplain = false`: `src/components/ChatView.tsx:35`
- Web toggle wiring: `src/components/ChatView.tsx:142-144`, `src/components/Composer.tsx:160-176`
- Small-talk gate (server-side): `src/lib/orchestrator.ts:262-318` (`isTrivialMessage`, `SMALL_TALK_REGEX`, conversational vs deep-explain prompt switch)
- Web search route: `src/app/api/web-search/route.ts`, `src/lib/web-search.ts`
- Web context injected into chat: `src/app/api/chat/route.ts:39-49,57`
- Chat history persistence (`localStorage` key `eduforge:chats`, sidebar wiring, delete handler): `src/components/EducationApp.tsx:28,41-42,67-74,103-115,140-167,190-220`, `src/components/Sidebar.tsx:80-110,127-146`

## Tests

### Test 1 — AI Chat: "hi" stays short with Deep Explain ON

Steps:
1. Visit `http://localhost:3000` and click the **AI Chat** mode tab.
2. In the composer footer, click the **Deep explain** pill so it goes orange/active. (Do NOT click Globe.)
3. Type `hi` and press Enter / click send.

Expected (pass):
- Reply length is < 300 characters.
- Reply does NOT contain any `##` heading, any numbered section like `1. Core idea` / `1. Formula`, the literal substring `Understanding the`, or any `$...$` LaTeX.
- Reply opens with a greeting word ("Hello", "Hi", "Hey", etc.) or directly addresses small-talk in 1-2 sentences.

Fail signature: a multi-section markdown document with `## Core idea` / `## Formula/Definition` / "Understanding the Pythagorean theorem" — i.e. the original bug.

### Test 2 — AI Chat: substantive STEM with Deep Explain ON is structured

Steps:
1. In the same chat session, with **Deep explain** still ON, type `Explain Bayes' theorem` and send.

Expected (pass):
- Reply is > 800 characters.
- Reply contains at least 3 of these markdown headings or numbered sections: `## Core idea`, `## Formula`, `## Examples`, `## Common mistakes`, `## Visual intuition`, `## Worked intuition`, or the corresponding `1. ... 6. ...` numbered variant.
- Reply contains at least one `$...$` or `$$...$$` LaTeX block (Bayes formula).
- Reply does NOT open with "Understanding the …".

Fail signature: a one-line conversational reply for a substantive question (would mean the trivial-message gate is over-aggressive), OR an "Understanding the …" essay opener (prompt regressed).

### Test 3 — Web search route returns sources

Steps (shell):
1. `curl -s -X POST http://localhost:3000/api/web-search -H 'Content-Type: application/json' -d '{"query":"pythagorean theorem"}' | head -c 2000`

Expected (pass):
- HTTP 200.
- Response is JSON `{ "query": "pythagorean theorem", "results": [...] }`.
- `results` length ≥ 1.
- Each result has `title`, `url`, `snippet`, `source` ∈ {`wikipedia`, `duckduckgo`}.
- At least one `url` matches `^https://en\.wikipedia\.org/wiki/`.

Fail signature: HTTP 404/500, empty `results: []`, missing `source` field.

### Test 4 — AI Chat with Globe ON cites web sources

Steps:
1. Open AI Chat. Turn **Deep explain** OFF. Click the **Globe / "Web search"** pill so it goes orange/active.
2. Type `What is the Pythagorean theorem? Cite sources.` and send.

Expected (pass):
- Reply contains at least one URL beginning with `https://en.wikipedia.org/wiki/` OR `https://duckduckgo.com/`.
- Reply explanation references Pythagoras / right triangle.

Fail signature: reply contains no URL (web context not injected) or URL is fabricated (e.g. `example.com`).

### Test 5 — Chat history persists in sidebar + survives reload

Steps:
1. After Tests 1-2, the left **Recent** list should contain at least one entry titled with the first user message ("hi" or "Explain Bayes' theorem"), with a small `C` badge.
2. Click **New task**, observe chat resets.
3. Click the prior chat in the Recent list — the full message thread should restore.
4. Reload the browser tab (Ctrl+R). The Recent list should still show the chat, and clicking it should still restore the thread.
5. Hover the chat row in Recent and click the trash icon. The row should disappear.

Expected (pass): all five sub-steps behave as described.

Fail signature: Recent list stays at "No items yet" after sending; clicking restores empty thread; reload wipes the list; trash button absent or non-functional.

### Test 6 — Regression: AI Solver still works

Steps:
1. Click **AI Solver**. Type `Solve x^2 - 5x + 6 = 0 step by step.` and submit.

Expected (pass):
- Streamed answer renders within ~30 seconds.
- Output contains `## Problem`, `## Answer`, `## Solution` headings (as required by the new textbook prompt).
- `## Answer` contains the bolded roots `x = 2` and `x = 3` (or LaTeX equivalents).

Fail signature: error toast, blank output, or output missing the required section headings (would mean prompt rewrite broke the solver).

## Out of scope for this test plan

- Visualizer image generation, Cheatsheet rendering, Report writer, PDF Notes, Notebook — not changed in PR #8 beyond a system-prompt rewrite. The Solver regression test (Test 6) is sufficient to confirm the prompt rewrite didn't blow up the educate stream pipeline.
- gpai.app feature parity comparison — gpai.app exhausted its 50 free credits during the tour and gated the rest behind a paywall, so I cannot directly compare side-by-side outputs for Visualizer / Cheatsheet / Report. Comparison notes from the gpai.app Solver tour will be folded into a separate `compare-notes.md` for the user; they are NOT pass/fail gates for this PR.

## Side notes for the user (not test gates)

While touring gpai.app I observed UX patterns we don't have yet:
- Right-side rail with quick-action chips (Make it easy / List key concepts / Give similar practice / Explain in English) and an in-context "Ask about this problem" follow-up composer attached to the answer view.
- "Cross-checked with [models]" badge on the Answer block.
- Tabs for "Follow-up questions" and "Quiz" on the right rail.
- Per-task `tsk_<ts>_<rand>` URL — i.e. each solve gets a shareable canonical URL.

These are improvements, not bugs, and are deliberately out of scope for PR #8. They'll go into a follow-up PR.
