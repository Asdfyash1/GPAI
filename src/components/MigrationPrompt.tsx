"use client";

import { Cloud, Loader2 } from "lucide-react";
import { useState } from "react";

type Props = {
  open: boolean;
  // How many local items would be migrated. Surfaced in the prompt
  // copy so the choice is concrete ("Import 12 saved tasks" not just
  // "Import your stuff").
  localCount: number;
  // Push current local state to the cloud (caller will trigger a
  // /api/sync/save with the live snapshot). Resolves once the save
  // completes so the modal can show a spinner during it.
  onImport: () => Promise<void>;
  // User chose "start fresh" — caller is responsible for clearing
  // local state so the auto-save loop doesn't push the same data
  // up on the next debounce tick.
  onDiscard: () => void;
};

// First-login modal asking whether to migrate device-local history /
// chats / responses up into the user's cloud account. Only rendered
// by EducationApp when (signed-in && remote-empty && local-non-empty).
export function MigrationPrompt({ open, localCount, onImport, onDiscard }: Props) {
  const [importing, setImporting] = useState(false);

  if (!open) return null;

  const handleImport = async () => {
    setImporting(true);
    try {
      await onImport();
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="auth-overlay" role="dialog" aria-modal="true" aria-labelledby="migration-title">
      <div className="auth-card migration-card" onClick={(e) => e.stopPropagation()}>
        <div className="auth-header">
          <Cloud size={28} className="auth-icon" />
          <h2 id="migration-title">Import to your account?</h2>
          <p>
            We found {localCount} saved {localCount === 1 ? "task" : "tasks"} on this device.
            Import them so they sync across browsers and survive cache clearing.
          </p>
        </div>

        <div className="migration-actions">
          <button
            type="button"
            className="auth-submit"
            onClick={handleImport}
            disabled={importing}
          >
            {importing ? (
              <Loader2 size={16} className="spin" />
            ) : (
              `Import ${localCount} ${localCount === 1 ? "task" : "tasks"}`
            )}
          </button>
          <button
            type="button"
            className="auth-back"
            onClick={onDiscard}
            disabled={importing}
          >
            Skip — start fresh on this account
          </button>
        </div>
      </div>
    </div>
  );
}
