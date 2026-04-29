"use client";

import {
  BookOpen,
  Bot,
  CheckCircle2,
  Clipboard,
  Download,
  Edit3,
  FileText,
  FlaskConical,
  Image as ImageIcon,
  Lightbulb,
  MessageSquare,
  Play,
  RefreshCcw,
  Share2,
  Sparkles,
  Upload,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type {
  EducationRequest,
  EducationResponse,
  ExplanationStyle,
  FeatureMode,
  ModelChoice,
  UploadedAsset,
} from "@/types/education";
import { MathMarkdown } from "@/components/MathMarkdown";

const modes: Array<{
  id: FeatureMode;
  label: string;
  title: string;
  subtitle: string;
  placeholder: string;
  icon: typeof FlaskConical;
}> = [
  {
    id: "solver",
    label: "AI Solver",
    title: "Solve STEM problems with textbook clarity",
    subtitle: "Answer, derivation, verification, mistakes, practice, and quiz in one flow.",
    placeholder: "Get a detailed solution",
    icon: FlaskConical,
  },
  {
    id: "visualizer",
    label: "AI Visualizer",
    title: "Visualize STEM concepts instantly",
    subtitle: "Generate editable diagram specs, labeled canvas plans, and export-ready variants.",
    placeholder: "Enter what you want to visualize",
    icon: ImageIcon,
  },
  {
    id: "chat",
    label: "AI Chat",
    title: "Search, ask, and get deeper explanations",
    subtitle: "Deep explain mode for PDFs, images, links, YouTube notes, and research questions.",
    placeholder: "Type a message...",
    icon: MessageSquare,
  },
  {
    id: "cheatsheet",
    label: "AI Cheatsheet",
    title: "Create exam-ready cheatsheets",
    subtitle: "Turn prompts and uploaded material into printable block-based study sheets.",
    placeholder: "Enter a topic or upload files",
    icon: FileText,
  },
];

const demos = {
  solver: [
    "Make a class 11 physics worksheet on projectile motion",
    "Explain benzene resonance structures with a diagram",
    "Solve x^2 - 5x + 6 = 0 and include common mistakes",
  ],
  visualizer: [
    "Draw a labeled RC low-pass filter circuit with cutoff formula",
    "Create a DNA replication diagram with enzymes and arrows",
    "Visualize planetary orbits with relative labels",
  ],
  chat: [
    "Explain entropy intuitively, then mathematically",
    "Turn this YouTube lecture link into notes and flashcards",
    "Compare Newton's laws with examples and misconceptions",
  ],
  cheatsheet: [
    "Generate a 2 page mechanics cheatsheet for Hibbeler",
    "Generate a 2 page algorithm cheatsheet for CLRS",
    "Create a calculus limits and derivatives exam sheet",
  ],
} satisfies Record<FeatureMode, string[]>;

const styleOptions: Array<{ id: ExplanationStyle; label: string }> = [
  { id: "step-by-step", label: "Step-by-step" },
  { id: "deep-explain", label: "Deep explain" },
  { id: "humanized", label: "Humanized" },
  { id: "exam", label: "Exam mode" },
  { id: "handwritten", label: "Handwritten style" },
];

const modelOptions: Array<{ id: ModelChoice; label: string }> = [
  { id: "auto", label: "Auto best" },
  { id: "mistral-large", label: "Mistral Large 3" },
  { id: "nemotron", label: "Nemotron" },
  { id: "deepseek-flash", label: "DeepSeek Flash / V4" },
  { id: "llama", label: "Llama 3.3" },
  { id: "demo", label: "Demo fallback" },
];

const visualCategories = [
  "Illustration AI",
  "Graph AI",
  "Flowchart AI",
  "Diagram AI",
  "Circuit AI",
  "Chemistry AI",
  "Logic AI",
];

const initialPrompt = "Solve x^2 - 5x + 6 = 0. Explain like a patient textbook teacher, show checks, and include common mistakes.";

const submitLabels: Record<FeatureMode, { idle: string; loading: string; status: string }> = {
  solver: { idle: "Solve", loading: "Solving", status: "Solving → checking → formatting" },
  visualizer: { idle: "Visualize", loading: "Building", status: "Designing canvas → labeling → export QA" },
  chat: { idle: "Send", loading: "Thinking", status: "Reading context → explaining → suggesting follow-ups" },
  cheatsheet: { idle: "Generate", loading: "Writing", status: "Planning blocks → compressing notes → print QA" },
};

const resultLabels: Record<FeatureMode, { answer: string; checked: string; solution: string; side: string; plan: string }> = {
  solver: {
    answer: "Answer",
    checked: "Cross-checked",
    solution: "Solution",
    side: "Verifier passes",
    plan: "Visual / cheatsheet plan",
  },
  visualizer: {
    answer: "Visual direction",
    checked: "Quality checked",
    solution: "Canvas specification",
    side: "Quality checks",
    plan: "Export / edit plan",
  },
  chat: {
    answer: "Response",
    checked: "Tutor checked",
    solution: "Deep explanation",
    side: "Tutor checks",
    plan: "Study actions",
  },
  cheatsheet: {
    answer: "Output",
    checked: "Print checked",
    solution: "Cheatsheet",
    side: "Study checks",
    plan: "Printable layout",
  },
};

export function EducationApp() {
  const [mode, setMode] = useState<FeatureMode>("solver");
  const [prompt, setPrompt] = useState(initialPrompt);
  const [style, setStyle] = useState<ExplanationStyle>("step-by-step");
  const [modelChoice, setModelChoice] = useState<ModelChoice>("auto");
  const [audience, setAudience] = useState("high-school to early college");
  const [crossCheck, setCrossCheck] = useState(true);
  const [attachments, setAttachments] = useState<UploadedAsset[]>([]);
  const [result, setResult] = useState<EducationResponse | null>(null);
  const [history, setHistory] = useState<EducationResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const activeMode = useMemo(() => modes.find((item) => item.id === mode) ?? modes[0], [mode]);
  const ActiveIcon = activeMode.icon;
  const currentSubmitLabel = submitLabels[mode];

  async function submit(nextPrompt = prompt, nextMode = mode) {
    if (!nextPrompt.trim()) return;
    setIsLoading(true);
    setMessage(submitLabels[nextMode].status);

    const request: EducationRequest = {
      mode: nextMode,
      prompt: nextPrompt,
      style,
      audience,
      attachments,
      crossCheck,
      modelChoice,
    };

    try {
      const response = await fetch("/api/educate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const data = (await response.json()) as EducationResponse | { error: string };
      if ("error" in data) throw new Error(data.error);
      setResult(data);
      setHistory((items) => [data, ...items].slice(0, 10));
      setMessage(`${resultLabels[nextMode].checked} and formatted`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Generation failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files) return;
    const nextFiles = await Promise.all(
      Array.from(files)
        .slice(0, 4)
        .map(
          (file) =>
            new Promise<UploadedAsset>((resolve) => {
              if (!file.type.startsWith("image/")) {
                resolve({
                  name: file.name,
                  type: file.type,
                  size: file.size,
                });
                return;
              }

              const reader = new FileReader();
              reader.onload = () =>
                resolve({
                  name: file.name,
                  type: file.type,
                  size: file.size,
                  preview: URL.createObjectURL(file),
                  dataUrl: String(reader.result),
                });
              reader.readAsDataURL(file);
            }),
        ),
    );
    setAttachments(nextFiles);
  }

  function pickMode(nextMode: FeatureMode) {
    setMode(nextMode);
    setPrompt("");
    setResult(null);
    setAttachments([]);
    setMessage("");
  }

  async function share() {
    if (!result) return;
    const response = await fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: result.id }),
    });
    const data = (await response.json()) as { url: string };
    await navigator.clipboard.writeText(`${location.origin}${data.url}`);
    setMessage("Share link copied");
  }

  function download() {
    if (!result) return;
    const blob = new Blob([`# ${result.title}\n\n${result.solution}`], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${result.title.toLowerCase().replaceAll(" ", "-")}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">ed</div>
          <div>
            <strong>eduForge</strong>
            <span>STEM copilot</span>
          </div>
        </div>
        <button
          className="new-task"
          onClick={() => {
            setPrompt("");
            setResult(null);
            setAttachments([]);
            setMessage("");
          }}
        >
          <Sparkles size={16} />
          New task
        </button>
        <section className="side-section">
          <div className="side-heading">
            <span>Recent</span>
            <button>See all</button>
          </div>
          {history.length === 0 ? (
            <p className="empty">No items yet</p>
          ) : (
            history.map((item) => (
              <button className="history-item" key={item.id} onClick={() => setResult(item)}>
                {item.title}
              </button>
            ))
          )}
        </section>
        <button className="profile">U&nbsp;&nbsp;student41031</button>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <nav>
            {modes.map((item) => (
              <button
                className={item.id === mode ? "tab active" : "tab"}
                key={item.id}
                onClick={() => pickMode(item.id)}
              >
                <item.icon size={15} />
                {item.label}
              </button>
            ))}
          </nav>
          <div className="top-actions">
            <button>Install App</button>
          </div>
        </header>

        <section className="hero-panel">
          <p className="eyebrow">
            <ActiveIcon size={16} />
            {activeMode.label}
          </p>
          <h1>{activeMode.title}</h1>
          <p>{activeMode.subtitle}</p>
        </section>

        <section className="composer">
          <textarea
            placeholder={activeMode.placeholder}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
          <div className="composer-footer">
            <div className="composer-tools">
              <button onClick={() => fileRef.current?.click()}>
                <Upload size={15} />
                Attach
              </button>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.txt"
                onChange={(event) => void onFiles(event.target.files)}
              />
              <select value={style} onChange={(event) => setStyle(event.target.value as ExplanationStyle)}>
                {styleOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select value={modelChoice} onChange={(event) => setModelChoice(event.target.value as ModelChoice)}>
                {modelOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              <input
                className="audience"
                value={audience}
                onChange={(event) => setAudience(event.target.value)}
                aria-label="Audience"
              />
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={crossCheck}
                  onChange={(event) => setCrossCheck(event.target.checked)}
                />
                Cross-check
              </label>
            </div>
            <button className="submit" disabled={!prompt.trim() || isLoading} onClick={() => void submit()}>
              {isLoading ? <RefreshCcw className="spin" size={16} /> : <Play size={16} />}
              {isLoading ? currentSubmitLabel.loading : currentSubmitLabel.idle}
            </button>
          </div>
          {attachments.length > 0 && (
            <div className="attachments">
              {attachments.map((file) => (
                <span key={`${file.name}-${file.size}`}>
                  {file.preview ? <span className="attachment-thumb" /> : <FileText size={13} />}
                  {file.name}
                  {file.extractedText ? " · analyzed" : ""}
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="quick-grid">
          {demos[mode].map((demo) => (
            <button
              key={demo}
              onClick={() => {
                setPrompt(demo);
                void submit(demo, mode);
              }}
            >
              <Lightbulb size={16} />
              <span>Try demo</span>
              <strong>{demo}</strong>
            </button>
          ))}
        </section>

        {mode === "visualizer" && (
          <section className="visual-gallery">
            <h2>Explore visual engines</h2>
            <div>
              {visualCategories.map((category, index) => (
                <article key={category}>
                  <div className={`visual-tile tile-${index}`} />
                  <strong>{category}</strong>
                  <span>Template variants and automatic quality ranking</span>
                </article>
              ))}
            </div>
          </section>
        )}

        {result && (
          <section className="result-shell">
            <div className="result-head">
              <div>
                <span className="date">{new Date(result.createdAt).toLocaleString()}</span>
                <h2>{result.title}</h2>
              </div>
              <div className="result-actions">
                <button onClick={() => navigator.clipboard.writeText(result.prompt)}>
                  <Clipboard size={15} />
                  Copy question
                </button>
                <button onClick={() => void share()}>
                  <Share2 size={15} />
                  Share
                </button>
                <button onClick={download}>
                  <Download size={15} />
                  Download
                </button>
              </div>
            </div>

            <div className="answer-card">
              <span>{resultLabels[result.mode].answer}</span>
              <div className="answer-math">
                {/[\\^_=]/.test(result.answer) ? (
                  <MathMarkdown content={`$$${result.answer.replaceAll("\\(", "").replaceAll("\\)", "")}$$`} />
                ) : (
                  <strong>{result.answer}</strong>
                )}
              </div>
              <em>
                <CheckCircle2 size={14} />
                {resultLabels[result.mode].checked}
              </em>
            </div>

            <div className="solution-layout">
              <article className="solution-card">
                <div className="section-title">
                  <BookOpen size={18} />
                  {resultLabels[result.mode].solution}
                  <button onClick={() => setPrompt(result.prompt)}>
                    <Edit3 size={14} />
                    Edit
                  </button>
                  <button onClick={() => void submit(result.prompt, result.mode)}>
                    <RefreshCcw size={14} />
                    Regenerate
                  </button>
                </div>
                <MathMarkdown content={result.solution} />
              </article>

              <aside className="inspector">
                <section>
                  <h3>{resultLabels[result.mode].side}</h3>
                  {result.verification.map((signal) => (
                    <div className="signal" key={`${signal.model}-${signal.role}`}>
                      <Bot size={14} />
                      <div>
                        <strong>{signal.model}</strong>
                        <span>
                          {signal.role} · {signal.status}
                        </span>
                        <p>{signal.notes}</p>
                      </div>
                    </div>
                  ))}
                </section>
                <section>
                  <h3>Key concepts</h3>
                  {result.keyConcepts.map((item) => (
                    <span className="pill" key={item}>
                      {item}
                    </span>
                  ))}
                </section>
                <section>
                  <h3>Common mistakes</h3>
                  <ul>
                    {result.commonMistakes.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              </aside>
            </div>

            <div className="bottom-grid">
              <article>
                <h3>Follow-up questions</h3>
                {result.followUps.map((item) => (
                  <button
                    key={item}
                    onClick={() => {
                      const nextPrompt = `${item}: ${result.prompt}`;
                      setPrompt(nextPrompt);
                      void submit(nextPrompt, result.mode);
                    }}
                  >
                    {item}
                  </button>
                ))}
              </article>
              <article>
                <h3>Quiz</h3>
                {result.quiz.map((item) => (
                  <details key={item.question}>
                    <summary>{item.question}</summary>
                    <p>{item.answer}</p>
                  </details>
                ))}
              </article>
              <article>
                <h3>{resultLabels[result.mode].plan}</h3>
                <ul>
                  {result.visualPlan.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            </div>
          </section>
        )}

        {message && <div className="toast">{message}</div>}
      </main>
    </div>
  );
}
