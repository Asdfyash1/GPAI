"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Download, FilePlus2, Folder, FolderPlus, Pencil, Printer, Trash2 } from "lucide-react";
import type { ModelChoice, UploadedAsset } from "@/types/education";
import { Composer } from "@/components/Composer";
import { MathMarkdown } from "@/components/MathMarkdown";
import { useStream } from "@/hooks/useStream";

type NotebookPage = {
  id: string;
  title: string;
  prompt: string;
  content: string;
  createdAt: string;
  folder?: string;
};

const NOTEBOOK_KEY = "eduforge:notebook";

type NotebookViewProps = {
  modelChoice: ModelChoice;
  setModelChoice: (m: ModelChoice) => void;
};

export function NotebookView({ modelChoice, setModelChoice }: NotebookViewProps) {
  const [pages, setPages] = useState<NotebookPage[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [attachments, setAttachments] = useState<UploadedAsset[]>([]);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const stream = useStream();

  const folders = useMemo(() => {
    const set = new Set<string>();
    pages.forEach((p) => { if (p.folder) set.add(p.folder); });
    return Array.from(set).sort();
  }, [pages]);

  const filteredPages = useMemo(() => {
    if (!activeFolder) return pages;
    return pages.filter((p) => p.folder === activeFolder);
  }, [pages, activeFolder]);

  const createFolder = () => {
    const name = window.prompt("Folder name");
    if (!name?.trim()) return;
    setActiveFolder(name.trim());
  };

  const moveToFolder = (pageId: string) => {
    const folderName = window.prompt("Move to folder (leave empty for root)", activeFolder ?? "");
    setPages((prev) =>
      prev.map((p) => (p.id === pageId ? { ...p, folder: folderName?.trim() || undefined } : p)),
    );
  };

  // hydrate
  useEffect(() => {
    if (typeof window === "undefined") return;
    queueMicrotask(() => {
      const raw = localStorage.getItem(NOTEBOOK_KEY);
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as NotebookPage[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPages(parsed);
          setActiveId(parsed[0].id);
        }
      } catch {
        /* ignore */
      }
    });
  }, []);

  // persist
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(NOTEBOOK_KEY, JSON.stringify(pages.slice(0, 50)));
    } catch {
      /* quota */
    }
  }, [pages]);

  const activePage = pages.find((p) => p.id === activeId) ?? null;

  const generate = (override?: string) => {
    const final = (override ?? prompt).trim();
    if (!final) return;
    const id = `nb_${Date.now()}`;
    const page: NotebookPage = {
      id,
      title: final.slice(0, 60),
      prompt: final,
      content: "",
      createdAt: new Date().toISOString(),
      folder: activeFolder ?? undefined,
    };
    setPages((prev) => [page, ...prev].slice(0, 50));
    setActiveId(id);
    setPrompt("");
    stream.start(
      "/api/educate/stream",
      {
        mode: "notebook",
        prompt: final,
        style: "deep-explain",
        audience: "self-study notebook",
        attachments,
        crossCheck: false,
        modelChoice,
      },
      {
        onChunk: (text) =>
          setPages((prev) =>
            prev.map((p) => (p.id === id ? { ...p, content: text } : p)),
          ),
        onFinal: (text) =>
          setPages((prev) =>
            prev.map((p) => (p.id === id ? { ...p, content: text } : p)),
          ),
      },
    );
  };

  const handleNew = () => {
    setActiveId(null);
    setPrompt("");
  };

  const handleDelete = (id: string) => {
    setPages((prev) => prev.filter((p) => p.id !== id));
    if (activeId === id) {
      setActiveId(null);
    }
  };

  const handleRename = (id: string) => {
    const page = pages.find((p) => p.id === id);
    if (!page) return;
    const next = window.prompt("Rename page", page.title);
    if (!next) return;
    setPages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, title: next.slice(0, 80) } : p)),
    );
  };

  const handlePrint = () => {
    if (!activePage?.content) return;
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

  return (
    <div className="notebook-view">
      <aside className="notebook-side">
        <div className="notebook-side-actions">
          <button type="button" className="primary-button" onClick={handleNew}>
            <FilePlus2 size={14} /> New page
          </button>
          <button type="button" className="icon-button" onClick={createFolder} title="New folder" aria-label="New folder">
            <FolderPlus size={14} />
          </button>
        </div>
        {folders.length > 0 && (
          <div className="notebook-folders">
            <button
              type="button"
              className={`notebook-folder-btn ${!activeFolder ? "is-active" : ""}`}
              onClick={() => setActiveFolder(null)}
            >
              All pages
            </button>
            {folders.map((f) => (
              <button
                key={f}
                type="button"
                className={`notebook-folder-btn ${activeFolder === f ? "is-active" : ""}`}
                onClick={() => setActiveFolder(f)}
              >
                <Folder size={12} /> {f}
              </button>
            ))}
          </div>
        )}
        {activeFolder && (
          <div className="notebook-breadcrumb">
            <button type="button" className="notebook-breadcrumb-link" onClick={() => setActiveFolder(null)}>
              All
            </button>
            <ChevronRight size={12} />
            <span>{activeFolder}</span>
          </div>
        )}
        <ul className="notebook-pages">
          {filteredPages.length === 0 ? (
            <li className="notebook-empty">No pages yet</li>
          ) : (
            filteredPages.map((p) => (
              <li
                key={p.id}
                className={`notebook-page-row ${
                  activeId === p.id ? "is-active" : ""
                }`}
              >
                <button
                  type="button"
                  className="notebook-page-title"
                  onClick={() => setActiveId(p.id)}
                  title={p.title}
                >
                  {p.title}
                </button>
                <div className="notebook-row-actions">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Move to folder"
                    onClick={() => moveToFolder(p.id)}
                  >
                    <Folder size={12} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Rename"
                    onClick={() => handleRename(p.id)}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Delete"
                    onClick={() => handleDelete(p.id)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </aside>

      <section className="notebook-main">
        {!activePage ? (
          <div className="solver-view">
            <header className="solver-hero">
              <h1 className="hero-title">Notebook</h1>
              <p className="hero-subtitle">
                Free-form study pages — every entry becomes a saved page you can
                rename, delete, or print.
              </p>
            </header>
            <Composer
              value={prompt}
              onChange={setPrompt}
              onSubmit={() => generate()}
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              modelChoice={modelChoice}
              onModelChange={setModelChoice}
              placeholder="Start a new note…"
            />
          </div>
        ) : (
          <div className="document-view">
            <header className="document-toolbar">
              <h2 className="document-title">{activePage.title}</h2>
              <div className="document-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={handlePrint}
                  disabled={!activePage.content}
                >
                  <Printer size={14} /> Print / PDF
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Download as PDF"
                  title="Download as PDF"
                  disabled={!activePage.content}
                  onClick={handlePrint}
                >
                  <Download size={14} />
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleNew}
                >
                  New
                </button>
              </div>
            </header>
            <article className="document-page">
              <MathMarkdown
                content={activePage.content || "Generating…"}
              />
              {stream.isStreaming &&
                activeId === activePage.id &&
                !activePage.content && (
                  <span className="streaming-cursor" aria-hidden />
                )}
            </article>
            <Composer
              value={prompt}
              onChange={setPrompt}
              onSubmit={() => generate()}
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              modelChoice={modelChoice}
              onModelChange={setModelChoice}
              placeholder="Add another page…"
              compact
            />
          </div>
        )}
      </section>
    </div>
  );
}

