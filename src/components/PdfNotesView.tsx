"use client";

import { useRef, useState } from "react";
import { Download, FileText, Loader2, Printer, Upload } from "lucide-react";
import type { ModelChoice, UploadedAsset } from "@/types/education";
import { Composer } from "@/components/Composer";
import { MathMarkdown } from "@/components/MathMarkdown";
import { useStream } from "@/hooks/useStream";

type PdfNotesViewProps = {
  modelChoice: ModelChoice;
  setModelChoice: (m: ModelChoice) => void;
};

type PdfMeta = {
  filename: string;
  pages: number;
  characters: number;
};

const QUICK_PROMPTS = [
  "Make notes from organic chemistry alkanes chapter",
  "Summarize Newton's laws with key equations",
  "Make exam-prep notes on photosynthesis",
];

export function PdfNotesView({ modelChoice, setModelChoice }: PdfNotesViewProps) {
  const [prompt, setPrompt] = useState("");
  const [attachments, setAttachments] = useState<UploadedAsset[]>([]);
  const [pdfText, setPdfText] = useState<string>("");
  const [pdfMeta, setPdfMeta] = useState<PdfMeta | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [docTitle, setDocTitle] = useState("");
  const stream = useStream();

  const handlePrint = () => {
    if (!content) return;
    let backstopTimer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      if (backstopTimer) clearTimeout(backstopTimer);
      document.body.removeAttribute("data-printing");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    document.body.setAttribute("data-printing", "document");
    requestAnimationFrame(() => {
      window.print();
      // Backstop in case afterprint never fires (some mobile browsers).
      backstopTimer = setTimeout(cleanup, 4000);
    });
  };
  const fileInput = useRef<HTMLInputElement>(null);

  const handlePdfPick = async (file: File) => {
    setParsing(true);
    setParseError(null);
    setPdfText("");
    setPdfMeta(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/parse-pdf", {
        method: "POST",
        body: form,
      });
      const json = (await response.json()) as
        | { error: string }
        | { filename: string; pages: number; characters: number; text: string };
      if (!response.ok || "error" in json) {
        const msg = "error" in json ? json.error : `Failed (${response.status})`;
        throw new Error(msg);
      }
      setPdfText(json.text);
      setPdfMeta({
        filename: json.filename,
        pages: json.pages,
        characters: json.characters,
      });
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Failed to parse PDF");
    } finally {
      setParsing(false);
    }
  };

  const generate = (override?: string) => {
    const userInstruction = (override ?? prompt).trim();
    if (!pdfText && !userInstruction) return;
    const composed = pdfText
      ? `${userInstruction || "Generate structured study notes from this PDF."}\n\n--- PDF CONTENT ---\n${pdfText}`
      : userInstruction;
    setDocTitle(
      pdfMeta?.filename
        ? `Notes: ${pdfMeta.filename}`
        : userInstruction.slice(0, 80) || "PDF notes",
    );
    setContent("");
    stream.start(
      "/api/educate/stream",
      {
        mode: "pdf-notes",
        prompt: composed,
        style: "deep-explain",
        audience: "exam-prep",
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

  const empty = !content && !stream.isStreaming;

  return (
    <div className={empty ? "solver-view" : "document-view"}>
      {empty && (
        <header className="solver-hero">
          <h1 className="hero-title">Turn anything into structured notes</h1>
          <p className="hero-subtitle">
            Upload a PDF or describe a topic — get takeaways, definitions,
            formulas, and likely exam questions.
          </p>
        </header>
      )}

      {empty && (
        <div className="pdf-upload-row">
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handlePdfPick(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className="primary-button"
            onClick={() => fileInput.current?.click()}
            disabled={parsing}
          >
            {parsing ? (
              <>
                <Loader2 size={14} className="spin" /> Parsing…
              </>
            ) : (
              <>
                <Upload size={14} /> Upload PDF
              </>
            )}
          </button>
          {pdfMeta && (
            <span className="pdf-meta">
              <FileText size={14} /> {pdfMeta.filename} · {pdfMeta.pages} pages ·{" "}
              {pdfMeta.characters.toLocaleString()} chars
            </span>
          )}
          {parseError && <span className="error-text">{parseError}</span>}
        </div>
      )}

      {empty && (
        <Composer
          value={prompt}
          onChange={setPrompt}
          onSubmit={() => generate()}
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          modelChoice={modelChoice}
          onModelChange={setModelChoice}
          placeholder={
            pdfText
              ? "Optional instruction (e.g. 'focus on key formulas')"
              : "Upload PDF or enter topic"
          }
        />
      )}

      {empty && (
        <section className="quick-section">
          <div className="chip-grid">
            {QUICK_PROMPTS.map((q) => (
              <button
                key={q}
                type="button"
                className="chip"
                onClick={() => generate(q)}
              >
                {q}
              </button>
            ))}
          </div>
        </section>
      )}

      {!empty && (
        <>
          <header className="document-toolbar">
            <h2 className="document-title">{docTitle}</h2>
            <div className="document-actions">
              <button
                type="button"
                className="primary-button"
                disabled={!content}
                onClick={handlePrint}
              >
                <Printer size={14} /> Print / PDF
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label="Download as PDF"
                title="Download as PDF"
                disabled={!content}
                onClick={handlePrint}
              >
                <Download size={14} />
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setContent("");
                  setPdfText("");
                  setPdfMeta(null);
                  setPrompt("");
                }}
              >
                New
              </button>
            </div>
          </header>
          <article className="document-page">
            <MathMarkdown content={content || "Generating…"} />
            {stream.isStreaming && (
              <span className="streaming-cursor" aria-hidden />
            )}
          </article>
        </>
      )}
    </div>
  );
}
