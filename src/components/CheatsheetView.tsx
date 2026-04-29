"use client";

import { useRef, useState } from "react";
import { History, Trash2 } from "lucide-react";
import {
  Bold,
  Download,
  Italic,
  List,
  ListOrdered,
  Minus,
  Plus,
  Printer,
  RotateCcw,
  Sigma,
  Underline,
} from "lucide-react";
import type { ModelChoice, UploadedAsset } from "@/types/education";
import { Composer } from "@/components/Composer";
import { MathMarkdown } from "@/components/MathMarkdown";
import { useStream } from "@/hooks/useStream";

type CheatsheetViewProps = {
  modelChoice: ModelChoice;
  setModelChoice: (m: ModelChoice) => void;
};

type CheatsheetVersion = {
  id: string;
  label: string;
  content: string;
  createdAt: string;
};

const QUICK = [
  "Generate 2 page mechanics cheatsheet for Hibbeler",
  "Generate 2 page cheat sheet for Halliday Physics",
  "Generate 2 page algorithm cheatsheet for CLRS",
];

export function CheatsheetView({ modelChoice, setModelChoice }: CheatsheetViewProps) {
  const [prompt, setPrompt] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [attachments, setAttachments] = useState<UploadedAsset[]>([]);
  const [content, setContent] = useState("");
  const [zoom, setZoom] = useState(100);
  const [history, setHistory] = useState<CheatsheetVersion[]>([]);
  const stream = useStream();
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement | null>(null);

  const pushVersion = (label: string, body: string) => {
    const id = `cs_${Date.now()}`;
    setHistory((h) =>
      [{ id, label, content: body, createdAt: new Date().toISOString() }, ...h].slice(
        0,
        12,
      ),
    );
    setActiveVersionId(id);
  };

  const generate = (overridePrompt?: string) => {
    const final = (overridePrompt ?? prompt).trim();
    if (!final) return;
    setContent("");
    stream.start(
      "/api/educate/stream",
      {
        mode: "cheatsheet",
        prompt: final,
        style: "exam",
        audience: "exam-ready",
        attachments,
        crossCheck: false,
        modelChoice,
      },
      {
        onChunk: (text) => setContent(text),
        onFinal: (text) => {
          setContent(text);
          pushVersion(final.slice(0, 60), text);
        },
      },
    );
  };

  const editCheatsheet = () => {
    const instruction = editPrompt.trim();
    if (!instruction || !content) return;
    setEditPrompt("");
    const composite = `Update the following cheatsheet according to this instruction: "${instruction}"\n\nCurrent cheatsheet markdown:\n\n${content}`;
    setContent("");
    stream.start(
      "/api/educate/stream",
      {
        mode: "cheatsheet",
        prompt: composite,
        style: "exam",
        audience: "exam-ready",
        attachments: [],
        crossCheck: false,
        modelChoice,
      },
      {
        onChunk: (text) => setContent(text),
        onFinal: (text) => {
          setContent(text);
          pushVersion(`Edit: ${instruction.slice(0, 50)}`, text);
        },
      },
    );
  };

  const restoreVersion = (id: string) => {
    const v = history.find((h) => h.id === id);
    if (!v) return;
    setContent(v.content);
    setActiveVersionId(id);
  };

  const deleteVersion = (id: string) => {
    setHistory((h) => h.filter((v) => v.id !== id));
    if (activeVersionId === id) setActiveVersionId(null);
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const html = printRef.current.innerHTML;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!doctype html><html><head><title>Cheatsheet</title>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" />
      <style>
      @page { size: A4; margin: 12mm; }
      body { font-family: -apple-system, system-ui, sans-serif; columns: 2; column-gap: 14mm; font-size: 9pt; line-height: 1.35; color:#111; }
      h1,h2,h3 { break-after: avoid; }
      h1 { font-size: 14pt; }
      h2 { font-size: 11pt; margin-top: 6pt; }
      ul, ol { padding-left: 16px; }
      .katex { font-size: 1em !important; }
      </style></head><body>${html}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  const empty = !content && !stream.isStreaming;

  if (empty) {
    return (
      <div className="solver-view">
        <header className="solver-hero">
          <h1 className="hero-title">Create exam-ready cheatsheet</h1>
        </header>
        <Composer
          value={prompt}
          onChange={setPrompt}
          onSubmit={() => generate()}
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          modelChoice={modelChoice}
          onModelChange={setModelChoice}
          placeholder="Enter a topic or upload files"
        />
        <section className="quick-section">
          <div className="chip-grid">
            {QUICK.map((q) => (
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
      </div>
    );
  }

  return (
    <div className="cheatsheet-view">
      <aside className="cheatsheet-side">
        <div className="cheatsheet-side-header">
          <h2>Cheatsheet</h2>
          <button className="primary-button" type="button" onClick={() => generate()}>
            Regenerate
          </button>
        </div>
        <div className="cheatsheet-history">
          {history.length === 0 ? (
            <div className="cheatsheet-history-empty">
              <History size={12} /> No versions yet — every generation or edit is
              saved here.
            </div>
          ) : (
            history.map((v, i) => (
              <div
                key={v.id}
                className={`cheatsheet-version ${
                  activeVersionId === v.id ? "is-active" : ""
                }`}
              >
                <button
                  type="button"
                  className="cheatsheet-version-main"
                  onClick={() => restoreVersion(v.id)}
                  title={v.label}
                >
                  <span className="cheatsheet-version-label">
                    v{history.length - i} · {v.label}
                  </span>
                  <span className="cheatsheet-version-tag">
                    {new Date(v.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </button>
                <div className="cheatsheet-version-actions">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Restore"
                    onClick={() => restoreVersion(v.id)}
                  >
                    <RotateCcw size={12} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Delete"
                    onClick={() => deleteVersion(v.id)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="cheatsheet-edit-composer">
          <input
            type="text"
            placeholder="Enter what you want to change"
            value={editPrompt}
            onChange={(e) => setEditPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) editCheatsheet();
            }}
          />
          <button type="button" className="primary-button" onClick={editCheatsheet}>
            Apply
          </button>
        </div>
      </aside>
      <main className="cheatsheet-main">
        <div className="cheatsheet-toolbar">
          <div className="cheatsheet-zoom">
            <button
              type="button"
              className="icon-button"
              onClick={() => setZoom((z) => Math.max(60, z - 10))}
            >
              <Minus size={14} />
            </button>
            <span>{zoom}%</span>
            <button
              type="button"
              className="icon-button"
              onClick={() => setZoom((z) => Math.min(140, z + 10))}
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="cheatsheet-format">
            <button className="icon-button" type="button" disabled>
              <Bold size={14} />
            </button>
            <button className="icon-button" type="button" disabled>
              <Italic size={14} />
            </button>
            <button className="icon-button" type="button" disabled>
              <Underline size={14} />
            </button>
            <button className="icon-button" type="button" disabled>
              <List size={14} />
            </button>
            <button className="icon-button" type="button" disabled>
              <ListOrdered size={14} />
            </button>
            <button className="icon-button" type="button" disabled>
              <Sigma size={14} />
            </button>
          </div>
          <div className="cheatsheet-export">
            <button
              type="button"
              className="primary-button"
              onClick={handlePrint}
              disabled={!content}
            >
              <Printer size={14} /> Print / PDF
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={() => {
                const blob = new Blob([content], { type: "text/markdown" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "cheatsheet.md";
                a.click();
                URL.revokeObjectURL(url);
              }}
              disabled={!content}
              aria-label="Download markdown"
            >
              <Download size={14} />
            </button>
          </div>
        </div>
        <div className="cheatsheet-canvas-wrap" style={{ ["--zoom" as string]: zoom / 100 }}>
          <article
            ref={printRef}
            className="cheatsheet-page"
            style={{ transform: `scale(${zoom / 100})` }}
          >
            <MathMarkdown content={content || "Generating cheatsheet…"} />
          </article>
        </div>
      </main>
    </div>
  );
}
