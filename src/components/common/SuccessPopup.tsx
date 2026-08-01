"use client";

import { IconCheck, IconAlertTriangle, IconX } from "@tabler/icons-react";

interface SuccessPopupProps {
  message: string;
  type?: "success" | "error";
  title?: string;
  onClose: () => void;
}

/**
 * Centered modal-style confirmation popup for action outcomes (create/update/delete/etc.),
 * replacing the old top-right snackbar for a clearer, harder-to-miss confirmation.
 */
export function SuccessPopup({ message, type = "success", title, onClose }: SuccessPopupProps) {
  const isSuccess = type === "success";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-nexus-card border border-nexus-border rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200"
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 text-nexus-muted hover:text-nexus-text rounded-lg hover:bg-nexus-hover transition-colors"
        >
          <IconX size={16} />
        </button>

        <div
          className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto border ${
            isSuccess
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-red-500/10 border-red-500/30 text-red-400"
          }`}
        >
          {isSuccess ? <IconCheck size={28} /> : <IconAlertTriangle size={28} />}
        </div>

        <div>
          <h3 className="text-base font-bold text-nexus-text">{title || (isSuccess ? "Success" : "Error")}</h3>
          <p className="text-sm text-nexus-muted mt-1.5 leading-relaxed">{message}</p>
        </div>

        <button
          onClick={onClose}
          className={`w-full py-2.5 rounded-lg text-sm font-bold transition-colors ${
            isSuccess
              ? "bg-nexus-primary text-black hover:bg-nexus-primary/90"
              : "bg-red-500 text-white hover:bg-red-600"
          }`}
        >
          OK
        </button>
      </div>
    </div>
  );
}
