import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  CirclePlay,
  Image as ImageIcon,
  MessageSquare,
  PenSquare,
  Sigma,
  Sparkles,
  Swords,
  Zap,
} from "lucide-react";

const FEATURES = [
  {
    icon: Sigma,
    title: "AI Solver",
    description:
      "Snap a problem photo or paste it. Get a step-by-step solution with cross-checked answers, key concepts, common mistakes, and a built-in quiz.",
  },
  {
    icon: MessageSquare,
    title: "AI Chat",
    description:
      "Streaming conversations with multiple frontier models. Persistent threads, follow-up chips, and inline glossary terms you can hover to define.",
  },
  {
    icon: ImageIcon,
    title: "AI Visualizer",
    description:
      "Turn an idea into a labeled diagram, flowchart, circuit, or chemistry structure. Mermaid + image generation in one panel.",
  },
  {
    icon: BookOpen,
    title: "Cheatsheet Builder",
    description:
      "Compress a topic, syllabus, or paper into a compact, printable cheatsheet with sections you can regenerate one at a time.",
  },
  {
    icon: Swords,
    title: "Debate Mode",
    description:
      "Pit four models against the same prompt, then a judge model picks the winner. Side-by-side answers reveal where models disagree.",
  },
  {
    icon: CirclePlay,
    title: "YouTube Ingestion",
    description:
      "Paste a YouTube URL — Forge auto-fetches the transcript and lets you ask questions, summarize, or quiz yourself on the video.",
  },
];

const STEPS = [
  {
    num: "1",
    title: "Ask anything",
    body: "Type a problem, paste a URL, or upload a photo / PDF. Solver, Chat, Visualizer, and Cheatsheet are one tab away.",
  },
  {
    num: "2",
    title: "Get a structured answer",
    body: "Streamed step-by-step solutions with cross-check verification, glossary terms, and follow-up chips for instant deeper dives.",
  },
  {
    num: "3",
    title: "Quiz yourself",
    body: "Every solve ships with a built-in quiz panel — paginated, hint-aware, with explanations once you submit.",
  },
];

export function LandingPage() {
  return (
    <div className="landing-root">
      <header className="landing-nav">
        <Link href="/" className="landing-brand" aria-label="Forge home">
          <span className="landing-brand-mark" aria-hidden>
            <Zap size={18} />
          </span>
          <span className="landing-brand-text">Forge</span>
        </Link>
        <nav className="landing-nav-links" aria-label="Primary">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#why">Why Forge</a>
        </nav>
        <div className="landing-nav-cta">
          <Link href="/app?auth=open" className="landing-link-quiet">
            Sign in
          </Link>
          <Link href="/app" className="landing-cta landing-cta-primary">
            Get started
            <ArrowRight size={16} />
          </Link>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-inner">
            <span className="landing-eyebrow">
              <Sparkles size={14} />
              AI-powered learning, end to end
            </span>
            <h1 className="landing-title">
              Solve, visualize, and master <span className="landing-title-accent">any STEM topic</span>{" "}
              in one workspace.
            </h1>
            <p className="landing-subtitle">
              Forge turns a problem photo, a paragraph, or a YouTube link into a step-by-step
              solution, a diagram, a cheatsheet, and a quiz — without juggling tabs.
            </p>
            <div className="landing-hero-cta">
              <Link href="/app" className="landing-cta landing-cta-primary landing-cta-large">
                Try it free
                <ArrowRight size={18} />
              </Link>
              <Link href="/app?auth=open" className="landing-cta landing-cta-ghost landing-cta-large">
                Sign in
              </Link>
            </div>
            <ul className="landing-hero-bullets">
              <li>
                <CheckCircle2 size={14} />
                No credit card. No install. Open and start solving.
              </li>
              <li>
                <CheckCircle2 size={14} />
                Optional sign-in syncs your chats and history across devices.
              </li>
            </ul>
          </div>
          <div className="landing-hero-card" aria-hidden>
            <div className="landing-hero-card-row landing-hero-card-row-user">
              <span className="landing-hero-bubble landing-hero-bubble-user">
                Solve <code>(D⁴ − 2D³ + D²) y = x³</code>
              </span>
            </div>
            <div className="landing-hero-card-row">
              <span className="landing-hero-pill">Answer</span>
              <span className="landing-hero-mono">
                y = c₁ + c₂ x + (c₃ + c₄ x) e<sup>x</sup> + x⁵ / 60
              </span>
            </div>
            <div className="landing-hero-card-row">
              <span className="landing-hero-pill">Cross-check</span>
              <span className="landing-hero-models">
                <span className="landing-hero-avatar">L</span>
                <span className="landing-hero-avatar">N</span>
                <span className="landing-hero-agree">Models agree</span>
              </span>
            </div>
            <div className="landing-hero-card-row">
              <span className="landing-hero-pill">Quiz</span>
              <span className="landing-hero-quiz">What is the order of this ODE?</span>
            </div>
          </div>
        </section>

        <section id="features" className="landing-section">
          <div className="landing-section-head">
            <span className="landing-eyebrow-quiet">Features</span>
            <h2>Everything you need, in one tab.</h2>
            <p>
              Six tools sharing one composer, one history, and one streaming model layer. Switch
              modes mid-conversation without losing context.
            </p>
          </div>
          <div className="landing-features-grid">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <article key={feature.title} className="landing-feature-card">
                  <span className="landing-feature-icon" aria-hidden>
                    <Icon size={20} />
                  </span>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section id="how-it-works" className="landing-section landing-section-alt">
          <div className="landing-section-head">
            <span className="landing-eyebrow-quiet">How it works</span>
            <h2>From a fuzzy question to a confident answer in three steps.</h2>
          </div>
          <ol className="landing-steps">
            {STEPS.map((step) => (
              <li key={step.num}>
                <span className="landing-step-num">{step.num}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="why" className="landing-section">
          <div className="landing-why">
            <div className="landing-why-text">
              <span className="landing-eyebrow-quiet">Why Forge</span>
              <h2>Designed for learners who are tired of bouncing between tabs.</h2>
              <ul className="landing-why-list">
                <li>
                  <Brain size={18} />
                  <span>
                    <strong>Cross-checked answers.</strong> Two models solve in parallel and a
                    badge tells you when they disagree — so you know when to double-check.
                  </span>
                </li>
                <li>
                  <PenSquare size={18} />
                  <span>
                    <strong>Reuse, don&rsquo;t retype.</strong> Every solve, chat, and cheatsheet lives in
                    your sidebar; sign in to sync across devices.
                  </span>
                </li>
                <li>
                  <Sparkles size={18} />
                  <span>
                    <strong>Built for mobile.</strong> Off-canvas drawer, full-screen settings,
                    composer reflow — usable on a phone the same way it&rsquo;s usable on a laptop.
                  </span>
                </li>
              </ul>
              <div className="landing-why-cta">
                <Link href="/app" className="landing-cta landing-cta-primary landing-cta-large">
                  Open the workspace
                  <ArrowRight size={18} />
                </Link>
                <Link href="/app?auth=open" className="landing-link-quiet">
                  Already have an account? Sign in
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <Link href="/" className="landing-brand" aria-label="Forge home">
            <span className="landing-brand-mark" aria-hidden>
              <Zap size={16} />
            </span>
            <span className="landing-brand-text">Forge</span>
          </Link>
          <p className="landing-footer-tag">A learner&rsquo;s workspace for STEM and beyond.</p>
          <div className="landing-footer-links">
            <Link href="/app">Open workspace</Link>
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
