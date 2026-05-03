"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LogIn, LogOut, Menu, Moon, Sun, User } from "lucide-react";
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
import { SettingsModal } from "@/components/SettingsModal";
import { OnboardingTour } from "@/components/OnboardingTour";
import { AuthModal } from "@/components/AuthModal";

type Theme = "dark" | "light";

const HISTORY_KEY = "eduforge:history";
const THEME_KEY = "eduforge:theme";
const STORE_KEY = "eduforge:responses";
const CHAT_STORE_KEY = "eduforge:chats";

export function EducationApp() {
  const [mode, setMode] = useState<FeatureMode>("solver");
  const [theme, setTheme] = useState<Theme>("dark");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Mobile (<= 720px) drawer state — separate from the desktop
  // "collapsed-to-rail" state above. We default to closed so first
  // paint doesn't flash a full-screen sidebar over the workspace.
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [modelChoice, setModelChoice] = useState<ModelChoice>("auto");
  const [attachments, setAttachments] = useState<UploadedAsset[]>([]);
  const [solverPrompt, setSolverPrompt] = useState("");
  const [solverResult, setSolverResult] = useState<EducationResponse | null>(null);
  const [history, setHistory] = useState<SidebarItem[]>([]);
  const [activeItem, setActiveItem] = useState<string | undefined>();
  const [responseStore, setResponseStore] = useState<Record<string, EducationResponse>>({});
  const [chatSessions, setChatSessions] = useState<Record<string, ChatSession>>({});
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  // Mirrors `activeChatId` so that handlers invoked rapidly back-to-back
  // (e.g. user message + streamed assistant message) see the freshly minted
  // id even before React commits the setState. Without this, every
  // streamed reply would mint a new chat session and create a duplicate
  // sidebar entry.
  const activeChatIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);
  const [visualizerSeed, setVisualizerSeed] = useState<string>("");
  // Persist-after-hydrate guard: until the initial localStorage load runs
  // we MUST NOT write empty state back to disk, otherwise reloading the
  // page wipes the user's history before it can be read.
  const hydrated = useRef(false);

  // Initial localStorage hydrate. We mark `hydrated.current = true` BEFORE
  // calling setState so the persist-after-hydrate effects below see the
  // flag and don't overwrite the freshly-loaded values with the default
  // empty state. Deferred to a microtask so React allows the setState.
  useEffect(() => {
    if (typeof window === "undefined") return;
    queueMicrotask(() => {
      const savedTheme = localStorage.getItem(THEME_KEY) as Theme | null;
      let nextHistory: SidebarItem[] | null = null;
      let nextStore: Record<string, EducationResponse> | null = null;
      let nextChats: Record<string, ChatSession> | null = null;
      const rawHistory = localStorage.getItem(HISTORY_KEY);
      if (rawHistory) {
        try {
          nextHistory = JSON.parse(rawHistory) as SidebarItem[];
        } catch {
          /* ignore */
        }
      }
      const rawStore = localStorage.getItem(STORE_KEY);
      if (rawStore) {
        try {
          nextStore = JSON.parse(rawStore) as Record<string, EducationResponse>;
        } catch {
          /* ignore */
        }
      }
      const rawChats = localStorage.getItem(CHAT_STORE_KEY);
      if (rawChats) {
        try {
          nextChats = JSON.parse(rawChats) as Record<string, ChatSession>;
        } catch {
          /* ignore */
        }
      }
      hydrated.current = true;
      if (savedTheme === "dark" || savedTheme === "light") setTheme(savedTheme);
      if (nextHistory) setHistory(nextHistory);
      if (nextStore) setResponseStore(nextStore);
      if (nextChats) setChatSessions(nextChats);

      // Honor a shared `?taskId=…` link: open the matching solve / chat.
      const taskId = new URLSearchParams(window.location.search).get("taskId");
      if (taskId) {
        const stored = nextStore?.[taskId];
        if (stored) {
          setMode(stored.mode);
          setActiveItem(taskId);
          setSolverResult(stored);
          setSolverPrompt(stored.prompt);
        } else if (nextChats?.[taskId]) {
          setMode("chat");
          setActiveItem(taskId);
          activeChatIdRef.current = taskId;
          setActiveChatId(taskId);
        }
      }
    });
  }, []);

  // Check for existing auth session on mount
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json() as Promise<{ user: { email: string } | null }>)
      .then((d) => { if (d.user) setUser(d.user); })
      .catch(() => { /* not logged in */ });
  }, []);

  // Lock background scroll while the off-canvas drawer is open so the
  // page underneath doesn't scroll under the user's finger when they
  // try to scroll the drawer itself. Mirrors the modal-overlay
  // behaviour native iOS / Android sheet presentations have. Only
  // matters on phones — the drawer is desktop-hidden via CSS, but the
  // body class is harmless there.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (mobileSidebarOpen) {
      document.body.dataset.mobileDrawer = "open";
    } else {
      delete document.body.dataset.mobileDrawer;
    }
    return () => {
      delete document.body.dataset.mobileDrawer;
    };
  }, [mobileSidebarOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // Keyboard shortcuts: Ctrl+K → cycle mode, Ctrl+/ → toggle settings
  useEffect(() => {
    const MODES: FeatureMode[] = [
      "solver",
      "chat",
      "cheatsheet",
      "visualizer",
      "report",
      "pdf-notes",
      "notebook",
    ];
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "k") {
          e.preventDefault();
          setMode((cur) => {
            const idx = MODES.indexOf(cur);
            return MODES[(idx + 1) % MODES.length];
          });
        } else if (e.key === "/") {
          e.preventDefault();
          setSettingsOpen((o) => !o);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !hydrated.current) return;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 25)));
  }, [history]);

  useEffect(() => {
    if (typeof window === "undefined" || !hydrated.current) return;
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
    if (typeof window === "undefined" || !hydrated.current) return;
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
    let id = activeChatIdRef.current ?? activeChatId;
    if (!id) {
      id = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      activeChatIdRef.current = id;
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
    activeChatIdRef.current = null;
    setActiveChatId(null);
    // Close the mobile drawer once a navigation occurs — matches every
    // other mobile-app drawer pattern (gpai.app, GitHub, Slack…).
    setMobileSidebarOpen(false);
  };

  const handleSelectItem = (item: SidebarItem) => {
    setMode(item.mode);
    setActiveItem(item.id);
    setMobileSidebarOpen(false);
    if (item.mode === "chat") {
      activeChatIdRef.current = item.id;
      setActiveChatId(item.id);
      setSolverResult(null);
      return;
    }
    activeChatIdRef.current = null;
    setActiveChatId(null);
    const stored = responseStore[item.id];
    if (stored && stored.mode === "solver") {
      setSolverResult(stored);
      setSolverPrompt(stored.prompt);
    } else {
      setSolverResult(null);
    }
  };

  const handleRenameItem = (item: SidebarItem, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed || trimmed === item.title) return;
    setHistory((prev) =>
      prev.map((h) => (h.id === item.id ? { ...h, title: trimmed } : h)),
    );
    // Mirror the rename into the persistent stores so a reload reads
    // the new title from the same source `onAddHistory` / chat-mode
    // flows would.
    if (item.mode === "chat") {
      setChatSessions((prev) => {
        const session = prev[item.id];
        if (!session) return prev;
        return { ...prev, [item.id]: { ...session, title: trimmed } };
      });
    } else {
      setResponseStore((prev) => {
        const stored = prev[item.id];
        if (!stored) return prev;
        return { ...prev, [item.id]: { ...stored, title: trimmed } };
      });
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
      if (activeChatId === item.id) {
        activeChatIdRef.current = null;
        setActiveChatId(null);
      }
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
        mobileOpen={mobileSidebarOpen}
        activeMode={mode}
        onModeChange={(next) => {
          setMode(next);
          handleNewTask();
        }}
        items={history}
        activeItemId={activeItem}
        onSelect={handleSelectItem}
        onDelete={handleDeleteItem}
        onRename={handleRenameItem}
        onNewTask={handleNewTask}
        onOpenSettings={() => setSettingsOpen(true)}
        userLabel="hiyash04+asd1"
      />
      {mobileSidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close sidebar"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onThemeChange={setTheme}
      />
      <main className="workspace">
        <header className="workspace-topbar">
          <button
            type="button"
            className="workspace-menu-button"
            aria-label="Open sidebar"
            aria-expanded={mobileSidebarOpen}
            onClick={() => setMobileSidebarOpen(true)}
          >
            <Menu size={18} />
          </button>
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
            {user ? (
              <div className="user-menu">
                <span className="user-avatar">
                  <User size={14} />
                </span>
                <span className="user-email">{user.email}</span>
                <button
                  type="button"
                  className="icon-button"
                  onClick={async () => {
                    await fetch("/api/auth/logout", { method: "POST" });
                    setUser(null);
                  }}
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="sign-in-btn"
                onClick={() => setAuthOpen(true)}
              >
                <LogIn size={14} />
                <span>Sign in</span>
              </button>
            )}
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
      <OnboardingTour />
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuth={(u) => setUser(u)}
      />
    </div>
  );
}
