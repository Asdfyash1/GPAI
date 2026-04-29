import type {
  EducationRequest,
  EducationResponse,
  SolutionStep,
  VerificationSignal,
} from "@/types/education";

const algebraSteps: SolutionStep[] = [
  {
    title: "Identify the structure",
    body: "The equation is a quadratic in standard form $ax^2+bx+c=0$, with $a=1$, $b=-5$, and $c=6$.",
    formula: "\\begin{aligned}x^2 - 5x + 6 &= 0\\\\a&=1,\\quad b=-5,\\quad c=6\\end{aligned}",
    teachingNote: "A quadratic usually has up to two solutions because the highest power is 2.",
  },
  {
    title: "Find a factor pair",
    body: "We need two numbers that multiply to $6$ and add to $-5$. The pair $-2$ and $-3$ works.",
    formula: "\\begin{aligned}(-2)(-3)&=6\\\\-2+(-3)&=-5\\end{aligned}",
    teachingNote: "The product is positive and the sum is negative, so both numbers must be negative.",
  },
  {
    title: "Factor and solve",
    body: "Rewrite the quadratic as a product and use the zero product property.",
    formula: "\\begin{aligned}(x-2)(x-3)&=0\\\\x-2&=0\\quad\\text{or}\\quad x-3=0\\\\x&=2\\quad\\text{or}\\quad x=3\\end{aligned}",
    teachingNote: "If two factors multiply to zero, at least one factor must equal zero.",
  },
  {
    title: "Check the roots",
    body: "Substitute each answer into the original equation. Both make the left side equal zero.",
    formula: "\\begin{aligned}2^2-5(2)+6&=4-10+6=0\\\\3^2-5(3)+6&=9-15+6=0\\end{aligned}",
    teachingNote: "A final substitution check catches sign and factoring errors.",
  },
];

const visualizerSteps: SolutionStep[] = [
  {
    title: "Canvas composition",
    body: "Place the main concept in the center, supporting labels around it, and a formula strip at the bottom.",
    formula: "layout = concept + labels + formula + legend",
  },
  {
    title: "Scientific labeling",
    body: "Every arrow, axis, component, and region should have a short label plus units when applicable.",
  },
  {
    title: "Quality pass",
    body: "Check that the diagram has no ambiguous arrows, missing units, or unlabeled variables.",
  },
];

const cheatsheetSteps: SolutionStep[] = [
  {
    title: "Core formulas",
    body: "List high-yield formulas first, grouped by concept, with variable definitions next to each formula.",
    formula: "concept \\rightarrow formula \\rightarrow when\\ to\\ use",
  },
  {
    title: "Mini examples",
    body: "Add one solved micro-example per major formula so the sheet teaches pattern recognition.",
  },
  {
    title: "Exam traps",
    body: "Reserve a compact block for sign errors, unit conversions, boundary cases, and vocabulary traps.",
  },
];

function modeSteps(request: EducationRequest) {
  if (request.mode === "visualizer") return visualizerSteps;
  if (request.mode === "cheatsheet") return cheatsheetSteps;
  return algebraSteps;
}

function inferTitle(request: EducationRequest) {
  if (request.mode === "visualizer") return "Publication-Ready STEM Visual Plan";
  if (request.mode === "cheatsheet") return "Exam-Ready Study Cheatsheet";
  if (request.mode === "chat") return "Deep STEM Explanation";
  return request.prompt.toLowerCase().includes("quadratic")
    ? "Quadratic Equation Solution"
    : "Textbook-Grade STEM Solution";
}

function inferAnswer(request: EducationRequest) {
  const prompt = request.prompt.toLowerCase();

  if (request.mode === "visualizer") {
    return "A clear labeled diagram plan with hierarchy, formula callouts, variants, and export-ready layout.";
  }

  if (request.mode === "cheatsheet") {
    return "A compact printable study sheet with formulas, examples, traps, and review prompts.";
  }

  if (prompt.includes("x^2") && prompt.includes("- 5x") && prompt.includes("+ 6")) {
    return "x=2 \\text{ or } x=3";
  }

  return "A structured solution is generated with answer, reasoning, verification, mistakes, and practice.";
}

