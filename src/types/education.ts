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

export type EducationRequest = {
  mode: FeatureMode;
  prompt: string;
  style: ExplanationStyle;
  audience: string;
  attachments: UploadedAsset[];
  crossCheck: boolean;
  modelChoice: ModelChoice;
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

export type PracticeItem = {
  question: string;
  answer: string;
  /**
   * Optional multiple-choice options. When present, the UI renders the
   * question as an MCQ; the entry in `answer` is the correct option text
   * (must match one of the strings in `choices` exactly).
   */
  choices?: string[];
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
