"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { GlossaryEntry } from "@/types/education";

type Props = {
  entry: GlossaryEntry;
  /**
   * Called when the user clicks the "Ask AI" / "Learn more" affordance
   * inside the popover. The parent (e.g. SolverView, NotebookView) is
   * expected to fire a chat call referencing the term + definition.
   */
  onAsk?: (entry: GlossaryEntry) => void;
  /** Optional — the rendered text. Defaults to `entry.term`. */
  children?: ReactNode;
};

/**
 * Inline glossary term wrapper.
 *
 * Renders the term as an orange-underlined span. Hovering or focusing
 * it shows a small definition card; clicking the card's "Ask AI"
 * button calls `onAsk()` so the parent view can route the user into a
 * follow-up chat about the term. Pure CSS tooltip — no Radix dep.
 *
 * The element is a `<button>` (not a `<span>`) so it's keyboard-
 * focusable and announces correctly to screen readers as a button
 * with an attached popup.
 */
export function GlossaryTerm({ entry, onAsk, children }: Props) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const wrapperRef = useRef<HTMLSpanElement | null>(null);

  const close = useCallback(() => setOpen(false), []);

  // Close on escape, click-outside, or scroll. The tooltip is meant to
  // be lightweight — no need for proper focus-trap; it's not modal.
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDocClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDocClick);
    };
  }, [open, close]);

  return (
    <span ref={wrapperRef} className="glossary-term-wrapper">
      <button
        type="button"
        className="glossary-term"
        aria-describedby={tooltipId}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.stopPropagation();
          // Toggle on click for touch devices that don't have hover.
          setOpen((prev) => !prev);
        }}
      >
        {children ?? entry.term}
      </button>
      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          className="glossary-popover"
          // Mouse events bubble through the popover too, so the parent
          // wrapper's enter/leave covers it. We just need to keep
          // pointer events alive on the popover itself.
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          <span className="glossary-popover-term">{entry.term}</span>
          <span className="glossary-popover-def">{entry.definition}</span>
          {onAsk && (
            <button
              type="button"
              className="glossary-popover-ask"
              onClick={(e) => {
                e.stopPropagation();
                close();
                onAsk(entry);
              }}
            >
              Ask AI about this →
            </button>
          )}
        </span>
      )}
    </span>
  );
}
