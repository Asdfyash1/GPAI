"use client";

import {
  ArrowUp,
  Globe,
  Mic,
  Paperclip,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import {
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  useCallback,
  useRef,
  useState,
} from "react";
import type { ModelChoice, UploadedAsset } from "@/types/education";

const modelOptions: Array<{ id: ModelChoice; label: string }> = [
  { id: "auto", label: "Auto" },
  { id: "mistral-large", label: "Mistral Large 3" },
  { id: "nemotron", label: "Nemotron 49B" },
  { id: "deepseek-flash", label: "DeepSeek V4 Flash" },
  { id: "llama", label: "Llama 3.3 70B" },
  { id: "demo", label: "Demo (offline)" },
];

type ComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  isStreaming?: boolean;
  placeholder?: string;
  attachments: UploadedAsset[];
  onAttachmentsChange: (attachments: UploadedAsset[]) => void;
  modelChoice: ModelChoice;
  onModelChange: (choice: ModelChoice) => void;
  showCrossCheck?: boolean;
  crossCheck?: boolean;
  onCrossCheckChange?: (value: boolean) => void;
  showWeb?: boolean;
  webEnabled?: boolean;
  onWebToggle?: (value: boolean) => void;
  showDeepExplain?: boolean;
  deepExplain?: boolean;
  onDeepExplainChange?: (value: boolean) => void;
  ratioControl?: React.ReactNode;
  hint?: string;
  compact?: boolean;
  /**
   * If true, plain Enter sends and Shift+Enter inserts a newline
   * (chat-style). If false (the default), Enter inserts a newline and
   * Cmd/Ctrl+Enter sends (long-form prompt style).
   */
  enterToSend?: boolean;
};

