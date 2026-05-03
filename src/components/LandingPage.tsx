"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Brain,
  BookOpen,
  MessageSquare,
  Image,
  Swords,
  Video,
  Sparkles,
  ChevronRight,
  Moon,
  Sun,
} from "lucide-react";
import { AuthModal } from "@/components/AuthModal";

type Theme = "dark" | "light";

const FEATURES = [
  {
    icon: Brain,
    title: "AI Solver",
    description:
      "Step-by-step solutions with answer verification, cross-checks, and common mistakes.",
  },
  {
    icon: MessageSquare,
    title: "AI Chat",
    description:
      "Deep tutoring sessions with document, image, and link context — streaming responses.",
  },
  {
    icon: Image,
    title: "Visualizer",
    description:
      "Prompt-to-diagram generation with Mermaid, upload support, and export workflow.",
  },
  {
    icon: BookOpen,
    title: "Cheatsheet Builder",
    description:
      "Auto-generate printable, structured study sheets from any topic or uploaded file.",
  },
  {
    icon: Swords,
    title: "Debate Mode",
    description:
      "Four AI models compete on your question — a judge picks the best answer.",
  },
  {
    icon: Video,
    title: "YouTube Ingestion",
    description:
      "Paste a YouTube URL to auto-fetch captions and use them as context in chat or solver.",
  },
];

const STEPS = [
  {
    step: "1",
    title: "Ask a question",
    description:
      "Type your STEM question, upload a photo of your homework, or paste a YouTube link.",
  },
  {
    step: "2",
    title: "Get a step-by-step solution",
    description:
      "AI breaks down the problem with derivations, key concepts, and verification checks.",
  },
  {
    step: "3",
    title: "Quiz yourself",
    description:
      "Auto-generated quizzes with hints and explanations test your understanding.",
  },
];

export function LandingPage() {
  const [authOpen, setAuthOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("eduforge:theme") as Theme) || "dark";
    }
    return "dark";
  });

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("eduforge:theme", next);
  };

  return (
    <div className="landing">
      {/* ── Nav ── */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="brand">
            <span className="brand-mark">
              <Sparkles size={20} color="var(--accent)" />
            </span>
            <span className="brand-name">Forge</span>
          </div>
          <div className="landing-nav-right">
            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              type="button"
              className="landing-sign-in"
              onClick={() => setAuthOpen(true)}
            >
              Sign in
            </button>
            <Link href="/app" className="landing-cta-small">
              Open App <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="landing-hero">
        <div className="landing-hero-content">
          <h1 className="landing-hero-title">
            Learn smarter with{" "}
            <span className="landing-hero-accent">AI-powered</span> tools
          </h1>
          <p className="landing-hero-subtitle">
            Forge is your STEM copilot — solver, chat tutor, visualizer,
            cheatsheet builder, and debate arena in one workspace.
          </p>
          <div className="landing-hero-actions">
            <Link href="/app" className="landing-btn-primary">
              <Sparkles size={16} />
              Get Started — it&apos;s free
            </Link>
            <button
              type="button"
              className="landing-btn-secondary"
              onClick={() => setAuthOpen(true)}
            >
              Sign in
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="landing-section" id="features">
        <h2 className="landing-section-title">Everything you need to learn</h2>
        <p className="landing-section-subtitle">
          Six powerful tools, one workspace. No switching tabs.
        </p>
        <div className="landing-features-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="landing-feature-card">
              <div className="landing-feature-icon">
                <f.icon size={22} />
              </div>
              <h3>{f.title}</h3>
              <p>{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="landing-section landing-how-it-works" id="how">
        <h2 className="landing-section-title">How it works</h2>
        <p className="landing-section-subtitle">
          From question to understanding in three steps.
        </p>
        <div className="landing-steps">
          {STEPS.map((s) => (
            <div key={s.step} className="landing-step-card">
              <div className="landing-step-num">{s.step}</div>
              <h3>{s.title}</h3>
              <p>{s.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="landing-section landing-bottom-cta">
        <h2 className="landing-section-title">
          Ready to supercharge your learning?
        </h2>
        <p className="landing-section-subtitle">
          No credit card required. Jump in and start solving.
        </p>
        <Link href="/app" className="landing-btn-primary">
          <Sparkles size={16} />
          Try Forge now
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <span>Forge — STEM Copilot</span>
        <span className="landing-footer-dot">·</span>
        <span>Powered by NVIDIA NIM</span>
      </footer>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuth={() => {
          setAuthOpen(false);
          window.location.href = "/app";
        }}
      />
    </div>
  );
}
