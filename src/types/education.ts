export type FeatureMode = "solver" | "visualizer" | "chat" | "cheatsheet";

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

export type SolutionStep = {
  title: string;
  body: string;
  formula?: string;
  teachingNote?: string;
};

export type PracticeItem = {
  question: string;
  answer: string;
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
  createdAt: string;
};
