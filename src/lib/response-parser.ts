import type {
  EducationRequest,
  EducationResponse,
  GlossaryEntry,
  PracticeItem,
  SolutionStep,
  VerificationSignal,
} from "@/types/education";

function extractSection(markdown: string, heading: string): string {
  const pattern = new RegExp(
    `^#{1,3}\\s*${heading}[^\\n]*\\n([\\s\\S]*?)(?=^#{1,3}\\s|$)`,
    "im",
  );
  const match = pattern.exec(markdown);
  return match ? match[1].trim() : "";
}

function extractBullets(section: string): string[] {
  return section
    .split("\n")
    .map((line) => line.replace(/^[-*•]\s*/, "").replace(/^\d+[.)]\s*/, "").trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

function parseSteps(markdown: string): SolutionStep[] {
  const solutionSection =
    extractSection(markdown, "Solution") ||
    extractSection(markdown, "Derivation") ||
    extractSection(markdown, "Steps");

  if (!solutionSection) return [];

  const stepPattern = /###\s*(?:\d+[.)]\s*)?(.+?)\n([\s\S]*?)(?=###\s|$)/g;
  const steps: SolutionStep[] = [];
  let match;

  while ((match = stepPattern.exec(solutionSection)) !== null) {
    const title = match[1].trim();
    const body = match[2].trim();

    const formulaMatch = /\$\$\n?([\s\S]*?)\n?\$\$/.exec(body);
    const teachingNoteMatch =
      /\*\*(?:Teacher|Teaching|Note|Tip)[^*]*\*\*[:\s]*(.*)/i.exec(body);

    steps.push({
      title,
      body: body
        .replace(/\$\$[\s\S]*?\$\$/g, "")
        .replace(/\*\*(?:Teacher|Teaching|Note|Tip)[^*]*\*\*[:\s]*.*/gi, "")
        .trim(),
      formula: formulaMatch ? formulaMatch[1].trim() : undefined,
      teachingNote: teachingNoteMatch
        ? teachingNoteMatch[1].trim()
        : undefined,
    });
  }

  return steps;
}

/**
 * Pull an inline "(Answer: X)" / "[Ans: X]" / "— Answer: X" suffix out of
 * a question line. Returns the cleaned question + the extracted answer
 * (or `null` if there was nothing inline).
 *
 * Older Solver prompts (pre-PR #41) explicitly told the model to
 * format quiz items with the answer baked in like:
 *
 *   What is the order of (D-2D³+D²)y=x³? (Answer: 3)
 *
 * which made the answer leak into the rendered question text. The
 * prompt has since been changed to require a two-line Q:/A: shape, but
 * this stripping pass keeps the old shape working for cached
 * responses, prompt drift, and any other model that ignores
 * instructions.
 */
function stripInlineAnswer(line: string): { question: string; answer: string | null } {
  // `(Answer: ...)` / `(Ans.: ...)` / `[Answer: ...]` etc. anywhere in the
  // line. Greedy on the answer body so trailing punctuation stays attached.
  const inlineRe = /[\s,;—–-]*[(\[]\s*A(?:nswer|ns\.?)?\s*[:=]\s*([^()\[\]]+?)\s*[)\]][.?!]?\s*$/i;
  const inlineMatch = line.match(inlineRe);
  if (inlineMatch) {
    return {
      question: line.slice(0, inlineMatch.index).trim().replace(/[—–-]+\s*$/, "").trim(),
      answer: inlineMatch[1].trim(),
    };
  }
  // `— Answer: X` / `Answer — X` style at the end of the line, no
  // brackets. Require a clear delimiter so we don't eat normal prose.
  const dashRe = /\s+(?:[—–-]+|→)\s*A(?:nswer|ns\.?)?\s*[:=]\s*(.+?)\s*$/i;
  const dashMatch = line.match(dashRe);
  if (dashMatch) {
    return {
      question: line.slice(0, dashMatch.index).trim(),
      answer: dashMatch[1].trim(),
    };
  }
  return { question: line, answer: null };
}

function parseQAItems(section: string): PracticeItem[] {
  if (!section.trim()) return [];
  const items: PracticeItem[] = [];

  const lines = section.split("\n").filter((l) => l.trim().length > 0);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
      .replace(/^\d+[.)]\s*/, "")
      .replace(/^[-*•]\s*/, "")
      .replace(/^\*\*Q(?:uestion)?[:.]?\*\*\s*/i, "")
      .replace(/^Q(?:uestion)?\s*[:.]\s*/i, "")
      .trim();

    if (line.length <= 5) continue;

    // Pull "(Answer: X)" off the question first so we never let it
    // visually leak into the rendered question text. If found, that
    // also satisfies the next-line answer check.
    const inline = stripInlineAnswer(line);
    if (inline.answer) {
      items.push({ question: inline.question, answer: inline.answer });
      continue;
    }

    const nextLine = lines[i + 1] || "";
    const isAnswer = /^\s*\*\*A(?:nswer)?[:.]?\*\*/i.test(nextLine) ||
      /^\s*A(?:nswer)?[:.]?\s/i.test(nextLine);

    if (isAnswer) {
      items.push({
        question: line,
        answer: nextLine
          .replace(/^\s*\*\*A(?:nswer)?[:.]?\*\*\s*/i, "")
          .replace(/^\s*A(?:nswer)?[:.]?\s*/i, "")
          .trim(),
      });
      i++;
    } else if (line.includes("?") || /^\d/.test(lines[i])) {
      items.push({
        question: line,
        answer: "Work through this problem step by step.",
      });
    }
  }

  if (items.length === 0) {
    for (const line of lines) {
      const cleaned = line
        .replace(/^\d+[.)]\s*/, "")
        .replace(/^[-*•]\s*/, "")
        .trim();
      if (cleaned.length > 5) {
        items.push({
          question: cleaned,
          answer: "Work through this problem step by step.",
        });
      }
    }
  }

  return items;
}

