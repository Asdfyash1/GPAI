"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Brain,
  CirclePlay,
  ImageIcon,
  Loader2,
  Lock,
  Mail,
  MessageSquare,
  Shield,
  Sigma,
  Sparkles,
  Swords,
  Zap,
} from "lucide-react";

const HIGHLIGHTS = [
  { icon: Sigma, text: "Step-by-step AI solver with cross-check verification" },
  { icon: MessageSquare, text: "Multi-model chat with persistent threads" },
  { icon: ImageIcon, text: "Diagram & image generation from prompts" },
  { icon: BookOpen, text: "Printable cheatsheets from any topic" },
  { icon: Swords, text: "4-model debate mode with judge scoring" },
  { icon: CirclePlay, text: "YouTube transcript ingestion & quiz" },
];

export function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendCode = async () => {
    if (!email || !email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to send code");
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!code || code.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Verification failed");
      router.push("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* ── Left panel: feature showcase ── */}
      <div className="login-showcase">
        <div className="login-showcase-inner">
          <Link href="/" className="login-brand" aria-label="Back to home">
            <span className="landing-brand-mark" aria-hidden>
              <Zap size={20} />
            </span>
            <span className="landing-brand-text">Forge</span>
          </Link>

          <h2 className="login-showcase-title">
            Your AI-powered <span className="login-showcase-accent">STEM workspace</span>
          </h2>
          <p className="login-showcase-subtitle">
            One toolkit for solving, chatting, visualizing, and mastering any topic.
          </p>

          <ul className="login-highlights">
            {HIGHLIGHTS.map((h) => (
              <li key={h.text} className="login-highlight-item">
                <span className="login-highlight-icon">
                  <h.icon size={16} />
                </span>
                <span>{h.text}</span>
              </li>
            ))}
          </ul>

          <div className="login-showcase-proof">
            <div className="login-proof-row">
              <Shield size={14} />
              <span>No credit card required</span>
            </div>
            <div className="login-proof-row">
              <Lock size={14} />
              <span>Your data syncs securely across devices</span>
            </div>
            <div className="login-proof-row">
              <Brain size={14} />
              <span>Powered by frontier AI models</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel: auth form ── */}
      <div className="login-form-panel">
        <div className="login-card">
          {/* Mobile-only brand (hidden on desktop where showcase has it) */}
          <Link href="/" className="login-brand login-brand-mobile" aria-label="Back to home">
            <span className="landing-brand-mark" aria-hidden>
              <Zap size={20} />
            </span>
            <span className="landing-brand-text">Forge</span>
          </Link>

          <div className="login-header">
            {step === "email" ? (
              <>
                <div className="login-icon-wrap">
                  <Sparkles size={28} />
                </div>
                <h1>Welcome back</h1>
                <p>Sign in or create an account to continue.</p>
              </>
            ) : (
              <>
                <div className="login-icon-wrap">
                  <Mail size={28} />
                </div>
                <h1>Check your email</h1>
                <p>
                  We sent a 6-digit code to <strong>{email}</strong>
                </p>
              </>
            )}
          </div>

          {error && <p className="login-error">{error}</p>}

          {step === "email" ? (
            <div className="login-form">
              <label className="login-label" htmlFor="login-email">
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                className="login-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
                autoFocus
              />
              <button
                type="button"
                className="login-submit"
                onClick={handleSendCode}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 size={16} className="spin" />
                ) : (
                  "Continue with email"
                )}
              </button>
            </div>
          ) : (
            <div className="login-form">
              <label className="login-label" htmlFor="login-otp">
                Verification code
              </label>
              <input
                id="login-otp"
                type="text"
                className="login-input login-otp-input"
                placeholder="000000"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                autoFocus
              />
              <button
                type="button"
                className="login-submit"
                onClick={handleVerify}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 size={16} className="spin" />
                ) : (
                  "Verify & sign in"
                )}
              </button>
              <button
                type="button"
                className="login-back"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError(null);
                }}
              >
                <ArrowLeft size={14} />
                Use a different email
              </button>
            </div>
          )}

          <p className="login-footer-text">
            By continuing, you agree to use Forge responsibly.
          </p>

          <Link href="/" className="login-home-link">
            <ArrowLeft size={14} />
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
