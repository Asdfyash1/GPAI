"use client";

import {
  Plus,
  PanelLeftClose,
  PanelLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Settings,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FeatureMode } from "@/types/education";
import { MODES } from "@/components/ModeTabs";

export type SidebarItem = {
  id: string;
  title: string;
  mode: FeatureMode;
  preview?: string;
};

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
  /**
   * Mobile-only drawer state. On viewports ≤ 720px the sidebar is
   * positioned `fixed` and translated off-screen unless this is `true`.
   * Independent of `collapsed`, which controls the desktop "rail-only"
   * mode.
   */
  mobileOpen?: boolean;
  /**
   * Currently active feature mode. Used to highlight the corresponding
   * row in the mobile-only feature list inside the drawer.
   */
  activeMode?: FeatureMode;
  /**
   * Switch the active feature mode (Solver, Visualizer, AI Chat, …).
   * The drawer surfaces every mode so phone users still have a path to
   * the long-tail features (Report, PDF Notes, Cheatsheet, Notebook)
   * even if the topbar's overflow `More` menu is unreachable.
   */
  onModeChange?: (mode: FeatureMode) => void;
  items: SidebarItem[];
  activeItemId?: string;
  onSelect: (item: SidebarItem) => void;
  onDelete?: (item: SidebarItem) => void;
  /**
   * Inline-rename a recent item. The Sidebar handles the editable
   * `<input>` itself (open / commit / cancel) and only calls this
   * with the trimmed final title once the user confirms; the host
   * just persists the change. If absent, the rename affordance is
   * hidden entirely.
   */
  onRename?: (item: SidebarItem, newTitle: string) => void;
  onNewTask: () => void;
  onOpenSettings?: () => void;
  userLabel?: string;
};

export function Sidebar({
  collapsed,
  onToggle,
  mobileOpen = false,
  activeMode,
  onModeChange,
  items,
  activeItemId,
  onSelect,
  onDelete,
  onRename,
  onNewTask,
  onOpenSettings,
  userLabel = "Guest",
}: SidebarProps) {
  // ID of the recent item currently in inline-edit mode (one at a
  // time). When non-null the row swaps out the title `<button>` for
  // an `<input>`. We mirror the input value into local state so the
  // user can cancel without mutating `items`.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Auto-focus + select-all when entering edit mode so the user can
  // immediately overtype or move the caret.
  useEffect(() => {
    if (!editingId) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [editingId]);

  const startRename = (item: SidebarItem) => {
    setEditingId(item.id);
    setDraftTitle(item.title);
  };

  const commitRename = (item: SidebarItem) => {
    const next = draftTitle.trim();
    setEditingId(null);
    setDraftTitle("");
    if (!onRename) return;
    if (!next || next === item.title) return; // no-op
    onRename(item, next);
  };

  const cancelRename = () => {
    setEditingId(null);
    setDraftTitle("");
  };
  return (
    <aside
      className={`sidebar ${collapsed ? "is-collapsed" : ""} ${
        mobileOpen ? "is-mobile-open" : ""
      }`}
    >
      <div className="sidebar-top">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <rect width="24" height="24" rx="6" fill="var(--accent)" />
              <path
                d="M7 12.5l3 3 7-7"
                stroke="white"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          {!collapsed && <span className="brand-name">Forge</span>}
        </div>
        <button
          className="icon-button sidebar-toggle"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          type="button"
        >
          {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      <button className="new-task-btn" type="button" onClick={onNewTask}>
        <Plus size={14} />
        {!collapsed && <span>New task</span>}
      </button>

      {!collapsed && onModeChange && (
        <nav className="sidebar-modes" aria-label="Workspaces">
          {MODES.map((m) => {
            const Icon = m.icon;
            const isActive = activeMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                className={`sidebar-mode-row ${isActive ? "is-active" : ""}`}
                onClick={() => onModeChange(m.id)}
              >
                <Icon size={14} />
                <span>{m.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {!collapsed && (
        <div className="recent-section">
          <div className="recent-header">
            <span>Recent</span>
            <button className="link-button" type="button">
              See all <ChevronRight size={12} />
            </button>
          </div>
          {items.length === 0 ? (
            <p className="recent-empty">
              No items yet — solve a problem to see it here.
            </p>
          ) : (
            <ul className="recent-list">
              {items.map((item) => {
                const isEditing = editingId === item.id;
                return (
                  <li key={item.id} className="recent-row">
                    {isEditing ? (
                      <span
                        className={`recent-item ${
                          activeItemId === item.id ? "is-active" : ""
                        } is-editing`}
                      >
                        <span className={`recent-mode mode-${item.mode}`}>
                          {modeBadge(item.mode)}
                        </span>
                        <input
                          ref={inputRef}
                          className="recent-title-input"
                          type="text"
                          value={draftTitle}
                          onChange={(e) => setDraftTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitRename(item);
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              cancelRename();
                            }
                          }}
                          onBlur={() => commitRename(item)}
                          maxLength={120}
                          aria-label={`Rename ${item.title}`}
                        />
                      </span>
                    ) : (
                      <button
                        type="button"
                        className={`recent-item ${
                          activeItemId === item.id ? "is-active" : ""
                        }`}
                        onClick={() => onSelect(item)}
                        onDoubleClick={(e) => {
                          if (!onRename) return;
                          e.preventDefault();
                          e.stopPropagation();
                          startRename(item);
                        }}
                        title={`${item.mode} \u2014 ${item.title}`}
                      >
                        <span className={`recent-mode mode-${item.mode}`}>
                          {modeBadge(item.mode)}
                        </span>
                        <span className="recent-title">{item.title}</span>
                      </button>
                    )}
                    {!isEditing && onRename && (
                      <button
                        type="button"
                        className="icon-button recent-rename"
                        aria-label={`Rename ${item.title}`}
                        title="Rename"
                        onClick={(e) => {
                          e.stopPropagation();
                          startRename(item);
                        }}
                      >
                        <Pencil size={12} />
                      </button>
                    )}
                    {!isEditing && onDelete && (
                      <button
                        type="button"
                        className="icon-button recent-delete"
                        aria-label={`Delete ${item.title}`}
                        title="Delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (
                            typeof window !== "undefined" &&
                            !window.confirm(
                              `Delete "${item.title}"? This can't be undone.`,
                            )
                          ) {
                            return;
                          }
                          onDelete(item);
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <div className="sidebar-bottom">
        {onOpenSettings && (
          <button
            type="button"
            className="sidebar-settings-btn"
            onClick={onOpenSettings}
            aria-label="Open settings"
            title="Settings"
          >
            <Settings size={14} />
            {!collapsed && <span>Settings</span>}
          </button>
        )}
        <div className="profile-row">
          <span className="profile-avatar" aria-hidden>
            {userLabel.charAt(0).toUpperCase()}
          </span>
          {!collapsed && <span className="profile-name">{userLabel}</span>}
        </div>
      </div>
    </aside>
  );
}

function modeBadge(mode: FeatureMode): string {
  switch (mode) {
    case "solver":
      return "S";
    case "chat":
      return "C";
    case "cheatsheet":
      return "CS";
    case "visualizer":
      return "V";
    case "report":
      return "R";
    case "pdf-notes":
      return "P";
    case "notebook":
      return "N";
    default:
      return "\u2022";
  }
}
