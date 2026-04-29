import type {
  EducationRequest,
  EducationResponse,
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
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

function extractNumberedItems(section: string): string[] {
  return section
    .split("\n")
    .map((line) => line.replace(/^\d+[.)]\s*/, "").trim())
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

function parseQAItems(section: string): PracticeItem[] {
  const items: PracticeItem[] = [];

  const qaPattern =
    /(?:^|\n)\d*[.)]*\s*\**(?:Q(?:uestion)?[:.]?\s*)?\**\s*(.+?)(?:\n\s*\**(?:A(?:nswer)?[:.]?\s*)\**\s*(.+?))?(?=\n\d+[.)]\s|\n\n|$)/gi;
  let match;

  while ((match = qaPattern.exec(section)) !== null) {
    const question = match[1]?.trim();
    const answer = match[2]?.trim() || "Think about this and check your work.";
    if (question && question.length > 5) {
      items.push({ question, answer });
    }
  }

  if (items.length === 0) {
    const lines = extractNumberedItems(section);
    for (const line of lines) {
      if (line.length > 5) {
        items.push({
          question: line,
          answer: "Work through this problem step by step.",
        });
      }
    }
  }

  return items;
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
  return "";
}

export function parseModelResponse(
  markdown: string,
  request: EducationRequest,
  verification: VerificationSignal[],
): EducationResponse {
  const answer =
    extractAnswer(markdown) ||
    "See the full solution below.";

  const steps = parseSteps(markdown);

  const conceptsSection =
    extractSection(markdown, "Key concepts") ||
    extractSection(markdown, "Key Concepts") ||
    extractSection(markdown, "Concepts");
  const keyConcepts =
    extractBullets(conceptsSection).length > 0
      ? extractBullets(conceptsSection)
      : extractNumberedItems(conceptsSection);

  const mistakesSection =
    extractSection(markdown, "Revised mistakes") ||
    extractSection(markdown, "Common mistakes") ||
    extractSection(markdown, "Mistakes") ||
    extractSection(markdown, "Common Mistakes AI");
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

  return {
    id: `gen_${Date.now()}`,
    title: inferTitle(request),
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
    confidence: verification.some((v) => v.status === "complete") ? 0.92 : 0.78,
    verification,
    createdAt: new Date().toISOString(),
  };
}
