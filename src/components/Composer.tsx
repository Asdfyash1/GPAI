"use client";

import {
  ArrowUp,
  Globe,
  Loader2,
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
import { ModelAvatars } from "@/components/ModelAvatars";
import {
  extractPdfTextClient,
  extractTextFileClient,
  isPdfFile,
  isTextLikeFile,
  rasterizePdfToImagesClient,
} from "@/lib/client-extract";

type ModelOption = {
  id: ModelChoice;
  label: string;
  description: string;
  /**
   * When the model is the *primary* in a cross-check pair, this is the
   * verifier model name shown as a "Cross-check with …" subhead in the
   * dropdown — mirrors gpai.app's "Cross-check with [model icons]" badge
   * under GPAI Pro.
   */
  crossCheckPartner?: string;
  group: "primary" | "third-party" | "offline";
};

const modelOptions: ModelOption[] = [
  {
    id: "auto",
    label: "Auto",
    description:
      "Smartest for detailed solutions — high accuracy, advanced visualisations.",
    crossCheckPartner: "Nemotron 49B",
    group: "primary",
  },
  {
    id: "mistral-large",
    label: "Mistral Large 3",
    description: "Fast and efficient for most problems.",
    crossCheckPartner: "Nemotron 49B",
    group: "primary",
  },
  {
    id: "nemotron",
    label: "Nemotron 49B",
    description: "Strong reasoner; high token cap.",
    crossCheckPartner: "Llama 3.3 70B",
    group: "primary",
  },
  {
    id: "deepseek-flash",
    label: "DeepSeek V4 Flash",
    description: "Fast experimental model.",
    crossCheckPartner: "Llama 3.3 70B",
    group: "primary",
  },
  {
    id: "llama",
    label: "Llama 3.3 70B",
    description: "Balanced default — good throughput.",
    crossCheckPartner: "Nemotron 49B",
    group: "primary",
  },
  {
    id: "debate",
    label: "Debate",
    description: "All models answer, a judge picks the best response.",
    group: "primary",
  },
  {
    id: "demo",
    label: "Demo (offline)",
    description: "Deterministic sample output, no API key required.",
    group: "offline",
  },
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
  // Tracks how many file picks are still being parsed so the user sees
  // a spinner instead of staring at a frozen attach button while a
  // multi-MB PDF is being decoded in the browser.
  const [parsingCount, setParsingCount] = useState(0);
  const [pickError, setPickError] = useState<string | null>(null);
  const currentModel = modelOptions.find((m) => m.id === props.modelChoice);

  const onPickFiles = useCallback(
    async (files: FileList | File[] | null) => {
      if (!files) return;
      const list = Array.from(files);
      if (list.length === 0) return;
      setPickError(null);
      setParsingCount((c) => c + list.length);
      const next: UploadedAsset[] = [];
      const errors: string[] = [];
      for (const file of list) {
        try {
          // Images: keep the data URL — the vision model needs the raw
          // bytes server-side. We compress client-side to stay under
          // Vercel's 4.5 MB request limit.
          if (file.type.startsWith("image/")) {
            let payload: { dataUrl: string; size: number; type: string } = {
              dataUrl: await readAsDataUrl(file),
              size: file.size,
              type: file.type,
            };
            try {
              payload = await compressImageIfLarge(file, payload.dataUrl);
            } catch {
              /* fall through with the original dataUrl if anything goes wrong */
            }
            next.push({
              name: file.name,
              type: payload.type,
              size: payload.size,
              dataUrl: payload.dataUrl,
              preview: payload.dataUrl,
            });
            continue;
          }

          // PDFs: extract text in the browser and ship just the text.
          // This keeps multi-MB PDFs (well past Vercel's 4.5 MB body
          // limit) usable inside Solver / Chat / Cheatsheet.
          //
          // If the PDF has no text layer (scanned exam paper, photographed
          // textbook chapter, etc.), rasterize each page to a JPEG and
          // ship those as image attachments so the existing Nemotron
          // vision OCR pipeline can transcribe them.
          if (isPdfFile(file)) {
            const { text } = await extractPdfTextClient(file);
            if (text) {
              next.push({
                name: file.name,
                type: "application/pdf",
                size: file.size,
                extractedText: text,
              });
              continue;
            }

            const { totalPages, pages, truncated } =
              await rasterizePdfToImagesClient(file);
            if (pages.length === 0) {
              errors.push(
                `"${file.name}": couldn't render PDF pages for OCR — try uploading a screenshot of the page you care about.`,
              );
              continue;
            }
            for (const { pageNumber, dataUrl } of pages) {
              next.push({
                name: `${file.name} — page ${pageNumber}/${totalPages}`,
                type: "image/jpeg",
                size: dataUrl.length,
                dataUrl,
                preview: dataUrl,
              });
            }
            if (truncated) {
              setPickError(
                `"${file.name}" is ${totalPages} pages but only the first ${pages.length} were sent for OCR (Vercel request-body limit). Crop to the section you care about and re-upload if you need a later page.`,
              );
            }
            continue;
          }

          // Text-likes (md / json / source code …): same idea — decode
          // client-side and ship plain UTF-8.
          if (isTextLikeFile(file)) {
            const text = await extractTextFileClient(file);
            next.push({
              name: file.name,
              type: file.type || "text/plain",
              size: file.size,
              extractedText: text,
            });
            continue;
          }

          // Unknown file type — last-resort dataUrl path. The user will
          // get a clearer "cannot read this file" error than
          // FUNCTION_PAYLOAD_TOO_LARGE.
          const dataUrl = await readAsDataUrl(file);
          next.push({
            name: file.name,
            type: file.type,
            size: file.size,
            dataUrl,
          });
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "could not read file";
          errors.push(`"${file.name}": ${message}`);
        } finally {
          setParsingCount((c) => Math.max(0, c - 1));
        }
      }
      if (next.length > 0) {
        props.onAttachmentsChange([...props.attachments, ...next]);
      }
      if (errors.length > 0) {
        setPickError(errors.join("; "));
      }
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
      {(props.attachments.length > 0 || parsingCount > 0) && (
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
          {parsingCount > 0 && (
            <div className="attachment-chip is-parsing" aria-live="polite">
              <Loader2 size={14} className="spin" />
              <span className="attachment-name">
                Reading {parsingCount} file{parsingCount === 1 ? "" : "s"}…
              </span>
            </div>
          )}
        </div>
      )}
      {pickError && (
        <p className="composer-pick-error" role="alert">
          {pickError}
        </p>
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
          {props.showCrossCheck &&
            props.crossCheck !== false &&
            currentModel?.crossCheckPartner && (
              <span
                className="model-crosscheck-indicator"
                title={`When you submit, ${currentModel.label} solves the problem and ${currentModel.crossCheckPartner} independently verifies the answer.`}
              >
                <span className="model-crosscheck-indicator-label">
                  Cross-check with
                </span>
                <ModelAvatars
                  primary={currentModel.label}
                  secondary={currentModel.crossCheckPartner}
                  size={16}
                />
              </span>
            )}
          <div className="model-select-wrap">
            <button
              type="button"
              className="model-select-btn"
              onClick={() => setModelOpen((p) => !p)}
              aria-haspopup="menu"
              aria-expanded={modelOpen}
            >
              {currentModel?.label ?? "Auto"}
            </button>
            {modelOpen && (
              <div className="model-select-menu" role="menu">
                {(["primary", "third-party", "offline"] as const).map(
                  (group, groupIdx) => {
                    const groupOptions = modelOptions.filter(
                      (m) => m.group === group,
                    );
                    if (groupOptions.length === 0) return null;
                    const groupLabel: Record<typeof group, string> = {
                      primary: "Forge models",
                      "third-party": "Third-party model",
                      offline: "Offline",
                    };
                    return (
                      <div
                        key={group}
                        className={`model-option-group${
                          groupIdx > 0 ? " has-divider" : ""
                        }`}
                      >
                        <div className="model-option-group-label">
                          {groupLabel[group]}
                        </div>
                        {groupOptions.map((m) => {
                          const isActive = props.modelChoice === m.id;
                          const showCrossCheckSubhead =
                            m.group === "primary" &&
                            m.crossCheckPartner &&
                            props.crossCheck !== false;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              role="menuitemradio"
                              aria-checked={isActive}
                              className={`model-option ${
                                isActive ? "is-active" : ""
                              }`}
                              onClick={() => {
                                props.onModelChange(m.id);
                                setModelOpen(false);
                              }}
                            >
                              <span className="model-option-row">
                                <span className="model-option-label">
                                  {isActive ? "✓ " : ""}
                                  {m.label}
                                </span>
                              </span>
                              <span className="model-option-description">
                                {m.description}
                              </span>
                              {showCrossCheckSubhead && (
                                <span className="model-option-crosscheck">
                                  Cross-check with
                                  <ModelAvatars
                                    primary={m.label}
                                    secondary={m.crossCheckPartner}
                                    size={14}
                                  />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  },
                )}
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
              disabled={
                parsingCount > 0 ||
                (!props.value.trim() && props.attachments.length === 0)
              }
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
