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

type Theme = "dark" | "light";

const HISTORY_KEY = "eduforge:history";
const THEME_KEY = "eduforge:theme";

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

  // Initial theme + history load (defer to next tick so React rule allows it)
  useEffect(() => {
    if (typeof window === "undefined") return;
    queueMicrotask(() => {
      const savedTheme = localStorage.getItem(THEME_KEY) as Theme | null;
      if (savedTheme === "dark" || savedTheme === "light") setTheme(savedTheme);
      const savedHistory = localStorage.getItem(HISTORY_KEY);
      if (!savedHistory) return;
      try {
        setHistory(JSON.parse(savedHistory) as SidebarItem[]);
      } catch {
        /* ignore */
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

  const onAddHistory = (response: EducationResponse) => {
    const item: SidebarItem = {
      id: response.id,
      title: response.title || response.prompt.slice(0, 60),
      mode: response.mode,
    };
    setHistory((prev) => [item, ...prev.filter((p) => p.id !== item.id)].slice(0, 25));
    setActiveItem(item.id);
  };

  const handleNewTask = () => {
    setSolverPrompt("");
    setSolverResult(null);
    setActiveItem(undefined);
    setAttachments([]);
  };

  const handleSelectItem = (item: SidebarItem) => {
    setMode(item.mode);
    setActiveItem(item.id);
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
        credits={50}
        creditsMax={50}
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
            <DocumentView
              mode="pdf-notes"
              modelChoice={modelChoice}
              setModelChoice={setModelChoice}
              title="Turn anything into structured notes"
              subtitle="Upload a PDF or describe a topic — get takeaways, definitions, formulas, and likely exam questions."
              placeholder="Upload PDF or enter topic"
              quickPrompts={[
                "Make notes from organic chemistry alkanes chapter",
                "Summarize Newton's laws with key equations",
                "Make exam-prep notes on photosynthesis",
              ]}
            />
          )}
          {mode === "notebook" && (
            <DocumentView
              mode="notebook"
              modelChoice={modelChoice}
              setModelChoice={setModelChoice}
              title="Open a free-form study notebook"
              subtitle="Drop ideas, derivations, and questions into a single workspace."
              placeholder="Start a notebook entry"
              quickPrompts={[
                "Workspace on integration techniques",
                "Workspace on DC circuit analysis",
                "Workspace on linear algebra fundamentals",
              ]}
            />
          )}
        </div>
      </main>
    </div>
  );
}
