"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import {
  IconLock,
  IconLoader2,
  IconAlertTriangle,
  IconDeviceFloppy,
  IconRefresh,
} from "@tabler/icons-react";

interface RoleAccessConfig {
  SUPER_ADMIN: boolean;
  ADMIN: boolean;
  USER: boolean;
}

type PermissionsMap = Record<string, RoleAccessConfig>;

const MENU_STRUCTURE = [
  {
    section: "LEADS",
    items: [
      { href: "/leads/crm", label: "Leads CRM" },
      { href: "/leads/metrics", label: "Lead Metrics" },
    ],
  },
  {
    section: "SALES",
    items: [
      { href: "/sales/pipeline", label: "Sales Pipeline" },
      { href: "/sales/crm", label: "Sales CRM" },
      { href: "/sales/metrics", label: "Sales Metrics" },
    ],
  },
  {
    section: "OFFER",
    items: [
      { href: "/offer/creation", label: "Offer Creation" },
      { href: "/offer/revenue-generator", label: "Revenue Operations" },
      { href: "/offer/ideas-backlog", label: "Ideas Backlog" },
    ],
  },
  {
    section: "DOCUMENTS",
    items: [
      { href: "/documents/proposals", label: "Proposals" },
      { href: "/documents/contracts", label: "Contracts" },
      { href: "/documents/invoices", label: "Invoices" },
      { href: "/documents/templates", label: "Templates" },
    ],
  },
  {
    section: "FINANCES",
    items: [
      { href: "/finances/dashboard", label: "Financial Dashboard" },
      { href: "/finances/cash-in", label: "Cash In" },
      { href: "/finances/cash-out", label: "Cash Out" },
      { href: "/finances/receivables", label: "Receivables" },
    ],
  },
  {
    section: "OPERATIONS",
    items: [
      { href: "/operations/onboarding", label: "Onboarding" },
      { href: "/operations/fulfillment", label: "Project Management" },
      { href: "/operations/custom-reports", label: "Custom Reports" },
    ],
  },
  {
    section: "AI & AUTOMATION",
    items: [
      { href: "/ai-tools/content-companion", label: "AI Content Companion" },
      { href: "/ai-tools/email-assistant", label: "Email Assistant" },
      { href: "/ai-tools/lead-scoring", label: "Lead Scoring" },
    ],
  },
  {
    section: "ADMINISTRATION",
    items: [
      { href: "/admin/admin-management", label: "Admin Management" },
      { href: "/admin/user-management", label: "User Management" },
      { href: "/admin/audit-logs", label: "Audit Logs" },
    ],
  },
  {
    section: "SYSTEM CONFIG",
    items: [
      { href: "/settings/security", label: "Change Password" },
      { href: "/admin/permissions", label: "Menu" },
      { href: "/settings/api-keys", label: "API Keys" },
    ],
  },
];

