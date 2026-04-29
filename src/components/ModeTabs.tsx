"use client";

import {
  ChevronDown,
  Hash,
  Image as ImageIcon,
  MessageSquare,
  Notebook,
  PenLine,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FeatureMode } from "@/types/education";

export type ModeMeta = {
  id: FeatureMode;
  label: string;
  icon: typeof Hash;
  visibility: "primary" | "more";
};

export const MODES: ModeMeta[] = [
  { id: "solver", label: "AI Solver", icon: Hash, visibility: "primary" },
  { id: "visualizer", label: "AI Visualizer", icon: Wand2, visibility: "primary" },
  { id: "chat", label: "AI Chat", icon: MessageSquare, visibility: "primary" },
  { id: "report", label: "AI Report Writer", icon: PenLine, visibility: "more" },
  { id: "pdf-notes", label: "AI PDF Notes", icon: Sparkles, visibility: "more" },
  { id: "cheatsheet", label: "AI Cheatsheet Builder", icon: ImageIcon, visibility: "more" },
  { id: "notebook", label: "AI Notebook", icon: Notebook, visibility: "more" },
];

type ModeTabsProps = {
  active: FeatureMode;
  onChange: (mode: FeatureMode) => void;
};

export function ModeTabs({ active, onChange }: ModeTabsProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const handler = (e: MouseEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [moreOpen]);

  const primary = MODES.filter((m) => m.visibility === "primary");
  const more = MODES.filter((m) => m.visibility === "more");
  const activeMeta = MODES.find((m) => m.id === active);
  const activeInMore = activeMeta?.visibility === "more";

  return (
    <div className="mode-tabs" role="tablist">
      {primary.map((m) => {
        const Icon = m.icon;
        return (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={active === m.id}
            className={`mode-tab ${active === m.id ? "is-active" : ""}`}
            onClick={() => onChange(m.id)}
          >
            <Icon size={14} />
            <span>{m.label}</span>
          </button>
        );
      })}
      <div className="mode-tab-more-wrap" ref={moreRef}>
        <button
          type="button"
          className={`mode-tab mode-tab-more ${activeInMore ? "is-active" : ""}`}
          aria-haspopup="menu"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((p) => !p)}
        >
          {activeInMore ? (
            <>
              <activeMeta.icon size={14} />
              <span>{activeMeta.label}</span>
            </>
          ) : (
            <span>More</span>
          )}
          <ChevronDown size={14} />
        </button>
        {moreOpen && (
          <div className="mode-more-menu" role="menu">
            {more.map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="menuitem"
                  className={`mode-more-item ${active === m.id ? "is-active" : ""}`}
                  onClick={() => {
                    onChange(m.id);
                    setMoreOpen(false);
                  }}
                >
                  <Icon size={16} />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
