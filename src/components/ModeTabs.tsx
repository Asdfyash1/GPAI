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
import { createPortal } from "react-dom";
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

type MenuPosition = {
  top: number;
  left: number;
};

export function ModeTabs({ active, onChange }: ModeTabsProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // The "More" dropdown is positioned via a fixed-coordinate portal so
  // it escapes the `overflow-x: auto` mode-tabs strip we use on phones.
  // Otherwise the menu would be clipped to a 0px-tall rectangle and the
  // user would tap "More" and see absolutely nothing happen.
  const recomputePosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menuWidth = 240;
    const viewportPadding = 8;
    const maxLeft = Math.max(
      viewportPadding,
      window.innerWidth - menuWidth - viewportPadding,
    );
    const left = Math.min(rect.left, maxLeft);
    setMenuPos({ top: rect.bottom + 6, left });
  };

  useEffect(() => {
    if (!moreOpen) return;
    recomputePosition();
    const onScrollOrResize = () => recomputePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [moreOpen]);

  useEffect(() => {
    if (!moreOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", onKey);
    };
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
      <div className="mode-tab-more-wrap">
        <button
          ref={triggerRef}
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
        {moreOpen && menuPos && typeof document !== "undefined" &&
          createPortal(
            <div
              ref={menuRef}
              className="mode-more-menu"
              role="menu"
              style={{
                position: "fixed",
                top: menuPos.top,
                left: menuPos.left,
              }}
            >
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
            </div>,
            document.body,
          )}
      </div>
    </div>
  );
}
