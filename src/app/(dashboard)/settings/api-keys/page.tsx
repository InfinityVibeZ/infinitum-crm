"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import {
  IconKey,
  IconCopy,
  IconCheck,
  IconEye,
  IconEyeOff,
  IconPlus,
  IconEdit,
  IconTrash,
  IconAlertTriangle,
  IconLoader2,
} from "@tabler/icons-react";

interface ApiKeyConfig {
  key: string;
  value: string;
  label: string | null;
  category: string;
  updatedAt: string;
}

export default function SettingsApiKeysPage() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const [keys, setKeys] = useState<ApiKeyConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Visibility map for masking/unmasking key values
  const [visibilityMap, setVisibilityMap] = useState<Record<string, boolean>>({});
  // Clipboard copy status
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [keyInput, setKeyInput] = useState("");
  const [valueInput, setValueInput] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState("");

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ApiKeyConfig | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchKeys();
    }
  }, [isSuperAdmin]);

  const fetchKeys = async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/settings/api-keys");
      if (!res.ok) {
        throw new Error("Failed to load API keys.");
      }
      const data = await res.json();
      setKeys(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleVisibility = (key: string) => {
    setVisibilityMap((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const openCreateModal = () => {
    setModalMode("create");
    setKeyInput("");
    setValueInput("");
    setLabelInput("");
    setModalError("");
    setShowModal(true);
  };

  const openEditModal = (item: ApiKeyConfig) => {
    setModalMode("edit");
    setKeyInput(item.key);
    setValueInput(item.value);
    setLabelInput(item.label || "");
    setModalError("");
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");
    setIsSaving(true);

    if (!keyInput.trim() || !valueInput.trim()) {
      setModalError("Key identifier and Value are required.");
      setIsSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: keyInput,
          value: valueInput,
          label: labelInput,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save API key.");
      }

      setSuccessMsg(`Successfully saved API key: ${keyInput.toUpperCase()}`);
      setTimeout(() => setSuccessMsg(""), 4000);
      setShowModal(false);
      fetchKeys();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Failed to save API key.");
    } finally {
      setIsSaving(false);
    }
  };

  const openDeleteModal = (item: ApiKeyConfig) => {
    setDeleteTarget(item);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/settings/api-keys?key=${deleteTarget.key}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete API key.");
      }

      setSuccessMsg(`Successfully deleted API key: ${deleteTarget.key}`);
      setTimeout(() => setSuccessMsg(""), 4000);
      setShowDeleteModal(false);
      setDeleteTarget(null);
      fetchKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete API key.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <PermissionGuard roles={["SUPER_ADMIN"]}>
    <div className="space-y-6 text-nexus-text max-w-5xl animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="p-2 bg-nexus-primary/10 rounded-xl text-nexus-primary">
              <IconKey size={24} />
            </span>
            API Keys & Integrations
          </h1>
          <p className="text-sm text-nexus-text-secondary mt-1">
            Configure external service keys (AI models, payment gates, SMTP) securely. Updates apply immediately.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-nexus-primary text-black hover:bg-nexus-primary/90 rounded-lg text-sm font-bold transition-all shadow-lg shadow-nexus-primary/10 self-start md:self-auto focus:outline-none"
        >
          <IconPlus size={16} />
          Add API Key
        </button>
      </div>

      {successMsg && (
        <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-xl px-4 py-3 text-xs text-emerald-400 font-semibold animate-in slide-in-from-top-2 duration-300">
          {successMsg}
        </div>
      )}

      {error && (
        <div className="bg-red-500/15 border border-red-500/30 rounded-xl px-4 py-3 text-xs text-red-400 font-semibold animate-shake">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <IconLoader2 size={36} className="animate-spin text-nexus-primary" />
          <p className="text-xs text-nexus-muted">Fetching credentials from database...</p>
        </div>
      ) : keys.length === 0 ? (
        <div className="border border-dashed border-nexus-border rounded-xl p-12 text-center space-y-3">
          <p className="text-sm text-nexus-muted">No API keys configured yet.</p>
          <button
            onClick={openCreateModal}
            className="text-xs font-bold text-nexus-primary hover:underline focus:outline-none"
          >
            Create your first key
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {keys.map((item) => {
            const isVisible = !!visibilityMap[item.key];
            const isCopied = copiedKey === item.key;
            return (
              <div
                key={item.key}
                className="bg-nexus-card border border-nexus-border rounded-xl p-5 flex flex-col justify-between hover:border-nexus-primary/30 transition-all shadow-sm"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-nexus-text">
                        {item.label || item.key}
                      </h3>
                      <code className="text-[10px] text-nexus-muted bg-nexus-bg px-1.5 py-0.5 rounded border border-nexus-border font-mono">
                        {item.key}
                      </code>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEditModal(item)}
                        className="p-1.5 text-nexus-muted hover:text-nexus-text hover:bg-nexus-hover rounded-lg transition-colors"
                        title="Edit key"
                      >
                        <IconEdit size={16} />
                      </button>
                      <button
                        onClick={() => openDeleteModal(item)}
                        className="p-1.5 text-nexus-muted hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                        title="Delete key"
                      >
                        <IconTrash size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-nexus-bg border border-nexus-border rounded-lg px-3 py-2 text-xs font-mono">
                    <span className="truncate flex-1 text-nexus-text-secondary select-all">
                      {isVisible ? item.value : "••••••••••••••••••••••••••••••••"}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleVisibility(item.key)}
                        className="p-1 text-nexus-muted hover:text-nexus-text rounded transition-colors"
                        title={isVisible ? "Mask Key" : "Reveal Key"}
                      >
                        {isVisible ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                      </button>
                      <button
                        onClick={() => handleCopy(item.key, item.value)}
                        className="p-1 text-nexus-muted hover:text-nexus-text rounded transition-colors"
                        title="Copy Key"
                      >
                        {isCopied ? <IconCheck size={14} className="text-emerald-400" /> : <IconCopy size={14} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="text-[9px] text-nexus-muted mt-4 pt-3 border-t border-nexus-border/50">
                  Last updated: {new Date(item.updatedAt).toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit API Key Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-nexus-card border border-nexus-border rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-nexus-border flex items-center justify-between">
              <h2 className="text-base font-bold text-nexus-text">
                {modalMode === "create" ? "Add API Key" : "Edit API Key"}
              </h2>
            </div>

            <form onSubmit={handleSave}>
              <div className="p-6 space-y-4">
                {modalError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-xs text-red-400 animate-shake">
                    {modalError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-nexus-text-secondary mb-1.5">
                    Key Identifier (e.g. GEMINI_API_KEY)
                  </label>
                  <input
                    type="text"
                    required
                    value={keyInput}
                    disabled={modalMode === "edit"}
                    onChange={(e) => setKeyInput(e.target.value.toUpperCase().replace(/\s+/g, "_"))}
                    placeholder="EXTERNAL_SERVICE_KEY"
                    className="w-full bg-nexus-bg border border-nexus-border rounded-lg px-3 py-2 text-sm text-nexus-text placeholder-nexus-muted focus:outline-none focus:border-nexus-primary disabled:opacity-50 disabled:cursor-not-allowed font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-nexus-text-secondary mb-1.5">
                    Label / Description (e.g. Google Gemini API Key)
                  </label>
                  <input
                    type="text"
                    value={labelInput}
                    onChange={(e) => setLabelInput(e.target.value)}
                    placeholder="Stripe Payments API Key"
                    className="w-full bg-nexus-bg border border-nexus-border rounded-lg px-3 py-2 text-sm text-nexus-text placeholder-nexus-muted focus:outline-none focus:border-nexus-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-nexus-text-secondary mb-1.5">
                    Key Value
                  </label>
                  <input
                    type="password"
                    required
                    value={valueInput}
                    onChange={(e) => setValueInput(e.target.value)}
                    placeholder="nexus_live_sk_..."
                    className="w-full bg-nexus-bg border border-nexus-border rounded-lg px-3 py-2 text-sm text-nexus-text placeholder-nexus-muted focus:outline-none focus:border-nexus-primary font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 px-6 py-4 border-t border-nexus-border bg-nexus-card">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-nexus-muted border border-nexus-border rounded-lg hover:bg-nexus-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold bg-nexus-primary text-black rounded-lg hover:bg-nexus-primary/95 transition-all shadow-md disabled:opacity-50"
                >
                  {isSaving && <IconLoader2 size={12} className="animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-nexus-card border border-nexus-border rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-400">
                <IconAlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-nexus-text">Delete API Key?</h3>
                <p className="text-xs text-nexus-muted mt-1 leading-relaxed">
                  Are you sure you want to permanently delete the API key <span className="font-bold text-nexus-text font-mono">{deleteTarget.key}</span>?
                  This action is irreversible and may break integrations relying on this key.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-nexus-border bg-nexus-card">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-xs font-semibold text-nexus-muted border border-nexus-border rounded-lg hover:bg-nexus-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all disabled:opacity-50"
              >
                {isDeleting && <IconLoader2 size={12} className="animate-spin" />}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </PermissionGuard>
  );
}
