export type FeatureMode =
  | "solver"
  | "visualizer"
  | "chat"
  | "cheatsheet"
  | "report"
  | "pdf-notes"
  | "notebook";

export type ExplanationStyle =
  | "step-by-step"
  | "deep-explain"
  | "humanized"
  | "exam"
  | "handwritten";

export type ModelProvider = "nvidia" | "openai-compatible" | "demo";

export type ModelChoice =
  | "auto"
  | "mistral-large"
  | "nemotron"
  | "deepseek-flash"
  | "llama"
  | "debate"
  | "demo";

export type FrameRatio = "16:9" | "4:3" | "1:1" | "a4-portrait" | "a4-landscape";

export type UploadedAsset = {
  name: string;
  type: string;
  size: number;
  preview?: string;
  dataUrl?: string;
  extractedText?: string;
};

export type Personalization = {
  /** Free-text role / job title (max ~200 chars). */
  occupation?: string;
  /** Free-text instructions injected into the system prompt (max ~10000 chars). */
  customInstructions?: string;
};

export type EducationRequest = {
  mode: FeatureMode;
  prompt: string;
  style: ExplanationStyle;
  audience: string;
  attachments: UploadedAsset[];
  crossCheck: boolean;
  modelChoice: ModelChoice;
  /**
   * Per-user customisation injected into the model's system prompt. When
   * present, the model will tailor its responses to the user's stated
   * occupation and any custom instructions they configured under Settings →
   * Personalize. Optional — null/undefined means "no personalisation".
   */
  personalization?: Personalization;
};

export type VerificationSignal = {
  model: string;
  role: "solver" | "critic" | "formatter" | "visualizer";
  status: "complete" | "fallback" | "skipped";
  notes: string;
};

export type CrossCheckStatus = "agree" | "minor" | "disagree" | "skipped";

export type CrossCheckResult = {
  status: CrossCheckStatus;
  primaryModel: string;
  secondaryModel: string;
  primaryAnswer?: string;
  secondaryAnswer?: string;
  notes?: string;
};

export type SolutionStep = {
  title: string;
  body: string;
  formula?: string;
  teachingNote?: string;
};

/**
 * A single glossary entry surfaced by the Solver / Cheatsheet / Notebook.
 * The model returns these as part of the response so the UI can light up
 * occurrences of `term` in the rendered prose with a tooltip + click-to-
 * ask-about-this-term affordance (Tier A #3 — gpai.app's orange
 * underlined terms feature).
 */
export type GlossaryEntry = {
  /** Short noun phrase as it appears in the prose, e.g. "linear ODE". */
  term: string;
  /** One-sentence definition, plain text (no markdown). */
  definition: string;
};

export type PracticeItem = {
  question: string;
  answer: string;
  /**
   * Optional multiple-choice options. When present, the UI renders the
   * question as an MCQ; the entry in `answer` is the correct option text
   * (must match one of the strings in `choices` exactly).
   */
  choices?: string[];
  /**
   * Optional one-sentence explanation of WHY the correct answer is right.
   * Surfaced automatically below an MCQ once the user picks an answer,
   * and behind the show-answer toggle for short-answer questions.
   */
  explanation?: string;
  /**
   * Optional terse nudge that points the student toward the right
   * concept WITHOUT revealing the answer. Surfaced behind a `Hint`
   * button in the Solver Quiz panel.
   */
  hint?: string;
};

export type EducationResponse = {
  id: string;
  title: string;
  mode: FeatureMode;
  prompt: string;
  answer: string;
  solution: string;
  steps: SolutionStep[];
  keyConcepts: string[];
  commonMistakes: string[];
  checks: string[];
  practice: PracticeItem[];
  quiz: PracticeItem[];
  visualPlan: string[];
  cheatsheetBlocks: SolutionStep[];
  followUps: string[];
  /**
   * Optional inline glossary for the current solution. When present the
   * Solver lights up matching term occurrences in the rendered prose
   * (orange underline, tooltip on hover, click → ask-about-this-term).
   */
  glossary?: GlossaryEntry[];
  confidence: number;
  verification: VerificationSignal[];
  crossCheck?: CrossCheckResult;
  createdAt: string;
  imageUrl?: string;
  diagramSpec?: string;
};

export type ChatRole = "user" | "assistant" | "system";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  attachments?: UploadedAsset[];
  createdAt: string;
  pending?: boolean;
};

export type ChatRequest = {
  messages: Array<Pick<ChatMessage, "role" | "content"> & { attachments?: UploadedAsset[] }>;
  modelChoice: ModelChoice;
  deepExplain: boolean;
  webEnabled?: boolean;
  /** Per-user customisation injected into the chat system prompt. */
  personalization?: Personalization;
};

export type ChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
};

export type VisualizeRequest = {
  prompt: string;
  ratio: FrameRatio;
  category: VisualizerCategory;
  style: "illustration" | "diagram";
};

export type VisualizerCategory =
  | "illustration"
  | "graph"
  | "flowchart"
  | "diagram"
  | "circuit"
  | "chemistry"
  | "logic";

export type VisualizeResponse = {
  id: string;
  prompt: string;
  category: VisualizerCategory;
  ratio: FrameRatio;
  imageDataUrl?: string;
  diagramSpec?: string;
  description: string;
  variants: string[];
  qualityChecks: string[];
  verification: VerificationSignal[];
  createdAt: string;
};
