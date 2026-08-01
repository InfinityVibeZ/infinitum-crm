"use client";

import { IconShieldLock, IconArrowLeft } from "@tabler/icons-react";

interface AccessDeniedViewProps {
  onGoBack: () => void;
}

/**
 * Single shared "Access Denied" visual — used both by PermissionGuard (inline, within
 * pages middleware doesn't fully cover) and the standalone /access-denied page (middleware
 * redirect target), so the experience looks identical everywhere in the app.
 */
export function AccessDeniedView({ onGoBack }: AccessDeniedViewProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
      <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
        <IconShieldLock size={36} className="text-red-400" />
      </div>
      <div className="space-y-2 max-w-sm">
        <h2 className="text-xl font-bold text-nexus-text">Access Denied</h2>
        <p className="text-sm text-nexus-muted">You don&apos;t have permission to access this page.</p>
      </div>
      <button
        onClick={onGoBack}
        className="flex items-center gap-2 px-5 py-2.5 bg-nexus-primary text-black rounded-lg text-sm font-semibold hover:bg-nexus-primary/90 transition-colors"
      >
        <IconArrowLeft size={16} />
        Go to Dashboard
      </button>
    </div>
  );
}