export function Composer(props: ComposerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);

  const onPickFiles = useCallback(
    async (files: FileList | File[] | null) => {
      if (!files) return;
      const list = Array.from(files);
      const next: UploadedAsset[] = [];
      for (const file of list) {
        // Compress large images client-side so we never blow past Vercel's
        // 4.5 MB request body limit and so the vision API responds in <30s.
        // PDFs and text files are passed through untouched.
        let payload: { dataUrl: string; size: number; type: string } = {
          dataUrl: await readAsDataUrl(file),
          size: file.size,
          type: file.type,
        };
        if (file.type.startsWith("image/")) {
          try {
            payload = await compressImageIfLarge(file, payload.dataUrl);
          } catch {
            // fall through with the original dataUrl if anything goes wrong
          }
        }
        next.push({
          name: file.name,
          type: payload.type,
          size: payload.size,
          dataUrl: payload.dataUrl,
          preview: payload.type.startsWith("image/") ? payload.dataUrl : undefined,
        });
      }
      props.onAttachmentsChange([...props.attachments, ...next]);
    },
    [props],
  );

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const dt = e.dataTransfer;
    if (dt?.files && dt.files.length > 0) onPickFiles(dt.files);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter") return;
    if (props.enterToSend && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      props.onSubmit();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      props.onSubmit();
    }
  };

  return (
    <div
      className={`composer ${dragOver ? "is-drag-over" : ""} ${props.compact ? "is-compact" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {props.attachments.length > 0 && (
        <div className="attachment-row">
          {props.attachments.map((a, i) => (
            <div key={`${a.name}-${i}`} className="attachment-chip">
              {a.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.preview} alt={a.name} className="attachment-thumb" />
              ) : (
                <span className="attachment-icon">📄</span>
              )}
              <span className="attachment-name">{a.name}</span>
              <button
                type="button"
                className="icon-button attachment-remove"
                aria-label="Remove attachment"
                onClick={() =>
                  props.onAttachmentsChange(
                    props.attachments.filter((_, idx) => idx !== i),
                  )
                }
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <textarea
        className="composer-textarea"
        placeholder={props.placeholder ?? "Type a message..."}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={props.compact ? 2 : 3}
      />

      <div className="composer-bottom">
        <div className="composer-actions">
          <button
            type="button"
            className="icon-button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach file"
            aria-label="Attach file"
          >
            <Paperclip size={16} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,application/pdf,.txt,.md,.markdown,.csv,.tsv,.log,.json,.xml,.yaml,.yml,.html,.htm,.js,.jsx,.ts,.tsx,.py,.java,.c,.cpp,.cs,.go,.rs,.rb,.php,.swift,.kt,.sql"
            onChange={(e: ChangeEvent<HTMLInputElement>) => onPickFiles(e.target.files)}
            hidden
          />
          {props.showWeb && (
            <button
              type="button"
              className={`pill-button ${props.webEnabled ? "is-active" : ""}`}
              onClick={() => props.onWebToggle?.(!props.webEnabled)}
              title={
                props.webEnabled
                  ? "Web search is on — sources will be fetched and grounded into the answer"
                  : "Turn on web search to ground answers in live web sources"
              }
              aria-pressed={props.webEnabled}
            >
              <Globe size={14} />
              <span>Web search</span>
            </button>
          )}
          {props.showDeepExplain && (
            <button
              type="button"
              className={`pill-button deep-toggle ${props.deepExplain ? "is-active" : ""}`}
              onClick={() => props.onDeepExplainChange?.(!props.deepExplain)}
            >
              <Sparkles size={14} />
              <span>Deep explain</span>
            </button>
          )}
          {props.ratioControl}
          <button type="button" className="icon-button" title="Voice (coming soon)" disabled>
            <Mic size={16} />
          </button>
        </div>

        <div className="composer-actions">
          {props.showCrossCheck && (
            <label className="cross-check">
              <input
                type="checkbox"
                checked={props.crossCheck ?? true}
                onChange={(e) => props.onCrossCheckChange?.(e.target.checked)}
              />
              <span>Cross-check</span>
            </label>
          )}
          <div className="model-select-wrap">
            <button
              type="button"
              className="model-select-btn"
              onClick={() => setModelOpen((p) => !p)}
              aria-haspopup="menu"
              aria-expanded={modelOpen}
            >
              {modelOptions.find((m) => m.id === props.modelChoice)?.label ??
                "Auto"}
            </button>
            {modelOpen && (
              <div className="model-select-menu">
                {modelOptions.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`model-option ${
                      props.modelChoice === m.id ? "is-active" : ""
                    }`}
                    onClick={() => {
                      props.onModelChange(m.id);
                      setModelOpen(false);
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {props.isStreaming ? (
            <button
              type="button"
              className="send-button is-stop"
              onClick={props.onStop}
              aria-label="Stop"
            >
              <Square size={14} />
            </button>
          ) : (
            <button
              type="button"
              className="send-button"
              onClick={props.onSubmit}
              aria-label="Submit"
              disabled={!props.value.trim() && props.attachments.length === 0}
            >
              <ArrowUp size={16} />
            </button>
          )}
        </div>
      </div>

      {props.hint && <p className="composer-hint">{props.hint}</p>}
    </div>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const COMPRESS_THRESHOLD_BYTES = 1_000_000; // 1 MB original
const COMPRESS_MAX_EDGE = 1600;
const COMPRESS_QUALITY = 0.85;

async function compressImageIfLarge(
  file: File,
  originalDataUrl: string,
): Promise<{ dataUrl: string; size: number; type: string }> {
  // Skip work for already-small images and SVGs (which would rasterize badly).
  if (file.size < COMPRESS_THRESHOLD_BYTES) {
    return { dataUrl: originalDataUrl, size: file.size, type: file.type };
  }
  if (file.type === "image/svg+xml" || file.type === "image/gif") {
    return { dataUrl: originalDataUrl, size: file.size, type: file.type };
  }
  if (typeof document === "undefined") {
    return { dataUrl: originalDataUrl, size: file.size, type: file.type };
  }

  const img = await loadImage(originalDataUrl);
  const longEdge = Math.max(img.width, img.height);
  if (longEdge <= COMPRESS_MAX_EDGE && file.size < 3_000_000) {
    // Image is already small enough on both axes; only compress huge files.
    return { dataUrl: originalDataUrl, size: file.size, type: file.type };
  }
  const scale = longEdge > COMPRESS_MAX_EDGE ? COMPRESS_MAX_EDGE / longEdge : 1;
  const targetWidth = Math.round(img.width * scale);
  const targetHeight = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { dataUrl: originalDataUrl, size: file.size, type: file.type };
  }
  // White background so JPEG re-encoding of PNGs with transparency stays legible.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const compressedDataUrl = canvas.toDataURL("image/jpeg", COMPRESS_QUALITY);
  // base64 length × 0.75 ≈ raw bytes; the prefix `data:image/jpeg;base64,` is ~23 chars.
  const approxBytes = Math.round((compressedDataUrl.length - 23) * 0.75);
  if (approxBytes >= file.size) {
    // Don't grow the file if compression somehow made it bigger.
    return { dataUrl: originalDataUrl, size: file.size, type: file.type };
  }
  return {
    dataUrl: compressedDataUrl,
    size: approxBytes,
    type: "image/jpeg",
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode image for compression"));
    img.src = src;
  });
}
