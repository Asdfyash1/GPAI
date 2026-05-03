"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Sparkles, Zap } from "lucide-react";

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
      <div className="login-card">
        <Link href="/" className="login-brand" aria-label="Back to home">
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
              <h1>Welcome to Forge</h1>
              <p>Sign in or create an account to start learning with AI.</p>
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
              Use a different email
            </button>
          </div>
        )}

        <p className="login-footer-text">
          By continuing, you agree to use Forge responsibly.
        </p>
      </div>
    </div>
  );
}
