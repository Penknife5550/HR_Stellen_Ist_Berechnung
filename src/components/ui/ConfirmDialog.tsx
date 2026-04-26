"use client";

import { useEffect, useRef } from "react";

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Schlanker Confirm-Dialog ohne externe Dependency.
 * Ersetzt window.confirm() — accessible (role=dialog, focus, Esc-Handling).
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Bestaetigen",
  cancelLabel = "Abbrechen",
  variant = "default",
  onConfirm,
  onCancel,
}: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKey);
    confirmRef.current?.focus();
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h2 id="confirm-dialog-title" className="text-lg font-bold text-[#1A1A1A] mb-2">
          {title}
        </h2>
        <p id="confirm-dialog-message" className="text-sm text-[#575756] mb-6">
          {message}
        </p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-[#D1D5DB] text-[#374151] rounded-lg hover:bg-gray-50 text-sm font-medium cursor-pointer transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors text-white ${
              variant === "danger"
                ? "bg-[#E2001A] hover:bg-[#B8001A]"
                : "bg-[#575756] hover:bg-[#444]"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
