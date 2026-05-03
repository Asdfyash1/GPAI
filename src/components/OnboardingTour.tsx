"use client";

import { useState } from "react";
import {
  Calculator,
  MessageCircle,
  BarChart3,
  FileText,
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
} from "lucide-react";

const TOUR_KEY = "eduforge:onboarding-done";

const STEPS = [
  {
    icon: <Sparkles size={32} />,
    title: "Welcome to Forge",
    description:
      "Your AI-powered study companion for math, physics, chemistry, and more. Let's take a quick tour of what you can do.",
    accent: "#f97316",
  },
  {
    icon: <Calculator size={32} />,
    title: "Solver",
    description:
      "Paste or photograph any STEM problem and get a step-by-step solution with cross-checking. Steps are revealed one at a time so you can think before peeking.",
    accent: "#f97316",
  },
  {
    icon: <MessageCircle size={32} />,
    title: "Chat",
    description:
      "Have a conversation with an AI tutor. Toggle Deep Explain for rich, multi-section answers or keep it conversational. Web search is built in.",
    accent: "#38bdf8",
  },
  {
    icon: <BarChart3 size={32} />,
    title: "Visualizer",
    description:
      "Turn any concept into a diagram — flowcharts, mind maps, timelines, and more. Powered by Mermaid with light/dark theme support.",
    accent: "#a78bfa",
  },
  {
    icon: <FileText size={32} />,
    title: "Cheatsheet & Notes",
    description:
      "Generate printable cheatsheets and study notes from any topic. Export as PDF with one click.",
    accent: "#facc15",
  },
];

export function OnboardingTour() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem(TOUR_KEY);
  });
  const [step, setStep] = useState(0);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(TOUR_KEY, "1");
    setVisible(false);
  };

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="onboarding-overlay" onClick={dismiss}>
      <div
        className="onboarding-card"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="onboarding-close"
          onClick={dismiss}
          aria-label="Close tour"
        >
          <X size={18} />
        </button>

        <div className="onboarding-icon" style={{ color: current.accent }}>
          {current.icon}
        </div>

        <h2 className="onboarding-title">{current.title}</h2>
        <p className="onboarding-desc">{current.description}</p>

        <div className="onboarding-dots">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`onboarding-dot ${i === step ? "is-active" : ""}`}
              style={i === step ? { background: current.accent } : undefined}
            />
          ))}
        </div>

        <div className="onboarding-actions">
          {step > 0 && (
            <button
              type="button"
              className="onboarding-btn onboarding-btn-back"
              onClick={() => setStep((s) => s - 1)}
            >
              <ChevronLeft size={14} />
              <span>Back</span>
            </button>
          )}
          <button
            type="button"
            className="onboarding-btn onboarding-btn-next"
            style={{ background: current.accent }}
            onClick={() => {
              if (isLast) {
                dismiss();
              } else {
                setStep((s) => s + 1);
              }
            }}
          >
            <span>{isLast ? "Get started" : "Next"}</span>
            {!isLast && <ChevronRight size={14} />}
          </button>
        </div>

        <button
          type="button"
          className="onboarding-skip"
          onClick={dismiss}
        >
          Skip tour
        </button>
      </div>
    </div>
  );
}
