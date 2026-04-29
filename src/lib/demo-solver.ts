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
    body: "Place the main concept in the center, supporting labels around it, and a formula strip at the bottom. Keep the diagram editable as layers: background, components, arrows, labels, and equations.",
    formula: "\\text{canvas}=\\text{concept}+\\text{components}+\\text{labels}+\\text{formula strip}",
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

const physicsSteps: SolutionStep[] = [
  {
    title: "Identify knowns",
    body: "The force is $F=20\\,\\text{N}$ and the mass is $m=5\\,\\text{kg}$. The unknown is acceleration $a$.",
    formula: "\\begin{aligned}F&=20\\,\\text{N}\\\\m&=5\\,\\text{kg}\\\\a&=?\\end{aligned}",
    teachingNote: "Always write knowns and units before choosing a formula.",
  },
  {
    title: "Use Newton's second law",
    body: "Newton's second law connects net force, mass, and acceleration.",
    formula: "\\begin{aligned}F&=ma\\\\a&=\\frac{F}{m}\\end{aligned}",
    teachingNote: "We divide by mass because acceleration is force per unit mass.",
  },
  {
    title: "Substitute and solve",
    body: "Put the numbers into the formula and simplify with units.",
    formula: "\\begin{aligned}a&=\\frac{20\\,\\text{N}}{5\\,\\text{kg}}\\\\&=4\\,\\text{m/s}^2\\end{aligned}",
    teachingNote: "Since $1\\,\\text{N}=1\\,\\text{kg}\\cdot\\text{m/s}^2$, the final unit is $\\text{m/s}^2$.",
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

const chatSteps: SolutionStep[] = [
  {
    title: "Plain-English explanation",
    body: "Start with the intuition first, then connect it to the formal definition so the learner can move from meaning to math.",
  },
  {
    title: "Textbook connection",
    body: "Introduce the governing formula only after the concept is grounded, then define every variable and assumption.",
  },
  {
    title: "Check understanding",
    body: "End with a compact self-check question and a suggested follow-up so the chat behaves like a tutor, not a search result.",
  },
];

function modeSteps(request: EducationRequest) {
  if (request.mode === "visualizer") return visualizerSteps;
  if (request.mode === "cheatsheet") return cheatsheetSteps;
  if (request.mode === "chat") return chatSteps;
  if (isPhysicsAcceleration(request.prompt)) return physicsSteps;
  return algebraSteps;
}

function isQuadratic(prompt: string) {
  const lower = prompt.toLowerCase();
  return lower.includes("x^2") && lower.includes("- 5x") && lower.includes("+ 6");
}

function isPhysicsAcceleration(prompt: string) {
  const lower = prompt.toLowerCase();
  return lower.includes("20 n") && lower.includes("5 kg");
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
    return "Editable diagram specification ready";
  }

  if (request.mode === "cheatsheet") {
    return "Printable study sheet generated";
  }

  if (request.mode === "chat") {
    return "Deep explanation with examples and follow-ups";
  }

  if (isQuadratic(prompt)) {
    return "x=2 \\text{ or } x=3";
  }

  if (isPhysicsAcceleration(prompt)) {
    return "a=4\\,\\text{m/s}^2";
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
    return `## Canvas plan\n${answer}\n\n${stepText}\n\n## Diagram specification\n- Use a clean dark-on-light canvas with high contrast labels.\n- Add editable layers for shapes, connectors, labels, equations, and legend.\n- Add a formula panel for the governing equation.\n- Generate 3 variants: classroom, exam-note, and presentation.\n\n## Export checklist\n- PNG export for notes.\n- SVG export for editing.\n- 16:9, 4:3, and square layout variants.\n- Quality check for missing labels, incorrect arrows, clutter, and unreadable text.`;
  }

  if (request.mode === "cheatsheet") {
    return `## A4 cheatsheet\n${answer}\n\n${stepText}\n\n## Recommended blocks\n- Definitions and symbols.\n- Formula map with variable definitions.\n- Worked micro-examples.\n- Common traps.\n- 5-minute review quiz.\n\n## Printable layout\nUse two columns, short blocks, bold formula names, and a final quick-review strip at the bottom.`;
  }

  if (request.mode === "chat") {
    return `## Tutor response\n${answer}\n\n${stepText}\n\n## Example\nEntropy is like counting how many microscopic arrangements can produce the same visible state. A messy room has more possible arrangements than a perfectly organized room.\n\n## Mathematical anchor\n$$\nS=k_B\\ln\\Omega\n$$\nHere, $S$ is entropy, $k_B$ is Boltzmann's constant, and $\\Omega$ is the number of microscopic states.\n\n## Follow-up\nAsk for an analogy, a derivation, a visual explanation, or a practice problem.`;
  }

  return `## Problem\n${request.prompt}

## Answer\n${answer}

## Cross-check status\n${isPhysicsAcceleration(request.prompt) ? "The result is checked with Newton's second law and unit cancellation." : "The result is checked by direct substitution and by the factor-product/sum rule."}

## Solution\n${stepText}

## Verification\n${isPhysicsAcceleration(request.prompt) ? "Substituting back gives $F=ma=5\\times4=20\\,\\text{N}$, matching the original force." : "Both candidate values make the original equation equal zero, so the answer is consistent."}

## Revised mistakes AI detected\n${isPhysicsAcceleration(request.prompt) ? "- Forgetting that the force must be the net force.\n- Dropping units during division.\n- Multiplying by mass instead of dividing by mass." : "- Picking factors with the right product but wrong sum.\n- Forgetting that $(x-r)=0$ gives $x=r$.\n- Skipping the substitution check."}\n\n## Follow-up questions\n- Make it easy\n- List key concepts\n- Give similar practice\n- Explain in English\n\n## Quiz\n${isPhysicsAcceleration(request.prompt) ? "1. Why do we divide force by mass?\n2. What unit should acceleration have?" : "1. Why must the factor pair be $-2$ and $-3$, not $2$ and $3$?\n2. What property lets us set each factor equal to zero?"}\n\n
## Similar practice\n${isPhysicsAcceleration(request.prompt) ? "A $10\\,\\text{kg}$ cart has a net force of $30\\,\\text{N}$. Find its acceleration." : "Solve $x^2-7x+10=0$, then verify both roots."}`;
}

export function buildDemoResponse(request: EducationRequest, verification: VerificationSignal[]): EducationResponse {
  const steps = modeSteps(request);
  const solverKeyConcepts = isPhysicsAcceleration(request.prompt)
    ? ["Newton's second law", "net force", "mass", "unit check"]
    : ["standard form", "factoring", "zero product property", "verification"];

  const modeKeyConcepts = {
    solver: solverKeyConcepts,
    visualizer: ["canvas hierarchy", "editable layers", "scientific labels", "export QA"],
    chat: ["intuition", "formal definition", "examples", "self-check"],
    cheatsheet: ["formula map", "micro-examples", "exam traps", "print layout"],
  } satisfies Record<EducationRequest["mode"], string[]>;

  const modeMistakes = {
    solver: [
      "Trusting the first generated answer without checking it.",
      "Skipping units, assumptions, or sign checks.",
      "Memorizing formulas without knowing when they apply.",
    ],
    visualizer: [
      "Creating a pretty diagram with missing scientific labels.",
      "Mixing too many arrows without a clear reading order.",
      "Forgetting export ratios and editability.",
    ],
    chat: [
      "Answering too broadly instead of the exact student question.",
      "Using formulas before building intuition.",
      "Skipping a follow-up check for understanding.",
    ],
    cheatsheet: [
      "Packing too much text into the page.",
      "Listing formulas without variable definitions.",
      "Omitting common exam traps.",
    ],
  } satisfies Record<EducationRequest["mode"], string[]>;

  const modeFollowUps = {
    solver: ["Make it easier", "List key concepts", "Give similar practice", "Explain in English", "Create a quiz"],
    visualizer: ["Make a cleaner version", "Add labels", "Create flowchart variant", "Export as SVG plan", "Generate quiz from diagram"],
    chat: ["Explain with analogy", "Go deeper", "Make flashcards", "Give a real-world example", "Test me"],
    cheatsheet: ["Make it shorter", "Add examples", "Add memory tricks", "Create printable A4", "Turn into quiz"],
  } satisfies Record<EducationRequest["mode"], string[]>;

  const modeVisualPlan = {
    solver: [
      "Problem card at top with knowns and unknowns.",
      "Formula lane with highlighted transformations.",
      "Verification box near the final answer.",
      "Mistake warnings in a side rail.",
    ],
    visualizer: [
      "Layered canvas with editable component groups.",
      "Formula callout strip under the main figure.",
      "Assets panel for labels, arrows, and symbols.",
      "Export panel for PNG/SVG and aspect ratios.",
    ],
    chat: [
      "Conversation memory panel for uploaded context.",
      "Deep Explain toggle for textbook mode.",
      "Suggested replies after every answer.",
      "Flashcard and quiz conversion actions.",
    ],
    cheatsheet: [
      "Two-column A4 page preview.",
      "Drag-ready blocks for formulas and examples.",
      "Exam traps strip.",
      "PDF/share/export controls.",
    ],
  } satisfies Record<EducationRequest["mode"], string[]>;

  const modeChecks = {
    solver: [
      "Final answer appears before the full derivation.",
      "Each formula has a reason for being used.",
      "The result includes a verification or sanity check.",
      "The explanation includes learner-facing warnings.",
    ],
    visualizer: [
      "Canvas has a clear reading order.",
      "All scientific components are labeled.",
      "Export formats and aspect ratios are specified.",
      "Quality pass checks arrows, labels, and clutter.",
    ],
    chat: [
      "Answer starts with intuition.",
      "Formal math appears after the concept.",
      "The response ends with follow-up study actions.",
      "Uploaded context can be incorporated before answering.",
    ],
    cheatsheet: [
      "Blocks are compact enough for print.",
      "Formulas include variable definitions.",
      "Examples and traps are included.",
      "Layout is organized for A4/PDF export.",
    ],
  } satisfies Record<EducationRequest["mode"], string[]>;

  const modePractice = {
    solver: [
      {
        question: isPhysicsAcceleration(request.prompt)
          ? "A $10\\,\\text{kg}$ cart has a net force of $30\\,\\text{N}$. Find $a$."
          : "Solve $x^2-7x+10=0$.",
        answer: isPhysicsAcceleration(request.prompt) ? "$a=3\\,\\text{m/s}^2$" : "$x=2,5$",
      },
      {
        question: "What two checks should you run after solving a STEM problem?",
        answer: "Substitute the result and check units or limiting behavior.",
      },
    ],
    visualizer: [
      {
        question: "What should every arrow in a scientific diagram include?",
        answer: "A direction, a label, and units or meaning where applicable.",
      },
      {
        question: "Why create PNG and SVG exports?",
        answer: "PNG is easy for notes; SVG stays editable for refinement.",
      },
    ],
    chat: [
      {
        question: "Explain the same concept in one sentence.",
        answer: "A good tutor answer should preserve meaning while reducing complexity.",
      },
      {
        question: "What should you ask next?",
        answer: "Ask for an example, derivation, analogy, or quick quiz.",
      },
    ],
    cheatsheet: [
      {
        question: "What belongs beside every formula?",
        answer: "Variable definitions and when to use the formula.",
      },
      {
        question: "What makes a cheatsheet exam-ready?",
        answer: "Compact formulas, examples, traps, and a review quiz.",
      },
    ],
  } satisfies Record<EducationRequest["mode"], Array<{ question: string; answer: string }>>;

  const modeQuiz = {
    solver: isPhysicsAcceleration(request.prompt)
      ? [
          { question: "Why is acceleration $F/m$?", answer: "Because $F=ma$, so solving for $a$ gives $a=F/m$." },
          { question: "What is the unit of acceleration?", answer: "$\\text{m/s}^2$." },
        ]
      : [
          { question: "Why do $-2$ and $-3$ factor $x^2-5x+6$?", answer: "They multiply to $6$ and add to $-5$." },
          { question: "What does the zero product property say?", answer: "If $ab=0$, then $a=0$, $b=0$, or both." },
        ],
    visualizer: [
      { question: "What is the first layer in the diagram?", answer: "The central concept/component layout." },
      { question: "What should be checked before export?", answer: "Labels, arrows, units, spacing, and readability." },
    ],
    chat: [
      { question: "Why start with intuition?", answer: "It gives the learner a mental model before formulas." },
      { question: "What makes chat a tutor?", answer: "Follow-up questions, examples, and checks for understanding." },
    ],
    cheatsheet: [
      { question: "Why use blocks?", answer: "Blocks make dense information scannable and printable." },
      { question: "What should the final strip contain?", answer: "A rapid review quiz or exam traps." },
    ],
  } satisfies Record<EducationRequest["mode"], Array<{ question: string; answer: string }>>;

  return {
    id: `local_${Date.now()}`,
    title: inferTitle(request),
    mode: request.mode,
    prompt: request.prompt,
    answer: inferAnswer(request),
    solution: buildMarkdown(request, steps),
    steps,
    keyConcepts: modeKeyConcepts[request.mode],
    commonMistakes: modeMistakes[request.mode],
    checks: modeChecks[request.mode],
    practice: modePractice[request.mode],
    quiz: modeQuiz[request.mode],
    visualPlan: modeVisualPlan[request.mode],
    cheatsheetBlocks: cheatsheetSteps,
    followUps: modeFollowUps[request.mode],
    confidence: verification.some((item) => item.status === "complete") ? 0.92 : 0.78,
    verification,
    createdAt: new Date().toISOString(),
  };
}