function buildMarkdown(request: EducationRequest, steps: SolutionStep[]) {
  const answer = inferAnswer(request);
  const stepText = steps
    .map(
      (step, index) =>
        `### ${index + 1}. ${step.title}\n${step.body}${
          step.formula ? `\n\n$$\n${step.formula}\n$$` : ""
        }${step.teachingNote ? `\n\n**Teacher note:** ${step.teachingNote}` : ""}`,
    )
    .join("\n\n");

  if (request.mode === "visualizer") {
    return `## Final visual direction\n${answer}\n\n${stepText}\n\n### Diagram specification\n- Use a clean dark-on-light canvas with high contrast labels.\n- Add a formula panel for the governing equation.\n- Generate 3 variants: simple classroom version, exam-note version, and presentation version.\n- Run a structural check for missing labels, incorrect direction arrows, and clutter.`;
  }

  if (request.mode === "cheatsheet") {
    return `## Cheatsheet objective\n${answer}\n\n${stepText}\n\n### Recommended blocks\n- Definitions and symbols\n- Formula map\n- Worked micro-examples\n- Common traps\n- 5-minute review quiz`;
  }

  return `## Problem\n${request.prompt}

## Answer\n${answer}

## Cross-check status\nThe result is checked by direct substitution and by the factor-product/sum rule.

## Solution\n${stepText}

## Verification\nBoth candidate values make the original equation equal zero, so the answer is consistent.

## Revised mistakes AI detected\n- Picking factors with the right product but wrong sum.\n- Forgetting that $(x-r)=0$ gives $x=r$.\n- Skipping the substitution check.\n\n## Follow-up questions\n- Make it easy\n- List key concepts\n- Give similar practice\n- Explain in English\n\n## Quiz\n1. Why must the factor pair be $-2$ and $-3$, not $2$ and $3$?\n2. What property lets us set each factor equal to zero?\n\n
## Similar practice\nSolve $x^2-7x+10=0$, then verify both roots.`;
}

export function buildDemoResponse(request: EducationRequest, verification: VerificationSignal[]): EducationResponse {
  const steps = modeSteps(request);

  return {
    id: `local_${Date.now()}`,
    title: inferTitle(request),
    mode: request.mode,
    prompt: request.prompt,
    answer: inferAnswer(request),
    solution: buildMarkdown(request, steps),
    steps,
    keyConcepts:
      request.mode === "visualizer"
        ? ["visual hierarchy", "scientific labels", "formula callouts", "export QA"]
        : ["standard form", "factoring", "zero product property", "verification"],
    commonMistakes: [
      "Trusting the first generated answer without checking it.",
      "Skipping units, assumptions, or sign checks.",
      "Memorizing formulas without knowing when they apply.",
    ],
    checks: [
      "Final answer appears before the full derivation.",
      "Each formula has a reason for being used.",
      "The result includes a verification or sanity check.",
      "The explanation includes learner-facing warnings.",
    ],
    practice: [
      {
        question: "Solve $x^2-7x+10=0$.",
        answer: "$x=2,5$",
      },
      {
        question: "What two checks should you run after solving a STEM problem?",
        answer: "Substitute the result and check units or limiting behavior.",
      },
    ],
    quiz: [
      {
        question: "Why do $-2$ and $-3$ factor $x^2-5x+6$?",
        answer: "They multiply to $6$ and add to $-5$.",
      },
      {
        question: "What does the zero product property say?",
        answer: "If $ab=0$, then $a=0$, $b=0$, or both.",
      },
    ],
    visualPlan: [
      "Problem card at top with knowns and unknowns.",
      "Formula lane with highlighted transformations.",
      "Verification box near the final answer.",
      "Mistake warnings in a side rail.",
    ],
    cheatsheetBlocks: cheatsheetSteps,
    followUps: [
      "Make it easier",
      "List key concepts",
      "Give similar practice",
      "Explain in English",
      "Create a quiz",
    ],
    confidence: verification.some((item) => item.status === "complete") ? 0.92 : 0.78,
    verification,
    createdAt: new Date().toISOString(),
  };
}
