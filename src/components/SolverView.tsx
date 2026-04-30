"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowUp,
  CheckCircle2,
  Clock,
  Copy,
  XCircle,
  Download,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Link as LinkIcon,
  Sparkles,
} from "lucide-react";
import type {
  EducationResponse,
  ModelChoice,
  UploadedAsset,
} from "@/types/education";
import { Composer } from "@/components/Composer";
import { MathMarkdown } from "@/components/MathMarkdown";
import { useStream } from "@/hooks/useStream";

type SolverViewProps = {
  modelChoice: ModelChoice;
  setModelChoice: (m: ModelChoice) => void;
  attachments: UploadedAsset[];
  setAttachments: (a: UploadedAsset[]) => void;
  result: EducationResponse | null;
  setResult: (r: EducationResponse | null) => void;
  prompt: string;
  setPrompt: (p: string) => void;
  onAddHistory: (r: EducationResponse) => void;
  onVisualize: (prompt: string) => void;
};

const QUICK_DEMOS = [
  {
    label: "Use it as teaching material",
    detail: "Make a class 11 physics worksheet on projectile motion",
    accent: "amber",
  },
  {
    label: "Explain difficult concepts in a simple way",
    detail: "Explain benzene resonance structures with a diagram",
    accent: "indigo",
  },
  {
    label: "Analyze multiple problems at once",
    detail: "Up to 60 problems from an uploaded sheet",
    accent: "rose",
  },
];

const QUICK_CHIPS = [
  "Make it easy",
  "List key concepts",
  "Give similar practice",
  "Explain in English",
];

export function SolverView(props: SolverViewProps) {
  const [crossCheck, setCrossCheck] = useState(true);
  const [streamText, setStreamText] = useState("");
  const stream = useStream<EducationResponse>();

  const handleSubmit = (overridePrompt?: string) => {
    const finalPrompt = (overridePrompt ?? props.prompt).trim();
    if (!finalPrompt) return;
    props.setResult(null);
    setStreamText("");
    stream.start(
      "/api/educate/stream",
      {
        mode: "solver",
        prompt: finalPrompt,
        style: "step-by-step",
        audience: "high-school to early college",
        attachments: props.attachments,
        crossCheck,
        modelChoice: props.modelChoice,
      },
      {
        onChunk: (visible) => setStreamText(visible),
        onFinal: (_text, structured) => {
          if (structured) {
            props.setResult(structured);
            props.onAddHistory(structured);
          }
        },
      },
    );
  };

  const handleQuickAction = (chipLabel: string) => {
    if (!props.result) return;
    const re = `${chipLabel}: ${props.result.prompt}`;
    handleSubmit(re);
  };

  const showResults = stream.isStreaming || props.result || streamText;

  return (
    <div className="solver-view">
      {!showResults && <SolverHero />}

      {!showResults && (
        <Composer
          value={props.prompt}
          onChange={props.setPrompt}
          onSubmit={() => handleSubmit()}
          onStop={stream.stop}
          isStreaming={stream.isStreaming}
          attachments={props.attachments}
          onAttachmentsChange={props.setAttachments}
          modelChoice={props.modelChoice}
          onModelChange={props.setModelChoice}
          showCrossCheck
          crossCheck={crossCheck}
          onCrossCheckChange={setCrossCheck}
          placeholder="Get a detailed solution"
        />
      )}

      {!showResults && <DemoCards onPick={(p) => handleSubmit(p)} />}

      {showResults && (
        <SolverResult
          streamText={streamText}
          isStreaming={stream.isStreaming}
          error={stream.error}
          result={props.result}
          onChip={handleQuickAction}
          onVisualize={props.onVisualize}
        />
      )}
    </div>
  );
}

function SolverHero() {
  return (
    <header className="solver-hero">
      <h1 className="hero-title">
        <span>AI Solver for</span>
        <em className="hero-rotating">
          <RotatingPhrase phrases={["Physics", "Math", "Chemistry", "Biology"]} />
        </em>
      </h1>
    </header>
  );
}

function RotatingPhrase({ phrases }: { phrases: string[] }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setIdx((i) => (i + 1) % phrases.length), 2200);
    return () => clearInterval(interval);
  }, [phrases.length]);
  return <>{phrases[idx]}</>;
}