export default function RolePermissionsPage() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const [permissions, setPermissions] = useState<PermissionsMap | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (isSuperAdmin) {
      fetchPermissions();
    }
  }, [isSuperAdmin]);

  const fetchPermissions = async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/settings/permissions");
      if (!res.ok) throw new Error("Failed to load permission matrix.");
      const data = await res.json();
      setPermissions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load permissions.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckboxChange = (href: string, role: keyof RoleAccessConfig) => {
    if (!permissions) return;

    // Hardcode safety check: SUPER_ADMIN must always have access to Role Permissions page to avoid lockout
    if (href === "/admin/permissions" && role === "SUPER_ADMIN") {
      return;
    }

    setPermissions((prev) => {
      if (!prev) return null;
      const pageConfig = prev[href]
        ? { ...prev[href] }
        : { SUPER_ADMIN: true, ADMIN: false, USER: false };

      return {
        ...prev,
        [href]: {
          ...pageConfig,
          [role]: !pageConfig[role],
        },
      };
    });
  };

  const handleSave = async () => {
    if (!permissions) return;
    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/settings/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions }),
      });

      if (!res.ok) throw new Error("Failed to save changes.");

      // Re-issue the current session's JWT with the freshly saved permissions embedded,
      // so this change takes effect immediately without needing to sign out/in. The JWT
      // (not a plain cookie) is what middleware trusts for page-level access.
      try {
        const refreshRes = await fetch("/api/auth/refresh-permissions", { method: "POST" });
        if (refreshRes.ok) {
          const { token: newToken } = await refreshRes.json();
          if (newToken && user) {
            localStorage.setItem("nexus-token", newToken);
            useAuthStore.getState().setAuth(user, newToken);
          }
        }
      } catch (_) {
        // Non-fatal — the saved matrix still applies to everyone at their next login.
      }

      setSuccess("Permissions matrix updated successfully. Changes take effect immediately!");
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update permissions.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PermissionGuard roles={["SUPER_ADMIN"]}>
    <div className="space-y-6 text-nexus-text max-w-5xl animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="p-2 bg-nexus-primary/10 rounded-xl text-nexus-primary">
              <IconLock size={24} />
            </span>
            Menu
          </h1>
          <p className="text-sm text-nexus-text-secondary mt-1">
            Configure dynamic page access for Super Admin, Admin, and User roles across all menu and submenu items.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={fetchPermissions}
            disabled={isLoading || isSaving}
            className="flex items-center justify-center p-2.5 border border-nexus-border rounded-lg hover:bg-nexus-hover text-nexus-text transition-colors disabled:opacity-50"
            title="Refresh permissions"
          >
            <IconRefresh size={18} />
          </button>
          
          <button
            onClick={handleSave}
            disabled={isLoading || isSaving || !permissions}
            className="flex items-center gap-2 px-5 py-2.5 bg-nexus-primary text-black hover:bg-nexus-primary/90 rounded-lg text-sm font-bold transition-all shadow-lg shadow-nexus-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <IconLoader2 size={16} className="animate-spin" />
            ) : (
              <IconDeviceFloppy size={16} />
            )}
            Save
          </button>
        </div>
      </div>

      {success && (
        <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-xl px-4 py-3 text-xs text-emerald-400 font-semibold animate-in slide-in-from-top-2 duration-300">
          {success}
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
          <p className="text-xs text-nexus-muted">Loading role permissions matrix...</p>
        </div>
      ) : !permissions ? (
        <div className="border border-dashed border-nexus-border rounded-xl p-12 text-center text-nexus-muted">
          Failed to load permissions configuration.
        </div>
      ) : (
        <div className="bg-nexus-card border border-nexus-border rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-nexus-border bg-nexus-bg/50">
                  <th className="p-4 font-bold text-nexus-text">Page Menu Path & Title</th>
                  <th className="p-4 font-bold text-nexus-text text-center w-36">Super Admin Access</th>
                  <th className="p-4 font-bold text-nexus-text text-center w-36">Admin Access</th>
                  <th className="p-4 font-bold text-nexus-text text-center w-36">User Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nexus-border/50">
                {MENU_STRUCTURE.map((group) => {
                  return (
                    <tr key={group.section} className="bg-nexus-bg/30">
                      <td colSpan={4} className="p-0">
                        {/* Group Header Row */}
                        <div className="bg-nexus-bg/85 px-4 py-3 font-bold text-nexus-primary tracking-wide text-xs uppercase border-y border-nexus-border/40 flex items-center gap-2">
                          <span className="w-1.5 h-3 bg-nexus-primary rounded-sm"></span>
                          {group.section}
                        </div>
                        
                        {/* Submenu Item Rows */}
                        <table className="w-full text-left border-collapse text-xs">
                          <tbody className="divide-y divide-nexus-border/30">
                            {group.items.map((item) => {
                              const config = permissions[item.href] || {
                                SUPER_ADMIN: true,
                                ADMIN: false,
                                USER: false,
                              };
                              const isPermissionsLockout =
                                item.href === "/admin/permissions";

                              return (
                                <tr
                                  key={item.href}
                                  className="hover:bg-nexus-hover/20 transition-colors"
                                >
                                  <td className="p-4 pl-8 flex flex-col gap-0.5">
                                    <span className="font-bold text-nexus-text text-sm">
                                      {item.label}
                                    </span>
                                    <span className="font-mono text-[10px] text-nexus-muted">
                                      {item.href}
                                    </span>
                                  </td>
                                  
                                  {/* Super Admin */}
                                  <td className="p-4 text-center w-36">
                                    <input
                                      type="checkbox"
                                      checked={config.SUPER_ADMIN}
                                      disabled={isPermissionsLockout}
                                      onChange={() =>
                                        handleCheckboxChange(
                                          item.href,
                                          "SUPER_ADMIN"
                                        )
                                      }
                                      className="w-4 h-4 rounded border-nexus-border text-nexus-primary focus:ring-nexus-primary/20 accent-[#10D078] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                    />
                                  </td>
                                  
                                  {/* Admin */}
                                  <td className="p-4 text-center w-36">
                                    <input
                                      type="checkbox"
                                      checked={config.ADMIN}
                                      onChange={() =>
                                        handleCheckboxChange(item.href, "ADMIN")
                                      }
                                      className="w-4 h-4 rounded border-nexus-border text-nexus-primary focus:ring-nexus-primary/20 accent-[#10D078] cursor-pointer"
                                    />
                                  </td>
                                  
                                  {/* User */}
                                  <td className="p-4 text-center w-36">
                                    <input
                                      type="checkbox"
                                      checked={config.USER}
                                      onChange={() =>
                                        handleCheckboxChange(item.href, "USER")
                                      }
                                      className="w-4 h-4 rounded border-nexus-border text-nexus-primary focus:ring-nexus-primary/20 accent-[#10D078] cursor-pointer"
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
    </PermissionGuard>
  );
}
