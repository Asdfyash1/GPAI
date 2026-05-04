"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, MessageSquare, Sigma, Zap } from "lucide-react";
import type { ChatMessage, EducationResponse } from "@/types/education";
import { MathMarkdown } from "@/components/MathMarkdown";

type ShareData = {
  type: "solve" | "chat";
  title: string;
  sharedAt: string;
  payload: EducationResponse | { messages: ChatMessage[] };
};

export function SharedPage({ slug }: { slug: string }) {
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/share/load?slug=${encodeURIComponent(slug)}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "Share not found" : "Failed to load");
        return r.json() as Promise<{ data: ShareData }>;
      })
      .then((json) => setData(json.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <div className="shared-page">
      <header className="shared-nav">
        <Link href="/" className="login-brand" aria-label="Forge home">
          <span className="landing-brand-mark" aria-hidden>
            <Zap size={18} />
          </span>
          <span className="landing-brand-text">Forge</span>
        </Link>
        <Link href="/login" className="shared-cta">
          Try Forge free
          <ArrowRight size={14} />
        </Link>
      </header>

      <main className="shared-body">
        {loading && (
          <div className="shared-loading">
            <Loader2 size={28} className="spin" />
          </div>
        )}

        {error && (
          <div className="shared-error">
            <h2>Not found</h2>
            <p>{error}</p>
            <Link href="/" className="shared-cta">
              Go to Forge
              <ArrowRight size={14} />
            </Link>
          </div>
        )}

        {data?.type === "solve" && <SharedSolve data={data.payload as EducationResponse} title={data.title} sharedAt={data.sharedAt} />}
        {data?.type === "chat" && <SharedChat data={data.payload as { messages: ChatMessage[] }} title={data.title} sharedAt={data.sharedAt} />}
      </main>
    </div>
  );
}

function SharedSolve({ data, title, sharedAt }: { data: EducationResponse; title: string; sharedAt: string }) {
  return (
    <article className="shared-card">
      <div className="shared-meta">
        <span className="shared-badge shared-badge-solve">
          <Sigma size={14} />
          Solve
        </span>
        <time className="shared-time">{new Date(sharedAt).toLocaleDateString()}</time>
      </div>
      <h1 className="shared-title">{title}</h1>
      {data.prompt && (
        <div className="shared-prompt">
          <MathMarkdown content={data.prompt} />
        </div>
      )}
      {data.answer && (
        <section className="shared-section">
          <h2>Answer</h2>
          <MathMarkdown content={data.answer} />
        </section>
      )}
      {data.steps?.length > 0 && (
        <section className="shared-section">
          <h2>Step-by-step solution</h2>
          <ol className="shared-steps">
            {data.steps.map((step, i) => (
              <li key={i} className="shared-step">
                <h3>{step.title}</h3>
                <MathMarkdown content={step.body} />
                {step.formula && (
                  <div className="shared-formula">
                    <MathMarkdown content={`$$${step.formula}$$`} />
                  </div>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
      {data.keyConcepts?.length > 0 && (
        <section className="shared-section">
          <h2>Key concepts</h2>
          <ul className="shared-concepts">
            {data.keyConcepts.map((c, i) => (
              <li key={i}><MathMarkdown content={c} /></li>
            ))}
          </ul>
        </section>
      )}
      {data.commonMistakes?.length > 0 && (
        <section className="shared-section">
          <h2>Common mistakes</h2>
          <ul className="shared-concepts">
            {data.commonMistakes.map((m, i) => (
              <li key={i}><MathMarkdown content={m} /></li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function SharedChat({ data, title, sharedAt }: { data: { messages: ChatMessage[] }; title: string; sharedAt: string }) {
  return (
    <article className="shared-card">
      <div className="shared-meta">
        <span className="shared-badge shared-badge-chat">
          <MessageSquare size={14} />
          Chat
        </span>
        <time className="shared-time">{new Date(sharedAt).toLocaleDateString()}</time>
      </div>
      <h1 className="shared-title">{title}</h1>
      <div className="shared-chat-thread">
        {data.messages
          .filter((m) => m.role !== "system")
          .map((msg) => (
            <div key={msg.id} className={`shared-chat-msg shared-chat-msg-${msg.role}`}>
              <span className="shared-chat-role">{msg.role === "user" ? "You" : "Forge"}</span>
              <div className="shared-chat-content">
                <MathMarkdown content={msg.content} />
              </div>
            </div>
          ))}
      </div>
    </article>
  );
}