/**
 * Pull glossary entries out of the model's `## Glossary` section.
 *
 * The prompt asks the model to emit one bullet per term in the shape:
 *
 *     - linear ODE — A differential equation linear in y and its derivatives.
 *
 * The dash separator can be `—` (em-dash, what we tell the model to use)
 * or `-` / `–` / `:` (what some models substitute). Definition is one
 * line of plain prose. Terms with LaTeX, markdown emphasis, or weird
 * punctuation are dropped — they wouldn't render correctly inside an
 * inline `<span>` overlay anyway.
 */
function parseGlossarySection(section: string): GlossaryEntry[] {
  if (!section.trim()) return [];
  const out: GlossaryEntry[] = [];
  const seen = new Set<string>();

  for (const rawLine of section.split("\n")) {
    const line = rawLine
      .replace(/^[-*•]\s*/, "")
      .replace(/^\d+[.)]\s*/, "")
      .trim();
    if (!line) continue;

    // Match: "<term> <separator> <definition>" where separator is em-dash,
    // en-dash, double-hyphen, hyphen-with-spaces, or a colon.
    const match = /^(.+?)\s*(?:—|–|--|-\s|:\s)\s*(.+)$/.exec(line);
    if (!match) continue;

    const term = match[1]
      .trim()
      .replace(/^\*\*(.*)\*\*$/, "$1")
      .replace(/^["'`](.*)["'`]$/, "$1")
      .trim();
    const definition = match[2]
      .trim()
      .replace(/^\*\*(.*)\*\*$/, "$1")
      .replace(/[.,;:!?]$/, "")
      .trim();

    // Sanity: terms must be 1–4 words of letters/digits/space/hyphen, no
    // LaTeX, no markdown, no parens.
    if (term.length < 2 || term.length > 60) continue;
    if (!/^[A-Za-z0-9][A-Za-z0-9 \-']{0,58}[A-Za-z0-9]$/.test(term)) continue;
    if (term.split(/\s+/).length > 4) continue;
    if (definition.length < 4 || definition.length > 240) continue;

    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ term, definition: definition + (/[.!?]$/.test(definition) ? "" : ".") });
    if (out.length >= 12) break; // hard cap
  }

  return out;
}

function inferTitle(request: EducationRequest): string {
  if (request.mode === "visualizer") return "AI-Generated Visual Plan";
  if (request.mode === "cheatsheet") return "Exam-Ready Cheatsheet";
  if (request.mode === "chat") return "Deep STEM Explanation";

  const words = request.prompt.split(/\s+/).slice(0, 8).join(" ");
  return words.length > 40 ? `${words.slice(0, 40)}…` : words || "STEM Solution";
}

function extractAnswer(markdown: string): string {
  const answerSection = extractSection(markdown, "Answer");
  if (answerSection) {
    const mathMatch = /\$\$?\s*([\s\S]*?)\s*\$\$?/.exec(answerSection);
    if (mathMatch) return mathMatch[1].trim();

    const firstLine = answerSection.split("\n")[0].trim();
    if (firstLine) return firstLine;
  }

  const directMatch = /##\s*(?:Direct\s+)?Answer[^#\n]*\n\s*(.+)/i.exec(markdown);
  if (directMatch) return directMatch[1].trim();

  return "";
}

export function parseModelResponse(
  markdown: string,
  request: EducationRequest,
  verification: VerificationSignal[],
  options: { titleOverride?: string | null } = {},
): EducationResponse {
  const answer =
    extractAnswer(markdown) ||
    "See the full solution below.";

  const steps = parseSteps(markdown);

  const conceptsSection =
    extractSection(markdown, "Key concepts") ||
    extractSection(markdown, "Key Concepts") ||
    extractSection(markdown, "Concepts");
  const keyConcepts = extractBullets(conceptsSection);

  const mistakesSection =
    extractSection(markdown, "Revised mistakes") ||
    extractSection(markdown, "Common mistakes") ||
    extractSection(markdown, "Mistakes") ||
    extractSection(markdown, "Common Mistakes");
  const commonMistakes = extractBullets(mistakesSection);

  const checksSection =
    extractSection(markdown, "Verification") ||
    extractSection(markdown, "Cross-check") ||
    extractSection(markdown, "Checks");
  const checks = extractBullets(checksSection);

  const followUpSection =
    extractSection(markdown, "Follow-up") ||
    extractSection(markdown, "Follow up") ||
    extractSection(markdown, "Suggested follow");
  const followUps = extractBullets(followUpSection).slice(0, 5);

  const quizSection = extractSection(markdown, "Quiz");
  const quiz = parseQAItems(quizSection);

  const practiceSection =
    extractSection(markdown, "Similar practice") ||
    extractSection(markdown, "Practice");
  const practice = parseQAItems(practiceSection);

  const visualPlanSection =
    extractSection(markdown, "Visual") ||
    extractSection(markdown, "Diagram") ||
    extractSection(markdown, "Cheatsheet suggestions");
  const visualPlan = extractBullets(visualPlanSection).slice(0, 6);

  const cheatsheetSection =
    extractSection(markdown, "Cheatsheet") ||
    extractSection(markdown, "Study notes");
  const cheatsheetBlocks: SolutionStep[] = extractBullets(cheatsheetSection).map(
    (item) => ({
      title: item.split(":")[0] || item,
      body: item.split(":").slice(1).join(":").trim() || item,
    }),
  );

  const glossarySection = extractSection(markdown, "Glossary");
  const glossary = parseGlossarySection(glossarySection);

  const overrideTitle = options.titleOverride?.trim();
  const finalTitle =
    overrideTitle && overrideTitle.length > 0
      ? overrideTitle
      : inferTitle(request);

  return {
    id: `gen_${Date.now()}`,
    title: finalTitle,
    mode: request.mode,
    prompt: request.prompt,
    answer,
    solution: markdown,
    steps:
      steps.length > 0
        ? steps
        : [{ title: "Full solution", body: markdown.slice(0, 500) }],
    keyConcepts:
      keyConcepts.length > 0
        ? keyConcepts
        : ["See the solution for key concepts."],
    commonMistakes:
      commonMistakes.length > 0
        ? commonMistakes
        : ["Review the solution for common pitfalls."],
    checks:
      checks.length > 0 ? checks : ["Solution verified by AI model."],
    practice:
      practice.length > 0
        ? practice
        : [
            {
              question: "Try a similar problem with different values.",
              answer: "Apply the same method shown above.",
            },
          ],
    quiz:
      quiz.length > 0
        ? quiz
        : [
            {
              question: "What is the key concept in this solution?",
              answer: "Review the steps above to identify the core method.",
            },
          ],
    visualPlan:
      visualPlan.length > 0
        ? visualPlan
        : ["See the solution for visual and study suggestions."],
    cheatsheetBlocks:
      cheatsheetBlocks.length > 0
        ? cheatsheetBlocks
        : [{ title: "Study block", body: "Review the key formulas above." }],
    followUps:
      followUps.length > 0
        ? followUps
        : [
            "Make it easier",
            "List key concepts",
            "Give similar practice",
            "Explain in plain English",
            "Create a quiz",
          ],
    glossary: glossary.length > 0 ? glossary : undefined,
    confidence: verification.some((v) => v.status === "complete") ? 0.92 : 0.78,
    verification,
    createdAt: new Date().toISOString(),
  };
}
