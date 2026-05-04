"use client";

import { Eye, EyeOff, Loader2, Lock, X } from "lucide-react";
import { useState } from "react";

export type AuthedUser = {
  email: string;
  emailHash: string;
  isNew: boolean;
};

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
  onAuth: (user: AuthedUser) => void;
};

export function AuthModal({ open, onClose, onAuth }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

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
      const data = (await res.json()) as {
        ok?: boolean;
        email?: string;
        emailHash?: string;
        isNew?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Authentication failed");
      if (!data.emailHash) throw new Error("Authentication response missing emailHash");
      onAuth({
        email: data.email ?? email,
        emailHash: data.emailHash,
        isNew: !!data.isNew,
      });
      onClose();
      setMode("login");
      setEmail("");
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="auth-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <div className="auth-header">
          <Lock size={28} className="auth-icon" />
          <h2>{mode === "login" ? "Sign in to Forge" : "Create your account"}</h2>
          <p>
            {mode === "login"
              ? "Enter your email and password."
              : "Create a new account to get started."}
          </p>
        </div>

        {error && <p className="auth-error">{error}</p>}

        <div className="auth-form">
          <input
            type="email"
            className="auth-input"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
          <div className="auth-password-wrap">
            <input
              type={showPassword ? "text" : "password"}
              className="auth-input"
              placeholder="Password (min 6 chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowPassword((p) => !p)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <button
            type="button"
            className="auth-submit"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? <Loader2 size={16} className="spin" /> : mode === "login" ? "Sign in" : "Create account"}
          </button>
          <button
            type="button"
            className="auth-back"
            onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); }}
          >
            {mode === "login" ? "Don\u2019t have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
