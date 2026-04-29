"use client";

import { useState } from "react";
import { Download, Printer } from "lucide-react";
import type {
  FeatureMode,
  ModelChoice,
  UploadedAsset,
} from "@/types/education";
import { Composer } from "@/components/Composer";
import { MathMarkdown } from "@/components/MathMarkdown";
import { useStream } from "@/hooks/useStream";

type DocumentViewProps = {
  mode: FeatureMode;
  modelChoice: ModelChoice;
  setModelChoice: (m: ModelChoice) => void;
  title: string;
  subtitle?: string;
  placeholder: string;
  quickPrompts: string[];
  emptyHero?: React.ReactNode;
};

export function DocumentView({
  mode,
  modelChoice,
  setModelChoice,
  title,
  subtitle,
  placeholder,
  quickPrompts,
}: DocumentViewProps) {
  const [prompt, setPrompt] = useState("");
  const [attachments, setAttachments] = useState<UploadedAsset[]>([]);
  const [content, setContent] = useState("");
  const [docTitle, setDocTitle] = useState("");
  const stream = useStream();

  const generate = (override?: string) => {
    const final = (override ?? prompt).trim();
    if (!final) return;
    setDocTitle(final);
    setContent("");
    stream.start(
      "/api/educate/stream",
      {
        mode,
        prompt: final,
        style: "deep-explain",
        audience: "high-school to early college",
        attachments,
        crossCheck: false,
        modelChoice,
      },
      {
        onChunk: (text) => setContent(text),
        onFinal: (text) => setContent(text),
      },
    );
  };

  const handlePrint = () => {
    const html = `<article>${content}</article>`;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!doctype html><html><head><title>${docTitle}</title>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" />
      <style>
      @page { size: A4; margin: 18mm; }
      body { font-family: -apple-system, system-ui, sans-serif; font-size: 11pt; line-height: 1.55; color: #111; }
      h1 { font-size: 18pt; }
      h2 { font-size: 14pt; margin-top: 14pt; }
      h3 { font-size: 12pt; margin-top: 10pt; }
      </style></head><body><h1>${docTitle}</h1>${html}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  const empty = !content && !stream.isStreaming;

  if (empty) {
    return (
      <div className="solver-view">
        <header className="solver-hero">
          <h1 className="hero-title">{title}</h1>
          {subtitle && <p className="hero-subtitle">{subtitle}</p>}
        </header>
        <Composer
          value={prompt}
          onChange={setPrompt}
          onSubmit={() => generate()}
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          modelChoice={modelChoice}
          onModelChange={setModelChoice}
          placeholder={placeholder}
        />
        <section className="quick-section">
          <div className="chip-grid">
            {quickPrompts.map((q) => (
              <button key={q} type="button" className="chip" onClick={() => generate(q)}>
                {q}
              </button>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="document-view">
      <header className="document-toolbar">
        <h2 className="document-title">{docTitle || title}</h2>
        <div className="document-actions">
          <button type="button" className="primary-button" onClick={handlePrint}>
            <Printer size={14} /> Print / PDF
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Download markdown"
            onClick={() => {
              const blob = new Blob([content], { type: "text/markdown" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${mode}-${Date.now()}.md`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download size={14} />
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setContent("")}
          >
            New
          </button>
        </div>
      </header>
      <article className="document-page">
        <MathMarkdown content={content || "Generating…"} />
        {stream.isStreaming && <span className="streaming-cursor" aria-hidden />}
      </article>
    </div>
  );
}
