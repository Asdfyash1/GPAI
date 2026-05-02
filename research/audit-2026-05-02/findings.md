# gpai.app Deep Audit — 2026-05-02

Author: Devin (session `1fcd2760b5f2450ab653b9bf5ad563ee`)
Live signed-in session at https://gpai.app/home, account `sqdmv50703@minitts.net`, plan: free (50 credits/day).
Screenshots: `research/screenshots/audit-2026-05-02/01-…46-…png`.

This is the **ground-truth** audit of gpai.app's current state — UI, UX, output formats, model architecture, and every visible feature except pricing/billing. Every gap below is a Forge feature gap.

---

## 1. Top-level navigation & shared chrome

### 1.1 Sidebar (always visible)
- `gpai` logo (top-left, clicking navigates to home)
- Sidebar collapse icon (top-right of sidebar)
- **`+ New task`** (creates a fresh task; navigates to /home with last-used feature)
- **`Recent`** with `See all >` link — list of every task across all features (Solver / Visualizer / Cheatsheet / Report / PDF Notes / Notebook). Currently shows just the most recent few.
- Per-task hover state shows `…` menu (Rename / Delete only)
- Bottom: **`Credits 15 / 50` progress bar** with **`Upgrade`** button below
- Bottom: User avatar + email (truncated). Click → menu: Settings / Upgrade plan / Send feedback / Terms and policies / Log out.

### 1.2 Top tabs (on /home and feature landings)
- AI Solver | AI Visualizer | AI Chat | **More ▼**
- The "More ▼" dropdown contains: AI Report Writer / AI PDF Notes / AI Cheatsheet Builder / AI Notebook
- The currently-selected feature is shown as the rightmost tab (e.g., "AI PDF Notes ▼") and clicking the chevron switches features without leaving /home.
- **URL pattern:** `gpai.app/home?destination-feature=<feature>` where feature ∈ `solver` (default) | `visualizer` | `ai-chat` | `cheatsheet` | `report-writer` | `pdf-notes` | `note`.

### 1.3 Settings (`gpai.app/settings/general`)
Tabs (left rail): General | Account | Personalize | Subscription.

- **General:**
  - Appearance: Light / **System** (default) / Dark — three theme cards each with a screenshot preview.
  - Language: English (dropdown).
- **Personalize:**
  - "Get personalized responses across AI Solver and AI Chat" header (note: only those two features use these settings).
  - **Your occupation** field (0/200 chars) — placeholder "Student, Professor, Engineer, etc."
  - **Custom instructions** (0/10,000 chars) — like ChatGPT's system prompt extension.
  - "Clear all" / "Save" buttons.

### 1.4 Model selector (Solver / Chat / etc.)
Dropdown opens with three choices:
- **`✓ GPAI Pro`** — "Smartest for detailed solutions - high accuracy, advanced visualizations". Shows "Cross-check with [icons]" badge in the dropdown subhead, indicating multi-model verification is bundled into Pro.
- **`GPAI Fast`** — "Fast and efficient for most problems, optimized for quick and reliable answers."
- **`✦ Gemini 3 Flash`** (under "Third-party model" section header) — direct passthrough to Google's Gemini 3 Flash.

**Implication:** gpai.app is model-agnostic and routes between an internal optimized stack (Pro/Fast) and explicit third-party model selection (Gemini direct). For Forge to match: build a routing layer that picks per-task between (a) a "pro" multi-model cross-check pipeline, (b) a "fast" single-call pipeline, and (c) a direct passthrough to user-selectable third-party models.

---

## 2. AI Solver (`gpai.app/solver/task?id=<id>`)

### 2.1 Composer (on landing)
- Big serif headline: **"AI Solver for Mathematics"** (cycles through subjects every few seconds — also seen "AI Solver for Physics").
- Composer placeholder: "Get a detailed solution".
- Bottom bar: 📎 attachment, **`Cross-check with [model icons]`** indicator (only on Pro), `GPAI Pro ▼` model selector, **↑** submit arrow.
- 3 Try-demo cards in a horizontal carousel:
  1. "Use it as teaching material — Make a class 11 physics worksheet on projectile motion"
  2. "Explain difficult concepts in a simple way — Explain benzene resonance structures with a diagram"
  3. "Analyze multiple problems at once — Up to 60 problems"

