"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import type {
  EducationResponse,
  FeatureMode,
  ModelChoice,
  UploadedAsset,
} from "@/types/education";
import { Sidebar, type SidebarItem } from "@/components/Sidebar";
import { ModeTabs } from "@/components/ModeTabs";
import { SolverView } from "@/components/SolverView";
import { ChatView } from "@/components/ChatView";
import { CheatsheetView } from "@/components/CheatsheetView";
import { VisualizerView } from "@/components/VisualizerView";
import { DocumentView } from "@/components/DocumentView";
import { NotebookView } from "@/components/NotebookView";
import { PdfNotesView } from "@/components/PdfNotesView";

type Theme = "dark" | "light";

const HISTORY_KEY = "eduforge:history";
const THEME_KEY = "eduforge:theme";
const STORE_KEY = "eduforge:responses";

export function EducationApp() {
  const [mode, setMode] = useState<FeatureMode>("solver");
  const [theme, setTheme] = useState<Theme>("dark");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [modelChoice, setModelChoice] = useState<ModelChoice>("auto");
  const [attachments, setAttachments] = useState<UploadedAsset[]>([]);
  const [solverPrompt, setSolverPrompt] = useState("");
  const [solverResult, setSolverResult] = useState<EducationResponse | null>(null);
  const [history, setHistory] = useState<SidebarItem[]>([]);
  const [activeItem, setActiveItem] = useState<string | undefined>();
  const [responseStore, setResponseStore] = useState<Record<string, EducationResponse>>({});
  const [visualizerSeed, setVisualizerSeed] = useState<string>("");

  // Initial theme + history load (defer to next tick so React rule allows it)
  useEffect(() => {
    if (typeof window === "undefined") return;
    queueMicrotask(() => {
      const savedTheme = localStorage.getItem(THEME_KEY) as Theme | null;
      if (savedTheme === "dark" || savedTheme === "light") setTheme(savedTheme);
      const savedHistory = localStorage.getItem(HISTORY_KEY);
      if (savedHistory) {
        try {
          setHistory(JSON.parse(savedHistory) as SidebarItem[]);
        } catch {
          /* ignore */
        }
      }
      const savedStore = localStorage.getItem(STORE_KEY);
      if (savedStore) {
        try {
          setResponseStore(JSON.parse(savedStore) as Record<string, EducationResponse>);
        } catch {
          /* ignore */
        }
      }
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 25)));
  }, [history]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const ids = new Set(history.map((h) => h.id));
      const trimmed: Record<string, EducationResponse> = {};
      for (const id of ids) {
        if (responseStore[id]) trimmed[id] = responseStore[id];
      }
      localStorage.setItem(STORE_KEY, JSON.stringify(trimmed));
    } catch {
      /* quota exceeded etc — best-effort persist */
    }
  }, [responseStore, history]);

  const onAddHistory = (response: EducationResponse) => {
    const item: SidebarItem = {
      id: response.id,
      title: response.title || response.prompt.slice(0, 60),
      mode: response.mode,
    };
    setHistory((prev) => [item, ...prev.filter((p) => p.id !== item.id)].slice(0, 25));
    setActiveItem(item.id);
    setResponseStore((prev) => ({ ...prev, [response.id]: response }));
  };

  const handleNewTask = () => {
    setSolverPrompt("");
    setSolverResult(null);
    setActiveItem(undefined);
    setAttachments([]);
    setVisualizerSeed("");
  };

  const handleSelectItem = (item: SidebarItem) => {
    setMode(item.mode);
    setActiveItem(item.id);
    const stored = responseStore[item.id];
    if (stored && stored.mode === "solver") {
      setSolverResult(stored);
      setSolverPrompt(stored.prompt);
    } else {
      setSolverResult(null);
    }
  };

  const handleJumpToVisualizer = (prompt: string) => {
    setVisualizerSeed(prompt);
    setMode("visualizer");
  };

  return (
    <div className={`app-shell theme-${theme}`}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((p) => !p)}
        items={history}
        activeItemId={activeItem}
        onSelect={handleSelectItem}
        onNewTask={handleNewTask}
        userLabel="hiyash04+asd1"
      />
      <main className="workspace">
        <header className="workspace-topbar">
          <ModeTabs active={mode} onChange={(m) => {
            setMode(m);
            handleNewTask();
          }} />
          <div className="workspace-topbar-right">
            <button
              type="button"
              className="theme-toggle"
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              aria-label="Toggle theme"
              title={`Theme: ${theme}`}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>

        <div className="workspace-body" data-active-mode={mode}>
          {mode === "solver" && (
            <SolverView
              modelChoice={modelChoice}
              setModelChoice={setModelChoice}
              attachments={attachments}
              setAttachments={setAttachments}
              prompt={solverPrompt}
              setPrompt={setSolverPrompt}
              result={solverResult}
              setResult={setSolverResult}
              onAddHistory={onAddHistory}
              onVisualize={handleJumpToVisualizer}
            />
          )}
          {mode === "chat" && (
            <ChatView
              modelChoice={modelChoice}
              setModelChoice={setModelChoice}
            />
          )}
          {mode === "cheatsheet" && (
            <CheatsheetView
              modelChoice={modelChoice}
              setModelChoice={setModelChoice}
            />
          )}
          {mode === "visualizer" && (
            <VisualizerView
              modelChoice={modelChoice}
              setModelChoice={setModelChoice}
              seedPrompt={visualizerSeed}
              clearSeed={() => setVisualizerSeed("")}
            />
          )}
          {mode === "report" && (
            <DocumentView
              mode="report"
              modelChoice={modelChoice}
              setModelChoice={setModelChoice}
              title="Write a polished research report"
              subtitle="Abstract → introduction → background → methods → results → conclusion → references."
              placeholder="Enter your topic"
              quickPrompts={[
                "Impact of CRISPR-Cas9 on gene therapy",
                "Quantum computing advantages over classical",
                "Climate change and renewable energy",
              ]}
            />
          )}
          {mode === "pdf-notes" && (
            <PdfNotesView
              modelChoice={modelChoice}
              setModelChoice={setModelChoice}
            />
          )}
          {mode === "notebook" && (
            <NotebookView
              modelChoice={modelChoice}
              setModelChoice={setModelChoice}
            />
          )}
        </div>
      </main>
    </div>
  );
}
