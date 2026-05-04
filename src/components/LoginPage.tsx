"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Brain,
  CirclePlay,
  Eye,
  EyeOff,
  ImageIcon,
  Loader2,
  Lock,
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
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email || !email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Authentication failed");
      router.push("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
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
            <div className="login-icon-wrap">
              <Sparkles size={28} />
            </div>
            <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
            <p>{mode === "login" ? "Sign in to continue to Forge." : "Get started with Forge for free."}</p>
          </div>

          {error && <p className="login-error">{error}</p>}

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
              autoFocus
            />

            <label className="login-label" htmlFor="login-password">
              Password
            </label>
            <div className="login-password-wrap">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                className="login-input"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword((p) => !p)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <button
              type="button"
              className="login-submit"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <Loader2 size={16} className="spin" />
              ) : mode === "login" ? (
                "Sign in"
              ) : (
                "Create account"
              )}
            </button>

            <p className="login-switch">
              {mode === "login" ? (
                <>
                  Don&apos;t have an account?{" "}
                  <button type="button" className="login-switch-btn" onClick={() => { setMode("signup"); setError(null); }}>
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button type="button" className="login-switch-btn" onClick={() => { setMode("login"); setError(null); }}>
                    Sign in
                  </button>
                </>
              )}
            </p>
          </div>

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
