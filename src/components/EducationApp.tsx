"use client";

import { useEffect, useMemo, useState } from "react";
import { Moon, Sun } from "lucide-react";
import type {
  ChatMessage,
  ChatSession,
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
const CHAT_STORE_KEY = "eduforge:chats";

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
  const [chatSessions, setChatSessions] = useState<Record<string, ChatSession>>({});
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
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
      const savedChats = localStorage.getItem(CHAT_STORE_KEY);
      if (savedChats) {
        try {
          setChatSessions(JSON.parse(savedChats) as Record<string, ChatSession>);
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
      /* quota exceeded etc \u2014 best-effort persist */
    }
  }, [responseStore, history]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const ids = new Set(history.filter((h) => h.mode === "chat").map((h) => h.id));
      const trimmed: Record<string, ChatSession> = {};
      for (const id of ids) {
        if (chatSessions[id]) trimmed[id] = chatSessions[id];
      }
      localStorage.setItem(CHAT_STORE_KEY, JSON.stringify(trimmed));
    } catch {
      /* quota exceeded etc */
    }
  }, [chatSessions, history]);

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

  const activeChatMessages: ChatMessage[] = useMemo(() => {
    if (!activeChatId) return [];
    return chatSessions[activeChatId]?.messages ?? [];
  }, [activeChatId, chatSessions]);

  const handleChatMessagesChange = (next: ChatMessage[]) => {
    if (next.length === 0) {
      // reset \u2014 don\u2019t persist an empty session
      return;
    }
    let id = activeChatId;
    if (!id) {
      id = `chat_${Date.now()}`;
      setActiveChatId(id);
    }
    const firstUser = next.find((m) => m.role === "user");
    const title =
      firstUser?.content?.trim().slice(0, 60) || "New chat";
    const now = new Date().toISOString();
    setChatSessions((prev) => ({
      ...prev,
      [id!]: {
        id: id!,
        title,
        messages: next,
        createdAt: prev[id!]?.createdAt ?? now,
        updatedAt: now,
      },
    }));
    setHistory((prev) => {
      const item: SidebarItem = { id: id!, title, mode: "chat" };
      return [item, ...prev.filter((p) => p.id !== id)].slice(0, 25);
    });
    setActiveItem(id!);
  };

  const handleNewTask = () => {
    setSolverPrompt("");
    setSolverResult(null);
    setActiveItem(undefined);
    setAttachments([]);
    setVisualizerSeed("");
    setActiveChatId(null);
  };

  const handleSelectItem = (item: SidebarItem) => {
    setMode(item.mode);
    setActiveItem(item.id);
    if (item.mode === "chat") {
      setActiveChatId(item.id);
      setSolverResult(null);
      return;
    }
    setActiveChatId(null);
    const stored = responseStore[item.id];
    if (stored && stored.mode === "solver") {
      setSolverResult(stored);
      setSolverPrompt(stored.prompt);
    } else {
      setSolverResult(null);
    }
  };

  const handleDeleteItem = (item: SidebarItem) => {
    setHistory((prev) => prev.filter((h) => h.id !== item.id));
    if (item.mode === "chat") {
      setChatSessions((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      if (activeChatId === item.id) setActiveChatId(null);
    } else {
      setResponseStore((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      if (activeItem === item.id) {
        setActiveItem(undefined);
        setSolverResult(null);
      }
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
        onDelete={handleDeleteItem}
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
              key={activeChatId ?? "new-chat"}
              modelChoice={modelChoice}
              setModelChoice={setModelChoice}
              messages={activeChatMessages}
              onMessagesChange={handleChatMessagesChange}
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
