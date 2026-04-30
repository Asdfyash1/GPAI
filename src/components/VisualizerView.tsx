"use client";

import { useEffect, useState } from "react";
import { Code2, Copy, Download, Loader2, RefreshCcw } from "lucide-react";
import type {
  FrameRatio,
  ModelChoice,
  UploadedAsset,
  VisualizeResponse,
  VisualizerCategory,
} from "@/types/education";
import { Composer } from "@/components/Composer";
import { MermaidBlock } from "@/components/MermaidBlock";

type VisualizerViewProps = {
  modelChoice: ModelChoice;
  setModelChoice: (m: ModelChoice) => void;
  seedPrompt?: string;
  clearSeed?: () => void;
};

const RATIOS: Array<{ id: FrameRatio; label: string }> = [
  { id: "16:9", label: "16:9" },
  { id: "4:3", label: "4:3" },
  { id: "1:1", label: "1:1" },
  { id: "a4-portrait", label: "A4" },
  { id: "a4-landscape", label: "A4 Landscape" },
];

const CATEGORIES: Array<{ id: VisualizerCategory; label: string }> = [
  { id: "illustration", label: "Illustration" },
  { id: "graph", label: "Graph" },
  { id: "flowchart", label: "Flowchart" },
  { id: "diagram", label: "Diagram" },
  { id: "circuit", label: "Circuit" },
  { id: "chemistry", label: "Chemistry" },
  { id: "logic", label: "Logic" },
];

const QUICK = [
  "Anatomy cell layers",
  "Global climate graph",
  "Solar system cross-section",
  "DNA replication fork",
  "Projectile motion diagram",
  "Photosynthesis pathway",
];

export function VisualizerView({
  modelChoice,
  setModelChoice,
  seedPrompt,
  clearSeed,
}: VisualizerViewProps) {
  const [prompt, setPrompt] = useState(seedPrompt ?? "");

  useEffect(() => {
    if (!seedPrompt) return;
    queueMicrotask(() => {
      setPrompt(seedPrompt);
      clearSeed?.();
    });
  }, [seedPrompt, clearSeed]);
  const [attachments, setAttachments] = useState<UploadedAsset[]>([]);
  const [ratio, setRatio] = useState<FrameRatio>("16:9");
  const [category, setCategory] = useState<VisualizerCategory>("illustration");
  const [result, setResult] = useState<VisualizeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async (overridePrompt?: string) => {
    const final = (overridePrompt ?? prompt).trim();
    if (!final) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/visualize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: final,
          ratio,
          category,
          style: category === "illustration" ? "illustration" : "diagram",
        }),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => response.statusText);
        throw new Error(text || `Request failed (${response.status})`);
      }
      const data = (await response.json()) as VisualizeResponse;
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  if (!result && !loading) {
    return (
      <div className="solver-view">
        <header className="solver-hero">
          <h1 className="hero-title">Visualize STEM concepts instantly</h1>
        </header>
        <Composer
          value={prompt}
          onChange={setPrompt}
          onSubmit={() => generate()}
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          modelChoice={modelChoice}
          onModelChange={setModelChoice}
          placeholder="Enter what you want to visualize (add references for better accuracy)"
          ratioControl={
            <div className="visualizer-controls">
              <RatioSelect ratio={ratio} onChange={setRatio} />
              <CategorySelect category={category} onChange={setCategory} />
            </div>
          }
        />
        <section className="quick-section">
          <div className="chip-grid">
            {QUICK.map((q) => (
              <button key={q} type="button" className="chip" onClick={() => generate(q)}>
                {q}
              </button>
            ))}
          </div>
        </section>
        {error && <p className="error-text">{error}</p>}
      </div>
    );
  }

  return (
    <div className="visualizer-view">
      <main className="visualizer-canvas">
        {loading && (
          <div className="visualizer-loading">
            <Loader2 className="spinner" size={28} />
            <p>Generating visual…</p>
          </div>
        )}
        {result?.imageDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={result.imageDataUrl}
            alt={result.prompt}
            className={`visualizer-image visualizer-image-${ratio.replace(":", "x")}`}
          />
        )}
        {result && !result.imageDataUrl && result.diagramSpec && (
          <DiagramView
            code={result.diagramSpec}
            ratio={ratio}
            filename={`diagram-${result.id}`}
          />
        )}
        {result && !result.imageDataUrl && !result.diagramSpec && (
          <div className="visualizer-fallback">
            <p>{result.description}</p>
          </div>
        )}
      </main>
      <aside className="visualizer-rail">
        <h3 className="rail-heading">{result?.category ?? category}</h3>
        <p className="rail-prompt">{result?.prompt}</p>
        <h4 className="rail-subhead">Description</h4>
        <p className="rail-text">{result?.description}</p>
        {result?.variants && result.variants.length > 0 && (
          <>
            <h4 className="rail-subhead">Variants</h4>
            <ul className="bullet-list">
              {result.variants.map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          </>
        )}
        {result?.qualityChecks && result.qualityChecks.length > 0 && (
          <>
            <h4 className="rail-subhead">Quality checks</h4>
            <ul className="bullet-list">
              {result.qualityChecks.map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          </>
        )}
        <div className="rail-actions">
          <button
            type="button"
            className="primary-button"
            onClick={() => generate(result?.prompt ?? prompt)}
          >
            <RefreshCcw size={14} /> Regenerate
          </button>
          {result?.imageDataUrl && (
            <a
              className="secondary-button"
              href={result.imageDataUrl}
              download={`visual-${result.id}.jpg`}
            >
              <Download size={14} /> Download
            </a>
          )}
          <button
            type="button"
            className="secondary-button"
            onClick={() => setResult(null)}
          >
            New
          </button>
        </div>
      </aside>
    </div>
  );
}

