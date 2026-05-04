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
import { AuthModal, type AuthedUser } from "@/components/AuthModal";
import { MigrationPrompt } from "@/components/MigrationPrompt";
import { useSync } from "@/hooks/useSync";
import { buildSnapshot, isEmptySnapshot, parseSnapshot, type SyncSnapshot } from "@/lib/sync";

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
  const [user, setUser] = useState<{ email: string; emailHash: string } | null>(null);
  // Sync lifecycle gate. We don't auto-save until we've either loaded
  // the remote snapshot for the user OR resolved the migration prompt,
  // so we never overwrite real cloud data with stale local state.
  const [syncReady, setSyncReady] = useState(false);
  const [migrationOpen, setMigrationOpen] = useState(false);
  // Sentinel surfaced via aria-live for non-modal users ("Saved" /
  // "Saving…" / "Couldn't sync"). We only render it when a user is
  // signed in so logged-out users don't see noise.
  // Sync status tracked internally — intentionally NOT surfaced in the
  // UI so users never see Telegram storage details. The setter is still
  // called by useSync, logout, and migration handlers.
  const [, setSyncStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
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
  // Mirrors `history` so async callbacks (hydrateFromCloud) that run
  // long after mount always see the current array length, not the
  // stale [] captured in the mount-time closure.
  const historyRef = useRef<SidebarItem[]>([]);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);
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
      if (nextHistory) {
        historyRef.current = nextHistory;
        setHistory(nextHistory);
      }
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

  // Pull the user's saved snapshot from Telegram and decide whether to
  // overwrite local state, prompt for migration, or quietly enable
  // auto-save with what's already on the device.
  //
  //  - Cloud has data → cloud wins (replace local). Auto-save enabled.
  //  - Cloud is empty + local has data → prompt before pushing local up
  //    so we never silently transfer the user's local notes onto a
  //    different account they just signed into. Auto-save stays paused
  //    until they choose.
  //  - Cloud is empty + local is empty → nothing to do, enable saves.
  //
  // `allowMigrationPrompt` lets the cold-start path (already-logged-in
  // page reload) suppress the prompt if the user previously discarded
  // it: in practice we always pass `true` and rely on the cloud-vs-local
  // comparison to decide.
  //
  // Defined ABOVE the auth-mount useEffect so the lexical forward-
  // reference lint check is happy without any ref dance. JS scoping
  // means the closure still picks up the latest state on each render.
  function hydrateFromCloud({
    allowMigrationPrompt,
  }: {
    allowMigrationPrompt: boolean;
  }): Promise<void> {
    return (async () => {
      setSyncReady(false);
      setSyncStatus("idle");
      try {
        const res = await fetch("/api/sync/load");
        if (!res.ok) {
          // Don't strand the user offline — keep local state, allow
          // saves to retry. Worst case the next online save wins.
          setSyncReady(true);
          return;
        }
        const json = (await res.json()) as { data?: unknown };
        const remote = parseSnapshot(json.data);
        if (!isEmptySnapshot(remote)) {
          // Cloud canonical — replace local working set.
          setHistory(remote!.history);
          setResponseStore(remote!.responses);
          setChatSessions(remote!.chats);
          if (remote!.settings.theme === "dark" || remote!.settings.theme === "light") {
            setTheme(remote!.settings.theme);
          }
          setActiveItem(undefined);
          setSolverResult(null);
          setSolverPrompt("");
          activeChatIdRef.current = null;
          setActiveChatId(null);
          setSyncReady(true);
          return;
        }
        // Cloud empty: do we have local data worth importing?
        // Read from the ref — NOT the `history` state var — because
        // this function may execute from a stale mount-time closure
        // where `history` is still the initial `[]`. The ref is kept
        // in sync via a useEffect so it always reflects the latest
        // localStorage-hydrated value.
        const localCount = historyRef.current.length;
        if (allowMigrationPrompt && localCount > 0) {
          setMigrationOpen(true);
          // Stay un-ready so auto-save doesn't fire until the user picks.
          return;
        }
        // Local empty too — nothing to migrate, just turn on saves.
        setSyncReady(true);
      } catch {
        // Network error: keep local state, leave saves paused so we
        // don't push potentially-empty state up. The next user-initiated
        // change after they come back online will trigger another save.
        setSyncReady(true);
      }
    })();
  }

  // Check for existing auth session on mount, and honor `?auth=open`
  // (landing page "Sign in" CTAs route here with that flag so the modal
  // pops automatically). Only auto-open when there is no live session.
  // The /api/auth/me endpoint also slides the cookie forward (issues a
  // fresh 7-day token if the current one is older than 6 days) so an
  // active session never lapses at the boundary.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => r.json() as Promise<{ user: { email: string; emailHash: string } | null }>)
      .then((d) => {
        if (cancelled) return;
        if (d.user?.emailHash) {
          setUser({ email: d.user.email, emailHash: d.user.emailHash });
          // Existing session — hydrate from cloud immediately. We treat
          // this the same as a fresh login: trust the cloud as canonical
          // when it has data; otherwise leave local state intact.
          void hydrateFromCloud({ allowMigrationPrompt: true });
          return;
        }
        if (typeof window === "undefined") return;
        const params = new URLSearchParams(window.location.search);
        if (params.get("auth") === "open") {
          setAuthOpen(true);
          // Clean the query so a refresh doesn't keep re-opening it.
          params.delete("auth");
          const qs = params.toString();
          const next = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
          window.history.replaceState(null, "", next);
        }
      })
      .catch(() => { /* not logged in; modal stays closed unless user clicks Sign in */ });
    return () => {
      cancelled = true;
    };
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

  // Build the cloud snapshot from current state. Memoised on shape so
  // that scrolling / hover / mode-tab clicks don't churn the value
  // (and the useSync debounce stays stable).
  const cloudSnapshot: SyncSnapshot = useMemo(
    () =>
      buildSnapshot({
        history,
        responses: responseStore,
        chats: chatSessions,
        theme,
      }),
    [history, responseStore, chatSessions, theme],
  );

  useSync({
    enabled: !!user && syncReady,
    snapshot: cloudSnapshot,
    onStatusChange: (next) => setSyncStatus(next),
  });

  // Flush unsaved state to the server when the tab is closing so the
  // last few seconds of edits (inside the 5s debounce window) aren't
  // lost. `navigator.sendBeacon` fires a non-blocking POST that
  // survives page unload — ideal for this "best-effort last save".
  const snapshotRef = useRef(cloudSnapshot);
  useEffect(() => { snapshotRef.current = cloudSnapshot; }, [cloudSnapshot]);
  useEffect(() => {
    if (!user || !syncReady) return;
    const flush = () => {
      const payload = JSON.stringify({ data: snapshotRef.current });
      navigator.sendBeacon("/api/sync/save", new Blob([payload], { type: "application/json" }));
    };
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [user, syncReady]);

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
                    setSyncReady(false);
                    setSyncStatus("idle");
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
        onAuth={(u: AuthedUser) => {
          setUser({ email: u.email, emailHash: u.emailHash });
          // After login: pull the user's snapshot. The same call also
          // raises the migration prompt if the cloud is empty and we
          // already have local history.
          void hydrateFromCloud({ allowMigrationPrompt: true });
        }}
      />
      <MigrationPrompt
        open={migrationOpen}
        localCount={history.length}
        onImport={async () => {
          // Push the current local state to the cloud now (don't wait
          // for the 5s debounce) so the user gets immediate confirmation
          // and a refresh would already see their data on the cloud.
          const snapshot = buildSnapshot({
            history,
            responses: responseStore,
            chats: chatSessions,
            theme,
          });
          try {
            const res = await fetch("/api/sync/save", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ data: snapshot }),
            });
            if (!res.ok) throw new Error(`save failed: ${res.status}`);
            setSyncStatus("saved");
          } catch {
            setSyncStatus("error");
            // Don't block the user — close the modal anyway and let the
            // background auto-save retry. They'll see the "Couldn't sync"
            // status indicator in the topbar.
          }
          setMigrationOpen(false);
          setSyncReady(true);
        }}
        onDiscard={() => {
          // User chose to start fresh on this account. Clear local state
          // BEFORE flipping syncReady so the auto-save doesn't push the
          // about-to-be-deleted local data up to the cloud.
          setHistory([]);
          setResponseStore({});
          setChatSessions({});
          setActiveItem(undefined);
          setSolverResult(null);
          setSolverPrompt("");
          activeChatIdRef.current = null;
          setActiveChatId(null);
          if (typeof window !== "undefined") {
            localStorage.removeItem(HISTORY_KEY);
            localStorage.removeItem(STORE_KEY);
            localStorage.removeItem(CHAT_STORE_KEY);
          }
          setMigrationOpen(false);
          setSyncReady(true);
        }}
      />
    </div>
  );
}
