"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUp,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  RefreshCw,
  XCircle,
  Download,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Languages,
  Lightbulb,
  Link as LinkIcon,
  ListChecks,
  MessageCircle,
  Sparkles,
  Target,
  User,
} from "lucide-react";
import type {
  EducationResponse,
  ModelChoice,
  PracticeItem,
  UploadedAsset,
} from "@/types/education";
import { Composer } from "@/components/Composer";
import { MathMarkdown } from "@/components/MathMarkdown";
import { ModelAvatars, modelDisplay } from "@/components/ModelAvatars";
import { useStream } from "@/hooks/useStream";
import { usePersonalization } from "@/hooks/usePersonalization";
import { useSpacedRepetition } from "@/hooks/useSpacedRepetition";
import type { GlossaryEntry } from "@/types/education";

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
  {
    label: "Verify a step you're not sure about",
    detail: "Check whether dy/dx of x ln x is ln x + 1",
    accent: "emerald",
  },
  {
    label: "Get a quick concept refresher",
    detail: "What is Bayes' theorem and when do I actually use it?",
    accent: "sky",
  },
  {
    label: "Translate a textbook problem",
    detail: "Solve this Korean physics problem about a hanging mass",
    accent: "violet",
  },
];

const DEMO_CARDS_PER_PAGE = 3;
const DEMO_ROTATION_MS = 7_000;

/**
 * The four follow-up chips on the right rail. Each chip has:
 * - `label`: short text shown on the chip itself.
 * - `icon`: lucide-react icon identifier (rendered via the {@link iconForChip}
 *   helper to keep this list serialisable / inspectable).
 * - `userPrompt`: the verbose pre-canned **user message** that is actually
 *   sent to `/api/chat` when the chip is clicked. We deliberately avoid
 *   sending the short label as the user message because the model otherwise
 *   has no idea what "Make it easy" refers to without the surrounding
 *   solver context — gpai.app does the same.
 */
const QUICK_CHIPS: ReadonlyArray<{
  label: string;
  icon: "Lightbulb" | "ListChecks" | "Target" | "Languages";
  userPrompt: string;
}> = [
  {
    label: "Make it easy",
    icon: "Lightbulb",
    userPrompt:
      "Explain this in a way that's easy to understand. Use plain language and short bullet steps; assume I'm seeing this idea for the first time.",
  },
  {
    label: "List key concepts",
    icon: "ListChecks",
    userPrompt:
      "List the key concepts, formulas, and definitions used in the reference solution. Group them with short H3 headings and one-line explanations — I want a study glossary.",
  },
  {
    label: "Give similar practice",
    icon: "Target",
    userPrompt:
      "Give me one similar but distinct practice problem at the same difficulty level. Show only the question — no answer or solution — so I can attempt it myself.",
  },
  {
    label: "Explain in English",
    icon: "Languages",
    userPrompt:
      "Re-explain the solution in clear, conversational English. Translate any non-English text in the original problem and walk through each step with short sentences.",
  },
];

function iconForChip(name: (typeof QUICK_CHIPS)[number]["icon"]) {
  switch (name) {
    case "Lightbulb":
      return <Lightbulb size={12} />;
    case "ListChecks":
      return <ListChecks size={12} />;
    case "Target":
      return <Target size={12} />;
    case "Languages":
      return <Languages size={12} />;
  }
}

/**
 * Tiny `Copy` button at the bottom of each follow-up AI reply. Briefly
 * shows a check + `Copied` after the user clicks. Mirrors the existing
 * Solver action-row Copy button visually but in a smaller form factor
 * suitable for a chat thread.
 */
function FollowUpCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={`followup-copy-btn ${copied ? "is-copied" : ""}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        } catch {
          /* ignore — fall back to manual selection */
        }
      }}
      title="Copy reply"
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

export function SolverView(props: SolverViewProps) {
  const [crossCheck, setCrossCheck] = useState(true);
  const [streamText, setStreamText] = useState("");
  const [solveTime, setSolveTime] = useState<number | null>(null);
  const solveStartRef = useRef<number>(0);
  const stream = useStream<EducationResponse>();
  const personalization = usePersonalization();

  const handleSubmit = (overridePrompt?: string) => {
    const finalPrompt = (overridePrompt ?? props.prompt).trim();
    if (!finalPrompt) return;
    props.setResult(null);
    setStreamText("");
    setSolveTime(null);
    solveStartRef.current = performance.now();
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
        personalization: personalization.request,
      },
      {
        onChunk: (visible) => setStreamText(visible),
        onFinal: (_text, structured) => {
          const elapsed = (performance.now() - solveStartRef.current) / 1000;
          setSolveTime(Math.round(elapsed * 10) / 10);
          if (structured) {
            props.setResult(structured);
            props.onAddHistory(structured);
          }
        },
      },
    );
  };

  const showResults = stream.isStreaming || props.result || streamText || stream.error;

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
          setResult={props.setResult}
          modelChoice={props.modelChoice}
          onVisualize={props.onVisualize}
          onAddHistory={props.onAddHistory}
          onRetry={() => handleSubmit()}
          onClearError={() => {
            setStreamText("");
            stream.reset();
          }}
          solveTime={solveTime}
        />
      )}
    </div>
  );
}

/**
 * Splits the solution text into numbered steps and reveals them one at a
 * time with a "Show next step" button. If the text doesn't contain clear
 * numbered steps, it falls back to showing the full content.
 */
function StepByStepReveal({
  content,
  glossary,
  onAskGlossary,
}: {
  content: string;
  glossary?: GlossaryEntry[];
  onAskGlossary?: (entry: GlossaryEntry) => void;
}) {
  const steps = splitIntoSteps(content);
  const [visibleCount, setVisibleCount] = useState(1);
  const [lastStreamKey, setLastStreamKey] = useState(content.slice(0, 20));

  // Reset when content changes substantially (new solve)
  const streamKey = content.slice(0, 20);
  if (streamKey !== lastStreamKey) {
    setLastStreamKey(streamKey);
    setVisibleCount(1);
  }

  if (steps.length <= 1) {
    return (
      <MathMarkdown content={content} glossary={glossary} onAskGlossary={onAskGlossary} />
    );
  }

  return (
    <div className="step-reveal">
      {steps.slice(0, visibleCount).map((step, i) => (
        <div key={i} className="step-reveal-item" style={{ animationDelay: `${i * 60}ms` }}>
          <MathMarkdown content={step} glossary={glossary} onAskGlossary={onAskGlossary} />
        </div>
      ))}
      {visibleCount < steps.length && (
        <button
          type="button"
          className="step-reveal-btn"
          onClick={() => setVisibleCount((c) => c + 1)}
        >
          <Eye size={14} />
          <span>Show next step ({visibleCount}/{steps.length})</span>
        </button>
      )}
      {visibleCount >= steps.length && visibleCount > 1 && (
        <button
          type="button"
          className="step-reveal-btn step-reveal-collapse"
          onClick={() => setVisibleCount(1)}
        >
          <EyeOff size={14} />
          <span>Collapse steps</span>
        </button>
      )}
    </div>
  );
}

function splitIntoSteps(text: string): string[] {
  // Split on lines starting with numbered patterns like "1.", "**1.**", "### Step 1", etc.
  const lines = text.split("\n");
  const steps: string[] = [];
  let current = "";

  for (const line of lines) {
    const isStepStart = /^(?:\*{0,2}\d+[.)]\*{0,2}\s|#{1,3}\s*(?:Step|Part)\s+\d)/i.test(line.trimStart());
    if (isStepStart && current.trim()) {
      steps.push(current.trim());
      current = line + "\n";
    } else {
      current += line + "\n";
    }
  }
  if (current.trim()) {
    steps.push(current.trim());
  }

  return steps;
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
  // The carousel rotates every DEMO_ROTATION_MS by advancing the start
  // index by one card and wrapping with modulo. We slice DEMO_CARDS_PER_PAGE
  // items via a doubled QUICK_DEMOS array so the wrap-around is seamless
  // (no "page jumps to 0" reset visible to the user). Auto-rotation is
  // paused while the user is hovering the grid so they can read a card.
  const [start, setStart] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = QUICK_DEMOS.length;

  useEffect(() => {
    if (paused) return;
    if (total <= DEMO_CARDS_PER_PAGE) return;
    const interval = setInterval(() => {
      setStart((s) => (s + 1) % total);
    }, DEMO_ROTATION_MS);
    return () => clearInterval(interval);
  }, [paused, total]);

  const visible = Array.from({ length: DEMO_CARDS_PER_PAGE }, (_, i) =>
    QUICK_DEMOS[(start + i) % total],
  );

  return (
    <section className="quick-section">
      <div className="quick-section-head">
        <h2 className="quick-title">Try demo</h2>
        {total > DEMO_CARDS_PER_PAGE && (
          <div
            className="demo-dots"
            role="tablist"
            aria-label="Demo carousel pages"
          >
            {QUICK_DEMOS.map((d, i) => (
              <button
                key={d.detail}
                type="button"
                role="tab"
                aria-selected={i === start}
                aria-label={`Show demo ${i + 1}: ${d.label}`}
                className={`demo-dot ${i === start ? "is-active" : ""}`}
                onClick={() => setStart(i)}
              />
            ))}
          </div>
        )}
      </div>
      <div
        className="demo-grid"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        {visible.map((d) => (
          <button
            key={d.detail}
            type="button"
            className={`demo-card demo-${d.accent} demo-card-anim`}
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
  setResult,
  modelChoice,
  onVisualize,
  onAddHistory,
  onRetry,
  onClearError,
  solveTime,
}: {
  streamText: string;
  isStreaming: boolean;
  error: string | null;
  result: EducationResponse | null;
  setResult: (r: EducationResponse | null) => void;
  modelChoice: ModelChoice;
  onVisualize: (prompt: string) => void;
  onAddHistory: (r: EducationResponse) => void;
  onRetry: () => void;
  onClearError: () => void;
  solveTime: number | null;
}) {
  const [tab, setTab] = useState<"followups" | "quiz">("followups");
  const [chatInput, setChatInput] = useState("");
  const sr = useSpacedRepetition();
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [quizFormat, setQuizFormat] = useState<"mixed" | "mcq" | "short">(
    "mixed",
  );
  const personalization = usePersonalization();
  // In-context follow-up thread anchored to this solve. Each entry is a
  // Q/A pair; the answer streams in chunk-by-chunk into `a`.
  type ThreadTurn = {
    q: string;
    a: string;
    isStreaming: boolean;
    error?: string;
  };
  const [thread, setThread] = useState<ThreadTurn[]>([]);
  // Mirror state into a ref so concurrent invocations of sendFollowUp
  // (e.g. user double-clicks chips before the first request resolves)
  // see the latest thread without going through React's render cycle.
  // `nextIdxRef` hands out unique stable indices for the streaming
  // updaters; `threadRef` lets us build the prior-turns primer from
  // the freshest data even while a previous answer is still streaming.
  const threadRef = useRef<ThreadTurn[]>([]);
  const nextIdxRef = useRef(0);
  useEffect(() => {
    threadRef.current = thread;
  }, [thread]);

  const sendFollowUp = async (question: string) => {
    const q = question.trim();
    if (!q || !result) return;
    const idx = nextIdxRef.current++;
    setThread((prev) => [...prev, { q, a: "", isStreaming: true }]);

    const prior = threadRef.current
      .map((t) => `User: ${t.q}\nAssistant: ${t.a}`)
      .join("\n\n");
    const primer = [
      "You are a STEM tutor helping a student understand a problem they already saw a full solution to.",
      "Original problem:",
      result.prompt,
      "",
      "Reference solution (may include LaTeX):",
      result.solution.slice(0, 4000),
      prior ? "\n\nPrior follow-ups in this thread:\n" + prior : "",
      "",
      "Answer the student's next follow-up. Be concise (3-8 sentences unless they explicitly ask for depth). Stay grounded in the reference solution; if asked something unrelated, gently redirect.",
    ].join("\n");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: primer },
            { role: "user", content: q },
          ],
          modelChoice,
          deepExplain: false,
          webEnabled: false,
          personalization: personalization.request,
        }),
      });
      if (!res.ok || !res.body) {
        const err = await res.text().catch(() => "");
        setThread((prev) =>
          prev.map((t, i) =>
            i === idx
              ? { ...t, isStreaming: false, error: err || `HTTP ${res.status}` }
              : t,
          ),
        );
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setThread((prev) =>
          prev.map((t, i) => (i === idx ? { ...t, a: acc } : t)),
        );
      }
      setThread((prev) =>
        prev.map((t, i) => (i === idx ? { ...t, isStreaming: false } : t)),
      );
    } catch (err) {
      setThread((prev) =>
        prev.map((t, i) =>
          i === idx
            ? {
                ...t,
                isStreaming: false,
                error: err instanceof Error ? err.message : "Follow-up failed.",
              }
            : t,
        ),
      );
    }
  };

  const isFollowUpInFlight = thread.some((t) => t.isStreaming);

  const handleGenerateQuiz = async () => {
    if (!result) return;
    setQuizLoading(true);
    setQuizError(null);
    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: result.prompt,
          solutionContext: result.solution,
          count: 5,
          modelChoice,
          format: quizFormat,
        }),
      });
      const data = (await res.json()) as
        | { quiz: { question: string; answer: string; choices?: string[] }[] }
        | { error: string };
      if (!res.ok || "error" in data) {
        setQuizError(
          "error" in data ? data.error : `Quiz request failed (${res.status}).`,
        );
        return;
      }
      const merged = [...(result.quiz ?? []), ...data.quiz];
      const updated = { ...result, quiz: merged };
      setResult(updated);
      // Also write through to responseStore so the new quiz items survive
      // navigation away from the active solve and a page reload.
      onAddHistory(updated);
    } catch (err) {
      setQuizError(err instanceof Error ? err.message : "Quiz request failed.");
    } finally {
      setQuizLoading(false);
    }
  };

  const text = result?.solution || streamText || "";

  // MathMarkdown auto-injects glossary anchors when it receives a
  // `glossary` prop, so SolverView only has to *pass* the prop — no
  // pre-processing needed here. We deliberately gate the prop on
  // `result` (i.e. only after the stream has settled and the parser
  // has produced a real glossary) so half-streamed prose isn't
  // walked by the regex.
  const askGlossary = (entry: GlossaryEntry) => {
    sendFollowUp(
      `Explain the term "${entry.term}" in more detail. The reference solution defined it as: ${entry.definition}`,
    );
  };

  const showInlineError = !isStreaming && !result && error;

  return (
    <div className="solver-layout">
      <div className="solver-main">
        {showInlineError && (
          <section className="result-section solver-error" role="alert">
            <h2 className="section-heading">Could not solve</h2>
            <p>{error}</p>
            <p className="solver-error-hint">
              Try again, use a smaller image (under 4 MB), a clearer photo, or
              paste the problem as text.
            </p>
            <div className="solver-error-actions">
              <button
                type="button"
                className="primary-button"
                onClick={onRetry}
              >
                Try again
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={onClearError}
              >
                Back to composer
              </button>
            </div>
          </section>
        )}
        {result?.title && (
          <header className="result-header">
            <h1 className="result-title">{result.title}</h1>
            <div className="result-meta">
              <span>{new Date(result.createdAt).toLocaleDateString()}</span>
              <span>·</span>
              <span>{new Date(result.createdAt).toLocaleTimeString()}</span>
              {solveTime !== null && (
                <>
                  <span>·</span>
                  <span className="response-time">Solved in {solveTime}s</span>
                </>
              )}
              <div className="result-actions">
                <button className="icon-button" type="button" aria-label="Download">
                  <Download size={16} />
                </button>
                <ShareButton id={result.id} title={result.title} result={result} />
                <button
                  className="regenerate-btn"
                  type="button"
                  onClick={onRetry}
                  title="Regenerate solution"
                >
                  <RefreshCw size={13} />
                  <span>Regenerate</span>
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
              <MathMarkdown
                content={result.answer}
                glossary={result.glossary}
                onAskGlossary={askGlossary}
              />
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
              <StepByStepReveal
                content={text}
                glossary={result?.glossary}
                onAskGlossary={askGlossary}
              />
            ) : (
              <ThinkingProcess />
            )}
            {isStreaming && <span className="streaming-cursor" aria-hidden />}
          </div>
        </section>

        {result?.keyConcepts && result.keyConcepts.length > 0 && (
          <section className="result-section">
            <h2 className="section-heading">Key concepts</h2>
            <ul className="bullet-list">
              {result.keyConcepts.map((c, i) => (
                <li key={i}>
                  <MathMarkdown
                    content={c}
                    glossary={result.glossary}
                    onAskGlossary={askGlossary}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {result?.commonMistakes && result.commonMistakes.length > 0 && (
          <section className="result-section">
            <h2 className="section-heading">Common mistakes</h2>
            <ul className="bullet-list">
              {result.commonMistakes.map((m, i) => (
                <li key={i}>
                  <MathMarkdown
                    content={m}
                    glossary={result.glossary}
                    onAskGlossary={askGlossary}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {result?.checks && result.checks.length > 0 && (
          <section className="result-section">
            <h2 className="section-heading">Verification checks</h2>
            <ul className="bullet-list check-list">
              {result.checks.map((c, i) => (
                <li key={i}>
                  <MathMarkdown content={c} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {result?.quiz && result.quiz.length > 0 && (
          <QuizSection items={result.quiz} onSaveForReview={sr.addCard} />
        )}

        {sr.dueCards.length > 0 && (
          <section className="result-section">
            <h2 className="section-heading">Review queue ({sr.dueCards.length} due)</h2>
            <ul className="review-queue">
              {sr.dueCards.slice(0, 5).map((c) => (
                <li key={c.id} className="review-card">
                  <div className="review-question"><MathMarkdown content={c.question} /></div>
                  <div className="review-actions">
                    <button type="button" className="quiz-retry" onClick={() => sr.reviewCard(c.id, 1)}>Forgot</button>
                    <button type="button" className="quiz-retry" onClick={() => sr.reviewCard(c.id, 3)}>Hard</button>
                    <button type="button" className="quiz-retry" onClick={() => sr.reviewCard(c.id, 5)}>Easy</button>
                  </div>
                </li>
              ))}
            </ul>
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
              <MessageCircle size={24} />
              <p>Ask follow-ups about this problem</p>
            </div>
            <div className="chip-grid">
              {QUICK_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  className="chip chip-with-icon"
                  onClick={() => sendFollowUp(chip.userPrompt)}
                  disabled={!result || isFollowUpInFlight}
                  title={chip.userPrompt}
                >
                  {iconForChip(chip.icon)}
                  <span>{chip.label}</span>
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
                    onClick={() => sendFollowUp(f)}
                    disabled={isFollowUpInFlight}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
            {thread.length > 0 && (
              <ol className="followup-thread">
                {thread.map((t, i) => (
                  <li key={i} className="followup-turn">
                    <div className="followup-q">
                      <User size={12} className="followup-q-icon" />
                      <span>{t.q}</span>
                    </div>
                    <div className="followup-a">
                      {t.a ? (
                        <MathMarkdown content={t.a} />
                      ) : t.isStreaming ? (
                        <span className="followup-pending">Thinking…</span>
                      ) : null}
                      {t.error && (
                        <p className="error-text">{t.error}</p>
                      )}
                      {t.a && !t.isStreaming && (
                        <FollowUpCopyButton text={t.a} />
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <div className="rail-input-wrap">
              <input
                type="text"
                className="rail-input"
                placeholder={
                  isFollowUpInFlight
                    ? "Waiting for response…"
                    : "Ask about this problem"
                }
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={isFollowUpInFlight}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    chatInput.trim() &&
                    !isFollowUpInFlight
                  ) {
                    sendFollowUp(chatInput);
                    setChatInput("");
                  }
                }}
              />
              <button
                type="button"
                className="icon-button"
                disabled={isFollowUpInFlight}
                onClick={() => {
                  if (!chatInput.trim() || isFollowUpInFlight) return;
                  sendFollowUp(chatInput);
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
            <label className="rail-field">
              <span className="rail-field-label">Format</span>
              <select
                className="select-control"
                value={quizFormat}
                onChange={(e) =>
                  setQuizFormat(
                    e.target.value as "mixed" | "mcq" | "short",
                  )
                }
                disabled={quizLoading}
              >
                <option value="mixed">Mixed (MCQ + short answer)</option>
                <option value="mcq">Multiple choice only</option>
                <option value="short">Short answer only</option>
              </select>
            </label>
            <button
              type="button"
              className="primary-button"
              disabled={!result || quizLoading}
              onClick={handleGenerateQuiz}
            >
              {quizLoading
                ? "Generating quiz…"
                : result?.quiz && result.quiz.length > 0
                  ? "+ Add 5 more questions"
                  : "+ Generate quiz"}
            </button>
            {quizError && <p className="error-text">{quizError}</p>}
            {result?.quiz && result.quiz.length > 0 && (
              <p className="rail-helper">
                {result.quiz.length} question{result.quiz.length === 1 ? "" : "s"}{" "}
                ready below — scroll to the &ldquo;Quick quiz&rdquo; section.
              </p>
            )}
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

function ShareButton({ id, title, result }: { id: string; title?: string; result?: EducationResponse }) {
  const [status, setStatus] = useState<"idle" | "sharing" | "copied">("idle");
  const handleClick = async () => {
    if (typeof window === "undefined") return;
    setStatus("sharing");
    try {
      // Try server-side share (for logged-in users)
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "solve",
          title: title ?? "Forge solve",
          payload: result ?? { id },
        }),
      });
      let shareUrl: string;
      if (res.ok) {
        const data = (await res.json()) as { url: string };
        shareUrl = `${window.location.origin}${data.url}`;
      } else {
        // Fallback to taskId link for unauthenticated users
        shareUrl = `${window.location.origin}/app?taskId=${encodeURIComponent(id)}`;
      }
      if (navigator.share) {
        await navigator
          .share({ title: title ?? "Forge solve", url: shareUrl })
          .catch(() => { /* user cancelled */ });
      }
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      }
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 1600);
    } catch {
      // Fallback — copy taskId link
      const fallback = `${window.location.origin}/app?taskId=${encodeURIComponent(id)}`;
      try { await navigator.clipboard.writeText(fallback); } catch { /* ignore */ }
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 1600);
    }
  };
  return (
    <button
      className="icon-button"
      type="button"
      aria-label={status === "copied" ? "Link copied" : "Copy share link"}
      title={status === "copied" ? "Link copied" : "Copy share link"}
      onClick={handleClick}
      disabled={status === "sharing"}
    >
      {status === "copied" ? <Check size={16} /> : <LinkIcon size={16} />}
    </button>
  );
}

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
  const primary = modelDisplay(cc.primaryModel);
  const secondary = modelDisplay(cc.secondaryModel);

  if (cc.status === "agree") {
    const tooltip = `Cross-checked by ${primary.short} + ${secondary.short}: both models reached the same conclusion.`;
    return (
      <span
        className="cross-checked-badge cross-checked-pass"
        title={tooltip}
      >
        <ModelAvatars
          primary={cc.primaryModel}
          secondary={cc.secondaryModel}
        />
        <CheckCircle2 size={13} className="cross-checked-icon" />
        Cross-checked
      </span>
    );
  }
  if (cc.status === "minor") {
    const tooltip = [
      `Models gave equivalent answers up to rounding/units.`,
      `${primary.short} (${cc.primaryModel}): ${cc.primaryAnswer ?? "(see solution)"}`,
      `${secondary.short} (${cc.secondaryModel}): ${cc.secondaryAnswer ?? "(see notes)"}`,
    ].join("\n");
    return (
      <span
        className="cross-checked-badge cross-checked-minor"
        title={tooltip}
      >
        <ModelAvatars
          primary={cc.primaryModel}
          secondary={cc.secondaryModel}
        />
        <AlertTriangle size={13} className="cross-checked-icon" />
        Minor mismatch
      </span>
    );
  }
  if (cc.status === "disagree") {
    const tooltip = [
      `Models disagreed on the final answer.`,
      `${primary.short} (${cc.primaryModel}): ${cc.primaryAnswer ?? "(see solution)"}`,
      `${secondary.short} (${cc.secondaryModel}): ${cc.secondaryAnswer ?? "(see notes)"}`,
    ].join("\n");
    return (
      <span
        className="cross-checked-badge cross-checked-fail"
        title={tooltip}
      >
        <ModelAvatars
          primary={cc.primaryModel}
          secondary={cc.secondaryModel}
        />
        <XCircle size={13} className="cross-checked-icon" />
        Models disagree
      </span>
    );
  }
  // skipped
  return (
    <span
      className="cross-checked-badge cross-checked-skipped"
      title={cc.notes ?? "Cross-check skipped (no secondary model configured)."}
    >
      <Clock size={13} className="cross-checked-icon" />
      Cross-check skipped
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

/**
 * Paginated wrapper around `QuizItem`. Mirrors gpai.app's right-rail
 * "1 / 3" pager: renders one question at a time with `‹` / `›` controls
 * and a numeric counter. Resets the visible index back to 0 when the
 * underlying item set shrinks (e.g. user regenerates a smaller batch).
 */
function QuizSection({ items, onSaveForReview }: { items: PracticeItem[]; onSaveForReview?: (q: string, a: string) => void }) {
  const [index, setIndex] = useState(0);
  // Clamp index when items change beneath us (e.g. shorter regen).
  const safeIndex = Math.min(index, items.length - 1);
  const current = items[safeIndex];
  const last = items.length - 1;

  return (
    <section className="result-section">
      <header className="quiz-section-head">
        <h2 className="section-heading">Quick quiz</h2>
        {onSaveForReview && (
          <button
            type="button"
            className="quiz-retry"
            onClick={() => items.forEach((it) => onSaveForReview(it.question, it.answer))}
          >
            Save all for review
          </button>
        )}
        <div className="quiz-pager" role="group" aria-label="Quiz pagination">
          <button
            type="button"
            className="quiz-pager-btn"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={safeIndex === 0}
            aria-label="Previous question"
          >
            ‹
          </button>
          <span className="quiz-pager-count" aria-live="polite">
            {safeIndex + 1} / {items.length}
          </span>
          <button
            type="button"
            className="quiz-pager-btn"
            onClick={() => setIndex((i) => Math.min(last, i + 1))}
            disabled={safeIndex >= last}
            aria-label="Next question"
          >
            ›
          </button>
        </div>
      </header>
      <ol className="quiz-list" start={safeIndex + 1}>
        <QuizItem
          // Re-mounting on index change discards the per-item local
          // state (selected option, hint open) so paging back to a
          // previously-answered question gives a clean attempt — matches
          // upstream's behaviour and avoids stale-state confusion.
          key={safeIndex}
          question={current.question}
          answer={current.answer}
          choices={current.choices}
          explanation={current.explanation}
          hint={current.hint}
        />
      </ol>
    </section>
  );
}

function QuizItem({
  question,
  answer,
  choices,
  explanation,
  hint,
}: {
  question: string;
  answer: string;
  choices?: string[];
  explanation?: string;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const isMcq = Array.isArray(choices) && choices.length >= 3;

  if (isMcq) {
    const submitted = selected !== null;
    return (
      <li className="quiz-item quiz-item-mcq">
        <div className="quiz-question">
          <MathMarkdown content={question} />
        </div>
        <ul className="quiz-choices">
          {choices!.map((c, i) => {
            const letter = String.fromCharCode(65 + i);
            const isCorrect = c === answer;
            const isPicked = c === selected;
            const reveal = submitted;
            const stateClass = !reveal
              ? ""
              : isCorrect
                ? "is-correct"
                : isPicked
                  ? "is-wrong"
                  : "";
            return (
              <li key={i} className={`quiz-choice ${stateClass}`}>
                <button
                  type="button"
                  className="quiz-choice-button"
                  disabled={submitted}
                  onClick={() => setSelected(c)}
                  aria-pressed={isPicked}
                >
                  <span className="quiz-choice-letter">{letter}</span>
                  <span className="quiz-choice-text">
                    <MathMarkdown content={c} />
                  </span>
                  {submitted && isCorrect && (
                    <CheckCircle2
                      size={14}
                      className="quiz-choice-mark quiz-choice-mark-correct"
                      aria-hidden
                    />
                  )}
                  {submitted && isPicked && !isCorrect && (
                    <XCircle
                      size={14}
                      className="quiz-choice-mark quiz-choice-mark-wrong"
                      aria-hidden
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        <QuizHintRow
          hint={hint}
          hintOpen={hintOpen}
          onToggleHint={() => setHintOpen((p) => !p)}
          submitted={submitted}
        />
        {submitted && (
          <div className="quiz-feedback">
            {selected === answer ? (
              <span className="quiz-feedback-correct">
                <CheckCircle2 size={14} aria-hidden /> Correct.
              </span>
            ) : (
              <span className="quiz-feedback-wrong">
                <XCircle size={14} aria-hidden /> Not quite. Correct answer:{" "}
                <strong>{answer}</strong>
              </span>
            )}
            <button
              type="button"
              className="quiz-retry"
              onClick={() => setSelected(null)}
            >
              Try again
            </button>
          </div>
        )}
        {submitted && explanation && (
          <div className="quiz-explanation" role="note">
            <span className="quiz-explanation-label">Explanation</span>
            <MathMarkdown content={explanation} />
          </div>
        )}
      </li>
    );
  }

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
      <QuizHintRow
        hint={hint}
        hintOpen={hintOpen}
        onToggleHint={() => setHintOpen((p) => !p)}
        submitted={open}
      />
      {open && (
        <div className="quiz-answer">
          <MathMarkdown content={answer} />
          {explanation && (
            <div className="quiz-explanation" role="note">
              <span className="quiz-explanation-label">Why</span>
              <MathMarkdown content={explanation} />
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Optional "Hint" pill rendered inside each `QuizItem`. We hide the row
 * entirely when the question has no hint AND when the user has already
 * submitted (so the hint doesn't compete with the green/red feedback
 * row for attention).
 */
function QuizHintRow({
  hint,
  hintOpen,
  onToggleHint,
  submitted,
}: {
  hint?: string;
  hintOpen: boolean;
  onToggleHint: () => void;
  submitted: boolean;
}) {
  if (!hint) return null;
  if (submitted) return null;
  return (
    <div className="quiz-hint-row">
      <button
        type="button"
        className={`quiz-hint-btn ${hintOpen ? "is-open" : ""}`}
        onClick={onToggleHint}
        aria-expanded={hintOpen}
      >
        <Lightbulb size={12} aria-hidden /> {hintOpen ? "Hide hint" : "Hint"}
      </button>
      {hintOpen && <p className="quiz-hint-text">{hint}</p>}
    </div>
  );
}