function DemoCards({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <section className="quick-section">
      <h2 className="quick-title">Try demo</h2>
      <div className="demo-grid">
        {QUICK_DEMOS.map((d) => (
          <button
            key={d.detail}
            type="button"
            className={`demo-card demo-${d.accent}`}
            onClick={() => onPick(d.detail)}
          >
            <span className="demo-label">{d.label}</span>
            <span className="demo-detail">{d.detail}</span>
            <span className="demo-cta">Try demo</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function SolverResult({
  streamText,
  isStreaming,
  error,
  result,
  onChip,
  onVisualize,
}: {
  streamText: string;
  isStreaming: boolean;
  error: string | null;
  result: EducationResponse | null;
  onChip: (chip: string) => void;
  onVisualize: (prompt: string) => void;
}) {
  const [tab, setTab] = useState<"followups" | "quiz">("followups");
  const [chatInput, setChatInput] = useState("");

  const text = result?.solution || streamText || "";

  return (
    <div className="solver-layout">
      <div className="solver-main">
        {result?.title && (
          <header className="result-header">
            <h1 className="result-title">{result.title}</h1>
            <div className="result-meta">
              <span>{new Date(result.createdAt).toLocaleDateString()}</span>
              <span>·</span>
              <span>{new Date(result.createdAt).toLocaleTimeString()}</span>
              <div className="result-actions">
                <button className="icon-button" type="button" aria-label="Download">
                  <Download size={16} />
                </button>
                <button className="icon-button" type="button" aria-label="Share">
                  <LinkIcon size={16} />
                </button>
              </div>
            </div>
          </header>
        )}

        {result && (
          <section className="result-section">
            <h2 className="section-heading">Problem</h2>
            <div className="problem-card">
              <MathMarkdown content={result.prompt} />
            </div>
          </section>
        )}

        {result?.answer && (
          <section className="result-section">
            <div className="section-row">
              <h2 className="section-heading">Answer</h2>
              <CrossCheckBadge result={result} />
            </div>
            <div className="answer-card">
              <MathMarkdown content={result.answer} />
            </div>
          </section>
        )}

        <section className="result-section">
          <div className="section-row">
            <h2 className="section-heading">Solution</h2>
            <button
              className="link-button"
              type="button"
              aria-label="Copy"
              onClick={() => {
                if (typeof navigator !== "undefined" && navigator.clipboard) {
                  navigator.clipboard.writeText(text).catch(() => {});
                }
              }}
            >
              <Copy size={14} /> Copy
            </button>
          </div>
          <div className="solution-card">
            {error ? (
              <p className="error-text">{error}</p>
            ) : text ? (
              <MathMarkdown content={text} />
            ) : (
              <ThinkingProcess />
            )}
            {isStreaming && <span className="streaming-cursor" aria-hidden />}
          </div>
        </section>

        {result?.commonMistakes && result.commonMistakes.length > 0 && (
          <section className="result-section">
            <h2 className="section-heading">Common mistakes</h2>
            <ul className="bullet-list">
              {result.commonMistakes.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </section>
        )}

        {result?.quiz && result.quiz.length > 0 && (
          <section className="result-section">
            <h2 className="section-heading">Quick quiz</h2>
            <ol className="quiz-list">
              {result.quiz.map((q, i) => (
                <QuizItem key={i} question={q.question} answer={q.answer} />
              ))}
            </ol>
          </section>
        )}
      </div>

      <aside className="solver-rail">
        <div className="rail-tabs">
          <button
            type="button"
            className={`rail-tab ${tab === "followups" ? "is-active" : ""}`}
            onClick={() => setTab("followups")}
          >
            Follow-up questions
          </button>
          <button
            type="button"
            className={`rail-tab ${tab === "quiz" ? "is-active" : ""}`}
            onClick={() => setTab("quiz")}
          >
            Quiz
          </button>
        </div>

        {tab === "followups" && (
          <div className="rail-body">
            <div className="ask-empty">
              <Sparkles size={24} />
              <p>Ask about this problem</p>
            </div>
            <div className="chip-grid">
              {QUICK_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  className="chip"
                  onClick={() => onChip(chip)}
                  disabled={!result}
                >
                  {chip}
                </button>
              ))}
              {result && (
                <button
                  type="button"
                  className="chip chip-accent"
                  onClick={() => onVisualize(result.prompt)}
                >
                  <ImageIcon size={12} /> Visualize this
                </button>
              )}
            </div>
            {result?.followUps && result.followUps.length > 0 && (
              <div className="chip-grid">
                {result.followUps.slice(0, 6).map((f) => (
                  <button
                    key={f}
                    type="button"
                    className="chip"
                    onClick={() => onChip(f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
            <div className="rail-input-wrap">
              <input
                type="text"
                className="rail-input"
                placeholder="Ask about this problem"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && chatInput.trim()) {
                    onChip(chatInput);
                    setChatInput("");
                  }
                }}
              />
              <button
                type="button"
                className="icon-button"
                onClick={() => {
                  if (!chatInput.trim()) return;
                  onChip(chatInput);
                  setChatInput("");
                }}
                aria-label="Send"
              >
                <ArrowUp size={14} />
              </button>
            </div>
          </div>
        )}

        {tab === "quiz" && (
          <div className="rail-body">
            <div className="ask-empty">
              <Sparkles size={24} />
              <p>Review with a quick quiz / flashcard</p>
            </div>
            <button
              type="button"
              className="primary-button"
              disabled={!result}
              onClick={() => onChip("Generate a 5-question quiz with answers from this problem.")}
            >
              + Create new
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

const THINKING_STEPS = [
  "Reading the problem…",
  "Identifying core concepts…",
  "Setting up the equations…",
  "Working through the steps…",
  "Cross-checking the answer…",
];

function CrossCheckBadge({ result }: { result: EducationResponse }) {
  const cc = result.crossCheck;
  if (!cc) {
    return (
      <span
        className="cross-checked-badge cross-checked-pending"
        title="Cross-check is running…"
      >
        <Clock size={14} /> Verifying
      </span>
    );
  }
  if (cc.status === "agree") {
    const tooltip = `Cross-checked by ${cc.secondaryModel}: both models reached the same conclusion.`;
    return (
      <span
        className="cross-checked-badge cross-checked-pass"
        title={tooltip}
      >
        <CheckCircle2 size={14} /> Cross-checked
      </span>
    );
  }
  if (cc.status === "minor") {
    const tooltip = [
      `Models gave equivalent answers up to rounding/units.`,
      `Primary (${cc.primaryModel}): ${cc.primaryAnswer ?? "(see solution)"}`,
      `Secondary (${cc.secondaryModel}): ${cc.secondaryAnswer ?? "(see notes)"}`,
    ].join("\n");
    return (
      <span
        className="cross-checked-badge cross-checked-minor"
        title={tooltip}
      >
        <AlertTriangle size={14} /> Minor mismatch
      </span>
    );
  }
  if (cc.status === "disagree") {
    const tooltip = [
      `Models disagreed on the final answer.`,
      `Primary (${cc.primaryModel}): ${cc.primaryAnswer ?? "(see solution)"}`,
      `Secondary (${cc.secondaryModel}): ${cc.secondaryAnswer ?? "(see notes)"}`,
    ].join("\n");
    return (
      <span
        className="cross-checked-badge cross-checked-fail"
        title={tooltip}
      >
        <XCircle size={14} /> Models disagree
      </span>
    );
  }
  // skipped
  return (
    <span
      className="cross-checked-badge cross-checked-skipped"
      title={cc.notes ?? "Cross-check skipped."}
    >
      <Clock size={14} /> Cross-check skipped
    </span>
  );
}

function ThinkingProcess() {
  const [stepIdx, setStepIdx] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setStepIdx((i) => Math.min(i + 1, THINKING_STEPS.length - 1));
    }, 1100);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="thinking-process">
      <div className="thinking-row">
        <Sparkles size={14} className="thinking-spark" />
        <span>AI Thinking Process</span>
      </div>
      <ol className="thinking-steps">
        {THINKING_STEPS.map((step, i) => {
          const state =
            i < stepIdx ? "done" : i === stepIdx ? "active" : "pending";
          return (
            <li key={step} className={`thinking-step is-${state}`}>
              <span className="thinking-bullet" aria-hidden />
              <span>{step}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function QuizItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="quiz-item">
      <div className="quiz-question">
        <button
          type="button"
          className="icon-button"
          onClick={() => setOpen((p) => !p)}
          aria-label={open ? "Hide answer" : "Show answer"}
        >
          {open ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
        <MathMarkdown content={question} />
      </div>
      {open && (
        <div className="quiz-answer">
          <MathMarkdown content={answer} />
        </div>
      )}
    </li>
  );
}
