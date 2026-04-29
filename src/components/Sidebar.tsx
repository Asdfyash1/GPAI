"use client";

import { Plus, PanelLeftClose, PanelLeft, ChevronRight } from "lucide-react";
import type { FeatureMode } from "@/types/education";

export type SidebarItem = {
  id: string;
  title: string;
  mode: FeatureMode;
  preview?: string;
};

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
  items: SidebarItem[];
  activeItemId?: string;
  onSelect: (item: SidebarItem) => void;
  onNewTask: () => void;
  userLabel?: string;
  credits?: number;
  creditsMax?: number;
};

export function Sidebar({
  collapsed,
  onToggle,
  items,
  activeItemId,
  onSelect,
  onNewTask,
  userLabel = "Guest",
  credits,
  creditsMax,
}: SidebarProps) {
  return (
    <aside className={`sidebar ${collapsed ? "is-collapsed" : ""}`}>
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
          {!collapsed && <span className="brand-name">eduForge</span>}
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
                <li key={item.id}>
                  <button
                    type="button"
                    className={`recent-item ${
                      activeItemId === item.id ? "is-active" : ""
                    }`}
                    onClick={() => onSelect(item)}
                  >
                    <span className="recent-title">{item.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="sidebar-bottom">
        {!collapsed && credits != null && creditsMax != null && (
          <div className="credits-card">
            <div className="credits-row">
              <span className="credits-label">⚡ Credits</span>
              <span className="credits-value">
                {credits} / {creditsMax}
              </span>
            </div>
            <div
              className="credits-bar"
              role="progressbar"
              aria-valuenow={credits}
              aria-valuemax={creditsMax}
            >
              <span style={{ width: `${(credits / creditsMax) * 100}%` }} />
            </div>
            <button className="upgrade-btn" type="button">
              Upgrade
            </button>
          </div>
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
