"use client";

import {
  Plus,
  PanelLeftClose,
  PanelLeft,
  ChevronRight,
  Trash2,
  Settings,
} from "lucide-react";
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
  onNewTask,
  onOpenSettings,
  userLabel = "Guest",
}: SidebarProps) {
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
            <p className="recent-empty">No items yet</p>
          ) : (
            <ul className="recent-list">
              {items.map((item) => (
                <li key={item.id} className="recent-row">
                  <button
                    type="button"
                    className={`recent-item ${
                      activeItemId === item.id ? "is-active" : ""
                    }`}
                    onClick={() => onSelect(item)}
                    title={`${item.mode} \u2014 ${item.title}`}
                  >
                    <span className={`recent-mode mode-${item.mode}`}>
                      {modeBadge(item.mode)}
                    </span>
                    <span className="recent-title">{item.title}</span>
                  </button>
                  {onDelete && (
                    <button
                      type="button"
                      className="icon-button recent-delete"
                      aria-label={`Delete ${item.title}`}
                      title="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(item);
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </li>
              ))}
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