### 2.2 Submit → result page
**URL:** `gpai.app/solver/task?id=tsk_<timestamp>_<rand>`

**Tab title rotates dynamically:** "Ask anything about STEM | GPAI" → "Solving …" while streaming.

**Auto-titled task** appears in the sidebar Recent (e.g., "Ordinary Differential Equation"). The title is derived from the problem subject by an LLM, NOT from the prompt verbatim.

**Top action bar (right of title):**
- `…` overflow menu → Rename / Delete (no Share/Export here)
- **Download icon** → opens a sophisticated **Download modal** (see §2.5)
- **Share icon** → opens **Share solution** popup with public-link toggle (see §2.6)

**Header metadata under title:** `May 2, 2026 3:47 AM` (creation timestamp).

### 2.3 Response sections (in stream order)

The response is split into named sections that stream in **parallel** (not serial). The user sees `Answer` start with a spinner while `Solution` is already streaming below. This dramatically reduces perceived latency.

Sections, in order:

1. **`Problem`** — A faithful re-statement of the user's problem (transcribed if image was uploaded). Has a copy button at the right end of the heading (📋). Body is a single paragraph in monospace-friendly serif, with KaTeX rendered inline (e.g., `(D^4 - 2D^3 + D^2)y = x^3` is shown as `\((D^4 - 2D^3 + D^2)y = x^3\)`).

2. **`Answer`** — A short summary box with the **boxed final answer** at the end. Inline KaTeX, links to external concepts (orange-underlined). Has a "Cross-checked" badge with two avatar circles (the two models that verified). Click the avatars → tooltip shows model names.

3. **`Solution`** — The detailed walkthrough. Sectioned with H3-style numbered headings:
   - "1. Finding the Homogeneous Solution"
   - "2. Finding the Particular Integral"
   - "3. Combining Solutions"
   - …etc.
   Each numbered section has 3-7 sub-bullets explaining the math step-by-step. Inline KaTeX is heavy (every variable/formula). Inline definitions are highlighted **in orange** with a dotted underline — clicking expands an inline tooltip with a one-sentence definition (e.g., `characteristic equation` → "An algebraic equation derived from a differential equation by replacing derivatives with powers of m"). The final boxed answer is repeated at the bottom in a highlighted orange-bordered box.

4. **`Verification`** (when present) — A sanity-check pass.

5. **`Common mistakes`** — Bulleted list of pitfalls students often make for this kind of problem. **General-purpose, NOT specific to the user's problem.**

6. **`Key concepts`** — Numbered terms with one-sentence definitions, formatted like a glossary. Each term is the same orange-highlighted style as inline definitions.

7. **`Follow-up questions`** (right panel, see §2.4) — The right rail from this point on.

**Bottom of the page:** small `Report Error` pill button.

### 2.4 Right rail: Quiz + Follow-up

The right side of the result page has two tabs at the top:

#### `Quiz` tab
- Empty state: "Review with a quick quiz / flashcard" → big **`+ Create new`** button.
- Click `+ Create new` → dropdown of THREE study-artifact types:
  - **Quiz** — multiple-choice questions (default)
  - **Flashcards** — front/back card flow
  - **Practice Test (NEW)** — longer assessment

For Quiz specifically (audited):
- After clicking, a row appears: `● Quiz` with `3 Questions ▼` (collapsible).
- Pagination inside the panel: `1 / 3` with `<` `>` arrows.
- Each question: stem with KaTeX rendered → 4 multiple-choice options (A/B/C/D), each with KaTeX rendering.
- Bottom-right: orange **`Hint`** button.
- Clicking an option → immediately reveals the correct answer (marked with green ✓) and the wrong answers (red ✗ icons), and an **`Explanation`** section appears below.
- The questions are **contextual to the solved problem** — e.g., for the ODE problem, Q1 asked about the binomial expansion `(1-D)^-2` series used in the particular integral step, Q2 about why `1/D^2` is treated as double integration in the operator method, etc.
- Each Quiz generation costs ~5 credits.

#### `Follow-up questions` tab
- Header: speech-bubble icon + **"Ask about this problem"**
- Four pre-canned chips (with concise label icons):
  - 💬 **Make it easy** — re-explains the solution in plain language with bullet steps
  - 📋 **List key concepts** — extracts a glossary
  - 🎯 **Give similar practice** — generates a similar but distinct problem
  - 🌐 **Explain in English** — translates / re-renders the explanation in English
