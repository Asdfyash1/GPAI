"use client";

import { Sparkles, Sun, Moon, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePersonalization } from "@/hooks/usePersonalization";

type Theme = "dark" | "light";

type SettingsTab = "general" | "personalize";

type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
};

const TABS: Array<{ id: SettingsTab; label: string; description: string }> = [
  {
    id: "general",
    label: "General",
    description: "Theme, language, and basic preferences.",
  },
  {
    id: "personalize",
    label: "Personalize",
    description:
      "Tell the model who you are and how you like answers — applied to every Solver / Chat reply.",
  },
];

export function SettingsModal({
  open,
  onClose,
  theme,
  onThemeChange,
}: SettingsModalProps) {
  const [tab, setTab] = useState<SettingsTab>("personalize");
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="settings-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        <header className="settings-header">
          <h2>Settings</h2>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close settings"
          >
            <X size={16} />
          </button>
        </header>

        <div className="settings-body">
          <nav className="settings-nav" aria-label="Settings sections">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`settings-nav-item ${
                  tab === t.id ? "is-active" : ""
                }`}
                onClick={() => setTab(t.id)}
              >
                <span className="settings-nav-label">{t.label}</span>
                <span className="settings-nav-description">
                  {t.description}
                </span>
              </button>
            ))}
          </nav>

          <section className="settings-content">
            {tab === "general" && (
              <GeneralPanel theme={theme} onThemeChange={onThemeChange} />
            )}
            {tab === "personalize" && <PersonalizePanel />}
          </section>
        </div>
      </div>
    </div>
  );
}

function GeneralPanel({
  theme,
  onThemeChange,
}: {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}) {
  return (
    <div className="settings-panel">
      <h3>Appearance</h3>
      <p className="settings-help">
        Switch between dark and light themes. Your choice is saved to this
        browser.
      </p>
      <div className="theme-toggle-group" role="radiogroup" aria-label="Theme">
        <button
          type="button"
          role="radio"
          aria-checked={theme === "dark"}
          className={`theme-toggle ${theme === "dark" ? "is-active" : ""}`}
          onClick={() => onThemeChange("dark")}
        >
          <Moon size={14} />
          Dark
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={theme === "light"}
          className={`theme-toggle ${theme === "light" ? "is-active" : ""}`}
          onClick={() => onThemeChange("light")}
        >
          <Sun size={14} />
          Light
        </button>
      </div>
    </div>
  );
}

function PersonalizePanel() {
  const {
    value,
    update,
    reset,
    OCCUPATION_LIMIT,
    CUSTOM_INSTRUCTIONS_LIMIT,
  } = usePersonalization();

  const occupation = value.occupation ?? "";
  const customInstructions = value.customInstructions ?? "";

  return (
    <div className="settings-panel">
      <div className="settings-panel-headline">
        <Sparkles size={14} />
        <h3>Personalize</h3>
      </div>
      <p className="settings-help">
        Forge appends these preferences to every Solver and Chat system
        prompt. Leave a field blank to opt out — empty values are not sent
        to the model.
      </p>

      <label className="settings-field">
        <span className="settings-field-label">
          What best describes you?
          <span className="settings-counter">
            {occupation.length} / {OCCUPATION_LIMIT}
          </span>
        </span>
        <span className="settings-field-help">
          A short job title or learning level. Example:
          <em> Mechanical engineer reviewing graduate-level dynamics.</em>
        </span>
        <input
          className="settings-input"
          type="text"
          maxLength={OCCUPATION_LIMIT}
          value={occupation}
          placeholder="e.g. Class 12 student preparing for JEE Advanced"
          onChange={(e) => update({ occupation: e.target.value })}
        />
      </label>

      <label className="settings-field">
        <span className="settings-field-label">
          What should Forge know about your style?
          <span className="settings-counter">
            {customInstructions.length} / {CUSTOM_INSTRUCTIONS_LIMIT}
          </span>
        </span>
        <span className="settings-field-help">
          Free-text instructions injected into the system prompt. Examples:
          <em> Always show SI units, prefer Indian textbook conventions, no
          emojis, define every symbol on first use.</em>
        </span>
        <textarea
          className="settings-textarea"
          maxLength={CUSTOM_INSTRUCTIONS_LIMIT}
          value={customInstructions}
          placeholder="Example: Always show units. Skip step-by-step framings shorter than 2 lines."
          onChange={(e) => update({ customInstructions: e.target.value })}
          rows={8}
        />
      </label>

      <div className="settings-actions">
        <button
          type="button"
          className="settings-secondary-btn"
          onClick={reset}
          disabled={!occupation && !customInstructions}
        >
          Reset
        </button>
        <span className="settings-saved-pill">
          Saved automatically to this browser
        </span>
      </div>
    </div>
  );
}
