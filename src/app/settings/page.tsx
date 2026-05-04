"use client";

import { useState } from "react";
import { ArrowLeft, Moon, Sun, Trash2 } from "lucide-react";
import Link from "next/link";

type Theme = "dark" | "light";

const THEME_KEY = "eduforge:theme";
const HISTORY_KEY = "eduforge:history";
const STORE_KEY = "eduforge:responses";
const CHAT_KEY = "eduforge:chats";

function readTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return (localStorage.getItem(THEME_KEY) as Theme | null) ?? "dark";
}

function countKey(key: string, kind: "array" | "object"): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return kind === "array" ? (Array.isArray(parsed) ? parsed.length : 0) : Object.keys(parsed).length;
  } catch { return 0; }
}

export default function SettingsPage() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [historyCount, setHistoryCount] = useState(() => countKey(HISTORY_KEY, "array"));
  const [chatCount, setChatCount] = useState(() => countKey(CHAT_KEY, "object"));

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
    document.documentElement.dataset.theme = next;
  };

  const clearHistory = () => {
    if (!confirm("Clear all saved history and responses? This cannot be undone.")) return;
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(STORE_KEY);
    localStorage.removeItem(CHAT_KEY);
    setHistoryCount(0);
    setChatCount(0);
  };

  return (
    <div className="settings-page" data-theme={theme}>
      <header className="settings-header">
        <Link href="/app" className="settings-back">
          <ArrowLeft size={16} /> Back to app
        </Link>
        <h1 className="settings-title">Settings</h1>
      </header>
      <div className="settings-content">
        <section className="settings-section">
          <h2 className="settings-section-title">Appearance</h2>
          <div className="settings-row">
            <span>Theme</span>
            <button type="button" className="settings-theme-btn" onClick={toggleTheme}>
              {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
              {theme === "dark" ? "Dark" : "Light"}
            </button>
          </div>
        </section>

        <section className="settings-section">
          <h2 className="settings-section-title">Data</h2>
          <div className="settings-row">
            <span>Saved tasks</span>
            <span className="settings-value">{historyCount}</span>
          </div>
          <div className="settings-row">
            <span>Chat sessions</span>
            <span className="settings-value">{chatCount}</span>
          </div>
          <div className="settings-row">
            <span>Clear all local data</span>
            <button type="button" className="settings-danger-btn" onClick={clearHistory}>
              <Trash2 size={14} /> Clear data
            </button>
          </div>
        </section>

        <section className="settings-section">
          <h2 className="settings-section-title">About</h2>
          <div className="settings-row">
            <span>Version</span>
            <span className="settings-value">0.1.0</span>
          </div>
          <div className="settings-row">
            <span>Platform</span>
            <span className="settings-value">Forge STEM Copilot</span>
          </div>
        </section>
      </div>
    </div>
  );
}