- Below: free-form `Ask about this problem` input + ↑ submit arrow.
- Clicking a chip injects a pre-canned user message **into a chat thread on the right rail** (e.g., "Make it easy" → user message shown is **"Explain this in a way that's easy to understand."**) and streams the AI response.
- The chat is contextual to the current Solver task — the LLM has the Problem + Answer + Solution as system context.
- Chat replies are followed by a `Copy` button at the bottom of each AI message. Replies use the same H3 numbered-section style as the Solver itself, BUT generally simpler / more bullet-y.
- Each chip costs ~5 credits.
- The chat persists with the task — reopening the task later shows the chat history.

### 2.5 Download modal (`Download` icon → modal)

Modal title: **"Download"**

**`Problem 1 selected`** header with `Select all` toggle on the right:
- Checkbox list of all problems in the current task (you can include OTHER recent tasks in the same export!) — so you can do **batch export of multiple solver tasks** as one document.

**`Content to include`** section (5 toggles, all on by default):
- Problem Image
- Problem Text
- Answer
- Solution
- Solution Images

**`Layout`** section:
- ◉ Each problem on a new page
- ○ Multiple problems per page

**Bottom buttons:** `DOCX` and `PDF` (orange).

So gpai.app exports as either real **DOCX or PDF** with toggleable sections and batch-mode.

### 2.6 Share popup (`Share` icon)
- Title: "Share solution"
- Globe icon + "**Public access enabled** — Anyone with this link can view your solution"
- URL: `https://gpai.app/solver/share/<id>` (truncated in UI)
- **`Copy link`** button.