function DiagramView({
  code,
  ratio,
  filename,
}: {
  code: string;
  ratio: FrameRatio;
  filename: string;
}) {
  const [showSource, setShowSource] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  const handleDownloadSvg = () => {
    if (typeof document === "undefined") return;
    const svg = document.querySelector(".visualizer-diagram .mermaid-block svg");
    if (!svg) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={`visualizer-diagram visualizer-image-${ratio.replace(":", "x")}`}
    >
      <div className="diagram-toolbar">
        <button
          type="button"
          className="icon-button"
          onClick={() => setShowSource((v) => !v)}
          aria-label={showSource ? "Hide source" : "View source"}
          title={showSource ? "Hide source" : "View source"}
        >
          <Code2 size={14} />
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={handleCopy}
          aria-label={copied ? "Copied" : "Copy source"}
          title={copied ? "Copied" : "Copy Mermaid source"}
        >
          <Copy size={14} />
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={handleDownloadSvg}
          aria-label="Download SVG"
          title="Download as SVG"
        >
          <Download size={14} />
        </button>
      </div>
      {showSource ? (
        <pre className="diagram-source">
          <code>{code}</code>
        </pre>
      ) : (
        <MermaidBlock code={code} />
      )}
    </div>
  );
}

function RatioSelect({
  ratio,
  onChange,
}: {
  ratio: FrameRatio;
  onChange: (r: FrameRatio) => void;
}) {
  return (
    <select
      className="select-control"
      value={ratio}
      onChange={(e) => onChange(e.target.value as FrameRatio)}
      aria-label="Frame ratio"
    >
      {RATIOS.map((r) => (
        <option key={r.id} value={r.id}>
          {r.label}
        </option>
      ))}
    </select>
  );
}

function CategorySelect({
  category,
  onChange,
}: {
  category: VisualizerCategory;
  onChange: (c: VisualizerCategory) => void;
}) {
  return (
    <select
      className="select-control"
      value={category}
      onChange={(e) => onChange(e.target.value as VisualizerCategory)}
      aria-label="Visualizer category"
    >
      {CATEGORIES.map((c) => (
        <option key={c.id} value={c.id}>
          {c.label}
        </option>
      ))}
    </select>
  );
}
