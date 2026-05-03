"use client";

import { Loader2, Mail, X } from "lucide-react";
import { useState } from "react";

export type AuthedUser = {
  email: string;
  emailHash: string;
  // True the very first time this email completed verification (no
  // prior cloud data). EducationApp uses this to decide whether to
  // offer the localStorage → cloud migration prompt: only when this
  // device has data AND the cloud is fresh.
  isNew: boolean;
};

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
  onAuth: (user: AuthedUser) => void;
};

export function AuthModal({ open, onClose, onAuth }: AuthModalProps) {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

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
      const data = (await res.json()) as {
        ok?: boolean;
        email?: string;
        emailHash?: string;
        isNew?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Verification failed");
      if (!data.emailHash) throw new Error("Verification response missing emailHash");
      onAuth({
        email: data.email ?? email,
        emailHash: data.emailHash,
        isNew: !!data.isNew,
      });
      onClose();
      setStep("email");
      setEmail("");
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
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
          <Mail size={28} className="auth-icon" />
          <h2>{step === "email" ? "Sign in to Forge" : "Enter verification code"}</h2>
          <p>
            {step === "email"
              ? "We'll send a 6-digit code to your email."
              : `Code sent to ${email}`}
          </p>
        </div>

        {error && <p className="auth-error">{error}</p>}

        {step === "email" ? (
          <div className="auth-form">
            <input
              type="email"
              className="auth-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
              autoFocus
            />
            <button
              type="button"
              className="auth-submit"
              onClick={handleSendCode}
              disabled={loading}
            >
              {loading ? <Loader2 size={16} className="spin" /> : "Send code"}
            </button>
          </div>
        ) : (
          <div className="auth-form">
            <input
              type="text"
              className="auth-input auth-otp"
              placeholder="000000"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && handleVerify()}
              autoFocus
            />
            <button
              type="button"
              className="auth-submit"
              onClick={handleVerify}
              disabled={loading}
            >
              {loading ? <Loader2 size={16} className="spin" /> : "Verify"}
            </button>
            <button
              type="button"
              className="auth-back"
              onClick={() => {
                setStep("email");
                setCode("");
                setError(null);
              }}
            >
              Use a different email
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