The share toggle defaults to ON when you open it (or maybe you have to click to enable — couldn't tell without testing). Public link goes to a read-only view of the same Solver task.

### 2.7 First-load promo popup
On the first solver result of the session, a "Upgrade for full access" popup appears (orange CTA). Dismissable with `×`. Unrelated to the solver result itself.

---

## 3. AI Visualizer (`gpai.app/home?destination-feature=visualizer`)

### 3.1 Landing
- Headline: **"Visualize STEM concepts instantly"**
- Two input options:
  - **`Start from scratch`** card → opens a blank canvas.
  - Composer: "Enter what you want to visualize (add references for better accuracy)" with 📎 / **Ratio ▼** / **Mixture of AI ▼** / ↑ submit.
- 3 quick-prompt chips: "Water cycle diagram", "Solar system chart", "Human cell illustration".

### 3.2 Ratio dropdown (9 options)
`Auto` (default) / `1:1` / `4:3` / `3:4` / `3:2` / `2:3` / `16:9` / `9:16` / `21:9`. Sets the canvas frame size.

### 3.3 **CRITICAL: Mixture of AI dropdown (9 specialized agents)**

This is the #1 differentiator vs Forge. gpai.app routes to **9 specialized image-generation/diagramming agents** based on what the user wants to visualize:

| # | Name | Description |
|---|------|-------------|
| 1 | **Mixture of AI** *(default)* | Auto-selects the optimal image AI model |
| 2 | **Illustration AI Flash** | For illustrations and visual explanations |
| 3 | **Illustration AI Pro (Plus)** | Higher quality illustrations (Plus required) |
| 4 | **Graph AI** | For mathematical graphs and plots |
| 5 | **Flowchart AI** | For flowcharts and diagrams |
| 6 | **Diagram AI** | For technical diagrams |
| 7 | **Circuit AI** | For electronic circuit diagrams |
| 8 | **Chemistry AI** | For chemical molecular formulas |
| 9 | **Logic AI** | For digital logic circuit diagrams |

**Output style observed in Explore gallery (representative samples):**
- *Illustration*: educational hand-drawn style, anatomy/biology, with labeled callouts. Photorealistic-ish but illustrative.
- *Graph*: matplotlib-quality scientific plots — multi-trace line plots with legends, axis labels, 3D surfaces, NMR spectra, reaction coordinate diagrams, heatmaps, histograms.
- *Flowchart*: real-world software/business flowcharts with diamond decision blocks, ER-style database diagrams, network architecture topologies.
- *Diagram*: precise technical diagrams (geometric proofs, inclined-plane physics with vector arrows, 3D pyramids/prisms, isometric layouts with measurements).
- *Circuit*: real schematic-quality electrical circuit diagrams (R/L/C, op-amps with feedback, bridge circuits, multi-stage filters).
- *Chemistry*: SVG-rendered molecular structures with proper IUPAC notation — wedges/dashes for stereochemistry, ring structures, heteroatoms (S/N/O).
- *Logic*: digital gate diagrams (AND/OR/NAND/NOR/XOR, flip-flops, decoders).

### 3.4 Explore gallery
A long curated grid of past visualizations grouped by AI agent. Each card → hover shows title, click → opens a **lightbox preview** with a `Download` button (PNG?).

### 3.5 Canvas editor (when you click "Start from scratch" or open a generated viz)
Per the onboarding modal screenshot:
- **Left panel:** `Edit` / `Assets` tabs
  - Frame > Size (16:9 / 4:3 / etc.)
  - Opacity slider
- **Top toolbar:** cursor, hand (pan), shape (square), line, text, table, color/gradient picker
- **Canvas:** white frame placeholder; output renders here.

So the Visualizer is **a Figma-lite canvas editor** that wraps AI generation. You can edit the AI output by hand.

### 3.6 Cost
Visualization generation appeared to cost more credits than text features (couldn't measure precisely without running). Probably 10-30 credits depending on the agent.

---

## 4. AI Chat (`gpai.app/home?destination-feature=ai-chat`)

### 4.1 Landing
- Headline: **"Search, ask, and get deeper explanations"**
- Composer: "Type a message…" with these controls in the bottom bar:
  - 📎 attach
  - 🌐 globe (web search toggle)
  - **`Deep explain`** toggle (off by default, dotted underline indicates a feature toggle)
  - `GPAI Pro ▼` model selector
  - ↑ submit
- Hint below composer: "Add PDF, image (JPG, PNG), website and YouTube link"

### 4.2 Sample dual-pane (from landing's `Study with chat — from simple questions to deep research`)

When `Deep explain` is enabled, the response is rendered in a **dual-pane layout**:

**Left pane (chat):**
- Title bar: "Pythagorean Theorem Explained" + download / share / × icons
- User message: "Explain the Pythagorean theorem"
- AI response: "I can explain the Pythagorean theorem through its history, mathematical proofs, or practical applications." + small `● ● GPAI Pro` model badge
- **Three suggested-followup cards** with arrow indicators:
  - "What aspects of the theorem are you most interested in?" → Basic Formula & Use
  - "What is your current comfort level with geometry?" → Advanced (Mathematical)
  - "How deep should we go?" → Detailed Explanation
- Mini preview card: "The Pythagorean Theorem — Deep explain · May 25, 2026" (a saved artifact)
- Bottom: `Ask follow-up question` input

**Right pane (artifact / generated article):**
- Title: "The Pythagorean Theorem" + download / share / × icons
- Body: rendered article with H1/H2/H3, paragraphs, **inline orange-highlighted glossary terms** (right triangle, hypotenuse, Euclidean geometry — clicking opens an inline definition card).
- Inline KaTeX: `a² + b² = c²`
- Embedded **diagram** (a labeled right-triangle proof rendered as SVG).
- Bottom: small "Reading mistakes AI detected" indicator.

**Implication:** Deep Explain mode is a **chat-with-artifact** UX (like Claude Artifacts). The chat thread on the left drives the artifact on the right. Both are saved as separate but linked entities.

### 4.3 No AI Chat task was actually run in this audit (saving credits) — re-test in a future session if specific outputs are needed.

---

## 5. AI Cheatsheet Builder (`gpai.app/home?destination-feature=cheatsheet`)

### 5.1 Landing
- Headline: **"Create exam-ready cheatsheet"**
- Composer: "Enter a topic or upload files" with 📎 + ↑ only (no model selector, no other controls)
- 3 quick-prompt chips: "Generate 2 page mechanics cheatsheet for Hibbeler" / "Generate 2 page cheat sheet for Halliday Physics" / "Generate 2 page algorithm cheatsheet for CLRS"

### 5.2 Sample (Hibbeler Mechanics Cheatsheet)
A real A4-style multi-column cheatsheet, paginated. Layout:

**Left chat-edit pane** (narrower, ~30% width):
- Title: "Hibbeler Mechanics Cheatsheet" with rename pencil
- User message bubble: "Generate 2 page mechanics cheatsheet for Hibbeler"
- AI artifact: "See Version 1 - Initial draft" — a clickable version label
- Bottom: "Ask for changes" input + orange ↑

**Right cheatsheet pane** (~70% width):
- Top toolbar: `1 / 2` page navigation (paginated A4!), `100%` zoom controls, format buttons (`105% 0%`, formatting selector, B / I / U / strikethrough, lists, alignment).
- **`Edit via chat`** toggle at the top of the cheatsheet body.
- The cheatsheet itself: real **3-column A4 layout** with sections:
  - Column 1: "Units and Dimensions", "Vectors", "Force Systems", "Resultant of Concurrent Forces", "Center of Gravity and Centroid"
  - Column 2: "Free-Body Diagram (FBD)", "Equilibrium of a Rigid Body", "Trusses, Frames, and Machines", "Friction"
  - Column 3: "Parallel Axis Theorem", "Method of Sections", "Friction (cont'd)", "Wedges, Belts and Pulleys", "Virtual Work"…
- Each section: **bold heading** + tightly-formatted bullets/formulas with KaTeX rendering (`F = mg sin θ`, `M_O = r × F`, `μ = tan φ`, etc.). Spacing is dense — designed for printing on physical paper.
- The body is **WYSIWYG-editable** via the format toolbar.

### 5.3 Implications
Cheatsheet has:
- **Multi-version system** (Version 1, 2, ... — re-prompts create new versions)
- **Paginated A4 layout** with multi-column rendering (CSS columns or grid)
- **`Ask for changes` chat** to iteratively edit
- **`Edit via chat` toggle** (probably switches between AI-edit and direct WYSIWYG editing modes)
- Real **page numbering** (`1 / 2`)
- **Zoom controls** for print preview
- Density-tuned typography for cheatsheet aesthetic

---

## 6. AI Report Writer (`gpai.app/home?destination-feature=report-writer`)

### 6.1 Landing
- Headline: **"Draft reports and refine them with AI"**
- Two input options:
  - `Start from scratch` (Blank page) card
  - Composer: "Describe the report you want to create or what you'd like to edit…" with 📎 + ↑

### 6.2 Sample (Neural Networks Image Recognition Report)

**Dual-pane:**
- Left chat: User msg "Write a report on how neural networks recognize images. Add images if needed." → AI response with **`Process` indicator** at top + body explanation. Buttons: `Undo` / `Try again`. Bottom: "Describe the report you want to create or what you'd like to edit…" input + `Add files` button.
- Right document: WYSIWYG editor with:
  - Format toolbar: B / I / U / strikethrough, lists, alignment, highlight, undo/redo
  - Title (H1): "How Neural Networks Recognize Images"
  - Body paragraphs: "Image recognition is one of the most visible successes of modern AI…"
  - H2: "The Architecture of Vision: Convolutional Neural Networks (CNNs)"
  - **Bulleted list with bold leads:** "**Convolutional Layers**: These layers use 'filters'…", "**Pooling Layers**: These layers reduce dimensions…", "**Fully Connected Layers**: After several rounds…"
  - **Embedded auto-generated diagram!** A CNN architecture flowchart with cars → "Input Layer", "Convolution Layer 1", "Pooling Layer 1", … → "Fully Connected Layer" → "Car" output classification. The Report Writer **calls into the Visualizer** to embed diagrams inline.
  - Top-right: **`Export`** button.

### 6.3 Export menu
The Export menu in the dual-pane editor shows: Copy / PDF / DOCX (per gpai-features-reference.md prior screenshots). I didn't re-open it in this audit because we already have it documented.

### 6.4 Comparable to: Notion AI / Coda AI / Claude Artifacts.

---

## 7. AI PDF Notes (`gpai.app/home?destination-feature=pdf-notes`)

### 7.1 Landing
- **`BETA`** badge at top.
- Headline: **"Turn any PDF into complete visual notes"**
- **`Today's free PDF Notes — During Beta, you get 2 free PDF Notes per day`** banner with `Claim` button. (Free quota separate from credits.)
- **Output language** dropdown (default: English) — multilingual output supported.
- Drop zone: "Select a PDF or drag and drop here. Max 100MB · up to 1500 pages." Big `Select file` button.
- **`Create notes`** button at bottom (greyed out until file selected).
- Below: **Explore Sample Notes** section with 4+ curated sample cards (Attention Is All You Need, Word2Vec paper, CLRS algorithms book, "Red Blood Cells, Anemia, and Polycythemia" medical chapter).

### 7.2 Detail page (`gpai.app/pdf-notes/detail?id=<uuid>`)
- Back button + thumbnail card with title + **`<subject> · <level> · ENGLISH · <pageCount>p`** metadata (e.g., "CS · graduate · ENGLISH · 15p" — gpai auto-classifies by subject and academic level).
- Top-right: download / share / `…`.
- **`SECTIONS`** label.
- Each section: green ✓ checkmark + section title + "p. <range>" page-range chip on the right (e.g., "01 ✓ Main Architecture and Results — p. 2-15").

### 7.3 Section view (`gpai.app/pdf-notes/section?id=<uuid>&sectionId=<uuid>`)

**Three-pane layout:**

**Left rail (sticky TOC):**
- "← Back to sections"
- `SECTIONS` label
- Each top-level section is a clickable header (e.g., "01 Main Architecture and Results")
- Sub-outline expanded for the active section: a hierarchical numbered tree
  - "Transformer Model" (current)
    - 1. Introduction
    - 2. Background
    - 3. Model Architecture
      - 3.1. Encoder and Decoder Stacks (sub-sub)
      - 3.2. Attention
      - 3.3. Position-wise Feed-Forward Net…
      - 3.4. Embeddings and Softmax
      - 3.5. Positional Encoding
    - 4. Why Self-Attention
    - 5. Training
      - 5.1. Training Data and Batching
      - 5.2. Hardware and Schedule
      - 5.3. Optimizer
      - 5.4. Regularization
    - 6. Results
      - 6.1. Machine Translation
      - 6.2. Model Variations
      - 6.3. English Constituency Parsing
    - 7. Conclusion
- The current sub-section is highlighted.

**Top bar:**
- "Main Architecture and Results · p. 2-15"
- `Send feedback` (orange button)
- 📥 download / `…` overflow
- **`A-` `A+` `Reset`** font-size controls (3 explicit buttons)

**Center body:**
- Massive structured study-notes.
- Heading hierarchy: H1 (Transformer Model) → H2 (1. Introduction, 2. Background…) → H3 (3.1, 3.2, 3.2.1 Scaled Dot-Product Attention…)
- **Each section is a colored info-box** (light tan background) with:
  - Bulleted key points
  - Sub-bullets for nested concepts (often 2-3 levels deep)
  - **Bold lead-in keywords** inside bullets (e.g., "**Problem with recurrent models**:", "**Attention mechanisms**:", "**The Transformer**:")
- **Highlighted clickable terms** in body text (orange dotted underline) — same UX as Solver glossary.
- Inline **KaTeX**: `N=6`, `d_{model}=512`, `d_k`, `d_v`, etc.
- Inline **monospace code blocks** (rendered with light grey background): `LayerNorm(x + Sublayer(x))`.
- **Auto-generated diagrams** from the source paper (e.g., "Scaled Dot-Product Attention" with stacked colored boxes showing MatMul → SoftMax → Mask → Scale → MatMul).

**Bottom navigation:**
- `< Previous` / `1/1` / `Next >` — paginated within the section. Each section can have multiple "pages" of notes if the source content is long.

### 7.4 Implications
The PDF Notes pipeline is essentially a **multi-stage paper-to-study-notes converter:**
1. Parse PDF → extract structure (sections, subsections).
2. LLM summary per section → structured bulleted notes with bold leads, KaTeX math, code blocks.
3. Re-render diagrams by either (a) extracting from source or (b) regenerating via Visualizer agents.
4. Per-section pagination if notes exceed a length threshold.
5. Glossary auto-extraction → orange-highlighted clickable terms.

This is way beyond "stream a single markdown blob."

---

## 8. AI Notebook (`gpai.app/notebook/subject?id=<uuid>`)

### 8.1 Landing (`gpai.app/home?destination-feature=note`)
- Headline: **"Chat with your materials"**
- Empty state: "No notebooks yet. Create one to start organizing your materials." + `+ Create new` button.

### 8.2 Notebook view (after `+ Create new`)
URL: `gpai.app/notebook/subject?id=<uuid>`

**Layout (split-pane):**

**Left pane (sources / artifacts):**
- **Multi-tab interface!** Top: `New tab ×` + `+` button to add more notebook tabs in the same session.
- Title (editable): "Untitled notebook"
- Subtitle: "1 files" (live count)
- **`+ Create new note`** card → opens "Create" modal (see §8.3)
- **`Files`** label with folder icon at right (open file browser?)
- **`+ Add Source`** link → opens "Add source" modal (see §8.4)
- The pane lists each source/artifact below.

**Right pane (chat + study log):**
- Tabs at top: `Chat` / `Study Log` + close `×`
- `Current chat ▼` dropdown (multi-chat support — multiple chat threads per notebook!)
- `+` to start a new chat
- Bottom: `Ask about your materials...` input with file-attach + emoji icons + ↑ submit.

### 8.3 `Create new note` modal — generates study artifacts
Title: "Create" — subtitle: "What kind of note would you like to generate?"

Three artifact types:
1. **Summary** (default selected) — "Generate a summary based on all the sources you uploaded."
2. **Quiz** — "Generate quiz questions and practice solving them."
3. **Flashcard** — "Generate flashcards and check the answers with a simple click."

**`Sources`** section: `0/20 selected` — pick which uploaded sources to include. Search box. Each source = a checkbox row with the file icon + name.

`Create` button (disabled until ≥1 source selected).

### 8.4 `Add Source` modal
Title: "Add source"

Drop zone: "Drag and drop files here. PDF, images, documents, audio, video"

Four explicit source-type buttons:
- 📎 **Upload** (file picker)
- ▶️ **YouTube** (video URL)
- 🟡 **Drive** (Google Drive)
- T **Text** (paste text directly)

`Add` button at bottom.

### 8.5 Study Log
A free-form notes/journal pane. Placeholder: "내용을 입력하세요..." (Korean: "Enter content..." — the product was clearly built primarily for Korean users; that placeholder leaked here. Bug? Or intentional?). This is essentially a Markdown editor for the user's own study reflections.

### 8.6 Implications
Notebook is a **NotebookLM clone** with extras:
- Multi-tab UI (multiple notebooks open at once in the same window)
- Multi-chat-per-notebook (vs NotebookLM's single chat)
- 7 source types (PDF / images / docs / audio / video / YouTube / Drive / Text)
- 3 artifact types (Summary / Quiz / Flashcard)
- Separate Study Log journal area
- Up to 20 sources combined per artifact

---

## 9. Common cross-feature patterns

### 9.1 Inline orange-highlighted glossary terms
Used in: Solver, AI Chat artifact, PDF Notes section view. Probably in Cheatsheet too.
**Spec:** orange dotted underline → click → small inline tooltip with a one-sentence definition. Glossary is auto-extracted from the response text by an LLM pass.

### 9.2 Cross-checked badge
Solver only (so far observed). When using GPAI Pro, two avatar circles appear next to the Answer with the label "Cross-checked". Tooltip on hover: model names. Suggests that gpai.app runs a verifier model in parallel to the solver and shows the consensus.

### 9.3 Auto-titled tasks
When you submit anything (Solver, Cheatsheet, Report, etc.), the resulting task is auto-titled by an LLM (e.g., "Ordinary Differential Equation", "Hibbeler Mechanics Cheatsheet", "Neural Networks Image Recognition Report"). The title shows in the sidebar Recent within ~1 second of submit.

### 9.4 Per-task share modal with public link
Solver and likely Report/PDF Notes/Notebook all support a **public-link share** mode where a separate read-only URL is generated. URL pattern observed: `gpai.app/solver/share/<id>`. Probably similar for other features (`/report/share/<id>`, `/notebook/share/<id>`, etc.).

### 9.5 Per-task export modal with section toggles
Solver export has: which problems to include, which sections (Problem/Answer/Solution/etc.) to include, layout options (one-per-page vs multiple), and PDF/DOCX format choice. Probably similar pattern in other features (with feature-specific section toggles).

### 9.6 Streaming UX
- All long-form responses stream token-by-token.
- **Sections stream in parallel:** the Solver shows `Answer` with a spinner while `Solution` is already rendering below. This is critical for perceived speed — does NOT block one section behind another. Probably implemented by streaming a structured event stream (e.g., `{section: "answer", delta: "..."}`) from the backend.

### 9.7 Adaptive personalization
Settings → Personalize allows you to set occupation + custom instructions (10K char limit). Used only in Solver and AI Chat. Likely injected into the system prompt.

### 9.8 Beta-program quotas + free credits
- **Daily credits:** 50/day for free plan (consumed by Solver / Visualizer / Chat / etc.). Solver task ≈ 30 credits, Quiz ≈ 5 credits, Follow-up chip ≈ 5 credits.
- **PDF Notes:** separate "2 free per day during Beta" quota — credits NOT used.
- Upgrade button in sidebar always visible.

---

## 10. Korean origin clue
The Study Log placeholder leaked Korean: "내용을 입력하세요..." (Enter content...). gpai.app appears to be a Korean-built product (the team behind it is likely Korean — confirms our research note in `gpai-features-reference.md`).

---

## 11. Deep gaps vs. Forge (our clone)

Stack-ranked by user impact (most visible to least):

| # | Gap | Forge today | gpai.app | Effort |
|---|-----|-------------|----------|--------|
| 1 | **Specialized visualization agents** (Graph/Flowchart/Diagram/Circuit/Chemistry/Logic) | single mermaid render | 9 specialized AI agents | XL |
| 2 | **Cross-checked Solver answers (multi-model verifier)** | single model | two-model parallel verifier with badge | M |
| 3 | **Inline orange glossary terms** w/ click-to-define | none | site-wide pattern | M |
| 4 | **Quiz / Follow-up panel functional** (chips actually fire) | broken (BACKLOG #1, #2) | works | S |
| 5 | **Streaming sections in parallel** (Answer + Solution side-by-side) | sequential | parallel | M |
| 6 | **Export modal** with section toggles + DOCX + PDF + batch-multi-task | print-to-PDF only | rich modal | M |
| 7 | **Public-link share** (`/<feature>/share/<id>`) | none | universal | M |
| 8 | **Cheatsheet versioning + paginated A4 + 3-column layout + Edit-via-chat** | single markdown blob | full WYSIWYG | L |
| 9 | **Report Writer dual-pane with embedded auto-generated diagrams** | text-only | Visualizer-embedded | L |
| 10 | **PDF Notes hierarchical TOC + per-section paginated study notes** | single blob | full nested outline | L |
| 11 | **AI Chat dual-pane "Deep explain" mode (chat + artifact)** | single chat | Claude-Artifacts-style | L |
| 12 | **Notebook multi-tab + multi-chat-per-notebook + Study Log** | single tab | full | L |
| 13 | **Notebook source types (YouTube / Drive / audio / video)** | PDF + img only | 7 types | M-L |
| 14 | **Auto-titled tasks** (LLM extracts a task title from problem) | timestamp ID | descriptive title | XS |
| 15 | **Suggested follow-up cards in chat replies** ("What aspects?", "Comfort level?", etc.) | none | adaptive | S |
| 16 | **Personalize page** (occupation + custom instructions, 10K chars) | none | settings tab | S |
| 17 | **Quiz with hints + per-question explanations + question pagination** | broken | full | S-M |
| 18 | **Quiz / Flashcard / Practice Test as artifact types** | only Quiz attempted | 3 types | M |
| 19 | **Per-section font size controls (`A- A+ Reset`)** in PDF Notes | none | yes | XS |
| 20 | **Subject + level auto-classification** ("CS · graduate · 15p") for PDF Notes | none | yes | S |
| 21 | **Multilingual output language selector** in PDF Notes | none | yes | S |
| 22 | **`Cross-check with [model icons]` indicator** on the model selector | none | yes | XS |
| 23 | **`Try-demo` carousel cards on Solver landing** | static, more bland | rotating, polished | XS |
| 24 | **Sidebar "Recent" with rename/delete per item** | TBD | yes | XS |

---

## 12. End of audit

This was a non-destructive audit — no data was created on the user's account beyond:
- 1 Solver task ("Ordinary Differential Equation")
- 1 Quiz generation (3 questions)
- 1 Follow-up "Make it easy" message

Credit usage: 50 → 15 (35 credits consumed for full Solver+Quiz+Follow-up walkthrough).

The 46 screenshots in `research/screenshots/audit-2026-05-02/` cover every page documented above. Each numbered prefix corresponds to the section it documents (01-16 = Solver, 17-22 = Home/Settings, 23-33 = Visualizer, 34-35 = AI Chat, 36-37 = Cheatsheet, 38-39 = Report Writer, 40-42 = PDF Notes, 43-46 = Notebook).
