"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  IconTrash,
  IconRefresh,
  IconUsers,
  IconAddressBook,
  IconSearch,
  IconCheck,
  IconX,
  IconLoader2,
  IconArrowLeft,
  IconUserCheck,
  IconAlertTriangle,
  IconBuilding,
  IconUserShield,
} from "@tabler/icons-react";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { useAuthStore } from "@/store/auth";

interface TrashedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  company?: string;
  department?: string;
  phone?: string;
  isDeleted: boolean;
  deletedAt?: string;
  createdAt: string;
}

interface TrashedLead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  status: string;
  leadSource?: string;
  createdAt: string;
  deletedAt?: string;
  user?: { name: string; email: string; company?: string; department?: string };
}

interface TrashedCompany {
  id: string;
  name: string;
  category?: string;
  status: string;
  isActive: boolean;
  deletedAt?: string;
  createdAt: string;
  adminCount?: number;
  userCount?: number;
}

type ArchiveTab = "companies" | "admins" | "users" | "leads";

export default function AdminArchivePage() {
  const { user: currentUser } = useAuthStore();
  const isAdmin = currentUser?.role === "ADMIN";
  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";

  const [activeTab, setActiveTab] = useState<ArchiveTab>("users");
  const [tabInitialized, setTabInitialized] = useState(false);

  // Data state
  const [trashedCompanies, setTrashedCompanies] = useState<TrashedCompany[]>([]);
  const [trashedUsers, setTrashedUsers] = useState<TrashedUser[]>([]);
  const [trashedLeads, setTrashedLeads] = useState<TrashedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Confirmation modal state
  const [confirmHardDeleteUser, setConfirmHardDeleteUser] = useState<TrashedUser | null>(null);
  const [confirmHardDeleteLead, setConfirmHardDeleteLead] = useState<TrashedLead | null>(null);
  const [confirmHardDeleteCompany, setConfirmHardDeleteCompany] = useState<TrashedCompany | null>(null);

  function formatDate(d?: string | null) {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return d;
    }
  }

  function showToast(msg: string, type: "success" | "error") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  const token = () => (typeof window !== "undefined" ? localStorage.getItem("nexus-token") || "" : "");

  // ── Fetch Trashed Items ──────────────────────────────────────────────────

  const fetchTrashedItems = useCallback(async () => {
    setLoading(true);
    try {
      const authToken = token();

      // Fetch trashed users — the API itself scopes this to the caller's
      // own company for ADMIN and returns everything for SUPER_ADMIN.
      const usersRes = await fetch("/api/users?deleted=true", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const usersData = await usersRes.json();
      if (Array.isArray(usersData)) {
        setTrashedUsers(usersData);
      } else if (usersData.allUsers && Array.isArray(usersData.allUsers)) {
        setTrashedUsers(usersData.allUsers.filter((u: any) => u.isDeleted));
      }

      // Fetch soft-deleted (trashed) leads — company-scoped for ADMIN via RLS
      const leadsRes = await fetch("/api/leads?trash=true", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const leadsData = await leadsRes.json();
      if (Array.isArray(leadsData)) {
        setTrashedLeads(leadsData);
      }

      // Archived companies — Super Admin only
      if (currentUser?.role === "SUPER_ADMIN") {
        const companiesRes = await fetch("/api/companies?archived=true", {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const companiesData = await companiesRes.json();
        if (Array.isArray(companiesData)) {
          setTrashedCompanies(companiesData);
        }
      } else {
        setTrashedCompanies([]);
      }
    } catch (e) {
      showToast("Error loading archived items", "error");
    } finally {
      setLoading(false);
    }
  }, [currentUser?.role]);

  useEffect(() => {
    fetchTrashedItems();
  }, [fetchTrashedItems]);

  // Default to a role-appropriate tab once the current user is known
  useEffect(() => {
    if (!tabInitialized && currentUser) {
      setActiveTab(currentUser.role === "SUPER_ADMIN" ? "companies" : "users");
      setTabInitialized(true);
    }
  }, [currentUser, tabInitialized]);

  // ── Handlers for Users ───────────────────────────────────────────────────

  async function handleRestoreUser(u: TrashedUser) {
    setActionLoadingId(u.id);
    try {
      const res = await fetch(`/api/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ action: "restore" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to restore user");
      showToast(`User "${u.name}" restored successfully`, "success");
      fetchTrashedItems();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error restoring user", "error");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handlePermanentDeleteUser(u: TrashedUser) {
    setActionLoadingId(u.id);
    try {
      const res = await fetch(`/api/users/${u.id}?hard=true`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to permanently delete user");
      showToast(`User "${u.name}" permanently deleted`, "success");
      setConfirmHardDeleteUser(null);
      fetchTrashedItems();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error deleting user", "error");
    } finally {
      setActionLoadingId(null);
    }
  }

  // ── Handlers for Leads ───────────────────────────────────────────────────

  async function handleRestoreLead(l: TrashedLead) {
    setActionLoadingId(l.id);
    try {
      const res = await fetch(`/api/leads/${l.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ isDeleted: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to restore lead");
      showToast(`Lead "${l.firstName} ${l.lastName}" restored from trash`, "success");
      fetchTrashedItems();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error restoring lead", "error");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handlePermanentDeleteLead(l: TrashedLead) {
    setActionLoadingId(l.id);
    try {
      const res = await fetch(`/api/leads/${l.id}?permanent=true`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete lead");
      showToast(`Lead "${l.firstName} ${l.lastName}" permanently deleted`, "success");
      setConfirmHardDeleteLead(null);
      fetchTrashedItems();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error deleting lead", "error");
    } finally {
      setActionLoadingId(null);
    }
  }

  // ── Handlers for Companies (Super Admin only) ────────────────────────────

  async function handleRestoreCompany(c: TrashedCompany) {
    setActionLoadingId(c.id);
    try {
      const res = await fetch(`/api/companies/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ action: "restore" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to restore company");
      showToast(`Company "${c.name}" restored successfully`, "success");
      fetchTrashedItems();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error restoring company", "error");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handlePermanentDeleteCompany(c: TrashedCompany) {
    setActionLoadingId(c.id);
    try {
      const res = await fetch(`/api/companies/${c.id}?hard=true`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to permanently delete company");
      showToast(`Company "${c.name}" permanently deleted`, "success");
      setConfirmHardDeleteCompany(null);
      fetchTrashedItems();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error deleting company", "error");
    } finally {
      setActionLoadingId(null);
    }
  }

  // ── Search Filtering ──────────────────────────────────────────────────────

  // Regular Admins get one merged "Users" tab covering their company's admins
  // and users (already company-scoped by the API). Super Admin splits the same
  // data into separate "Admins" and "Users" tabs across ALL companies.
  const adminRoleUsers = trashedUsers.filter((u) => u.role === "ADMIN" || u.role === "SUPER_ADMIN");
  const regularRoleUsers = trashedUsers.filter((u) => u.role === "USER");

  const usersForActiveTab = isSuperAdmin
    ? activeTab === "admins"
      ? adminRoleUsers
      : regularRoleUsers
    : trashedUsers;

  const filteredUsers = usersForActiveTab.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.company && u.company.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredLeads = trashedLeads.filter(
    (l) =>
      `${l.firstName} ${l.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.company && l.company.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredCompanies = trashedCompanies.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.category && c.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <PermissionGuard roles={["SUPER_ADMIN", "ADMIN"]}>
      <div className="space-y-6 text-nexus-text">

        {/* Toast */}
        {toast && (
          <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl text-sm font-semibold transition-all ${
            toast.type === "success"
              ? "bg-emerald-900/80 border-emerald-500/40 text-emerald-300"
              : "bg-red-900/80 border-red-500/40 text-red-300"
          }`}>
            {toast.type === "success" ? <IconCheck size={16} /> : <IconX size={16} />}
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                <IconTrash size={22} />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-nexus-text tracking-tight">Archive</h1>
                <p className="text-xs text-nexus-muted mt-0.5">
                  {isSuperAdmin
                    ? "View and manage archived companies, admins, users and leads across all organizations"
                    : "View and manage archived admins, users and leads for your company"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchTrashedItems}
              className="flex items-center gap-2 px-3.5 py-2 bg-nexus-card border border-nexus-border text-nexus-muted hover:text-nexus-text text-xs font-semibold rounded-lg transition-colors"
            >
              <IconRefresh size={15} /> Refresh
            </button>
          </div>
        </div>

        {/* Tab Controls & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-nexus-card border border-nexus-border p-2 rounded-xl">
          <div className="flex items-center gap-2 flex-wrap">
            {isSuperAdmin && (
              <button
                onClick={() => setActiveTab("companies")}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  activeTab === "companies"
                    ? "bg-nexus-primary text-black shadow-md shadow-nexus-primary/20"
                    : "text-nexus-muted hover:text-nexus-text hover:bg-nexus-hover"
                }`}
              >
                <IconBuilding size={16} />
                Companies ({trashedCompanies.length})
              </button>
            )}

            {isSuperAdmin && (
              <button
                onClick={() => setActiveTab("admins")}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  activeTab === "admins"
                    ? "bg-nexus-primary text-black shadow-md shadow-nexus-primary/20"
                    : "text-nexus-muted hover:text-nexus-text hover:bg-nexus-hover"
                }`}
              >
                <IconUserShield size={16} />
                Admins ({adminRoleUsers.length})
              </button>
            )}

            <button
              onClick={() => setActiveTab("users")}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === "users"
                  ? "bg-nexus-primary text-black shadow-md shadow-nexus-primary/20"
                  : "text-nexus-muted hover:text-nexus-text hover:bg-nexus-hover"
              }`}
            >
              <IconUsers size={16} />
              Users ({isSuperAdmin ? regularRoleUsers.length : trashedUsers.length})
            </button>

            <button
              onClick={() => setActiveTab("leads")}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === "leads"
                  ? "bg-nexus-primary text-black shadow-md shadow-nexus-primary/20"
                  : "text-nexus-muted hover:text-nexus-text hover:bg-nexus-hover"
              }`}
            >
              <IconAddressBook size={16} />
              Leads ({trashedLeads.length})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-muted" />
            <input
              type="text"
              placeholder="Search archive…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-nexus-bg border border-nexus-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-nexus-text placeholder-nexus-muted focus:outline-none focus:border-nexus-primary"
            />
          </div>
        </div>

        {/* Tab Content: Deleted Users / Admins */}
        {(activeTab === "users" || activeTab === "admins") && (
          <div className="bg-nexus-card border border-nexus-border rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[750px]">
                <thead>
                  <tr className="border-b border-nexus-border text-[11px] uppercase text-nexus-muted font-semibold bg-nexus-bg/50">
                    <th className="p-4">{activeTab === "admins" ? "Admin Name" : "User Name"}</th>
                    <th className="p-4">Email</th>
                    {isSuperAdmin && <th className="p-4">Company</th>}
                    <th className="p-4">Phone</th>
                    <th className="p-4">Created Date</th>
                    <th className="p-4">Trashed Date</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-nexus-border">
                  {loading && (
                    <tr>
                      <td colSpan={isSuperAdmin ? 7 : 6} className="p-8 text-center text-nexus-muted text-xs">
                        Loading trashed {activeTab === "admins" ? "admins" : "users"}…
                      </td>
                    </tr>
                  )}
                  {!loading && filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={isSuperAdmin ? 7 : 6} className="p-12 text-center text-nexus-muted text-xs italic">
                        No soft-deleted {activeTab === "admins" ? "admins" : "users"} found matching your search.
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-nexus-hover/30 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center font-bold text-sm">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-bold text-nexus-text">{u.name}</span>
                          </div>
                        </td>
                        <td className="p-4 text-nexus-muted text-xs font-medium">
                          {u.email}
                        </td>
                        {isSuperAdmin && (
                          <td className="p-4 text-nexus-muted text-xs font-medium">
                            {u.company || u.department || "—"}
                          </td>
                        )}
                        <td className="p-4 text-nexus-muted text-xs font-medium">
                          {u.phone || "—"}
                        </td>
                        <td className="p-4 text-nexus-muted text-xs font-medium">
                          {formatDate(u.createdAt)}
                        </td>
                        <td className="p-4 text-nexus-muted text-xs font-medium">
                          {formatDate(u.deletedAt)}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              onClick={() => handleRestoreUser(u)}
                              disabled={actionLoadingId === u.id}
                              className="px-3 py-1.5 text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-colors flex items-center gap-1.5"
                              title="Restore User Account"
                            >
                              {actionLoadingId === u.id ? (
                                <IconLoader2 size={14} className="animate-spin" />
                              ) : (
                                <IconRefresh size={14} />
                              )}
                              Restore
                            </button>

                            <button
                              onClick={() => setConfirmHardDeleteUser(u)}
                              disabled={actionLoadingId === u.id}
                              className="px-3 py-1.5 text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors flex items-center gap-1.5"
                              title="Permanently Delete User from Database"
                            >
                              <IconX size={14} /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab Content: Archived Companies (Super Admin only) */}
        {activeTab === "companies" && isSuperAdmin && (
          <div className="bg-nexus-card border border-nexus-border rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[650px]">
                <thead>
                  <tr className="border-b border-nexus-border text-[11px] uppercase text-nexus-muted font-semibold bg-nexus-bg/50">
                    <th className="p-4">Company Name</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Admins</th>
                    <th className="p-4">Users</th>
                    <th className="p-4">Trashed Date</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-nexus-border">
                  {loading && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-nexus-muted text-xs">
                        Loading trashed companies…
                      </td>
                    </tr>
                  )}
                  {!loading && filteredCompanies.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-nexus-muted text-xs italic">
                        No soft-deleted companies found matching your search.
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    filteredCompanies.map((c) => (
                      <tr key={c.id} className="hover:bg-nexus-hover/30 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center font-bold text-sm">
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-bold text-nexus-text">{c.name}</span>
                          </div>
                        </td>
                        <td className="p-4 text-nexus-muted text-xs font-medium">
                          {c.category || "—"}
                        </td>
                        <td className="p-4 text-nexus-muted text-xs font-medium">
                          {c.adminCount ?? 0}
                        </td>
                        <td className="p-4 text-nexus-muted text-xs font-medium">
                          {c.userCount ?? 0}
                        </td>
                        <td className="p-4 text-nexus-muted text-xs font-medium">
                          {formatDate(c.deletedAt)}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              onClick={() => handleRestoreCompany(c)}
                              disabled={actionLoadingId === c.id}
                              className="px-3 py-1.5 text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-colors flex items-center gap-1.5"
                              title="Restore Company"
                            >
                              {actionLoadingId === c.id ? (
                                <IconLoader2 size={14} className="animate-spin" />
                              ) : (
                                <IconRefresh size={14} />
                              )}
                              Restore
                            </button>

                            <button
                              onClick={() => setConfirmHardDeleteCompany(c)}
                              disabled={actionLoadingId === c.id}
                              className="px-3 py-1.5 text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors flex items-center gap-1.5"
                              title="Permanently Delete Company"
                            >
                              <IconX size={14} /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab Content: Archived Leads */}
        {activeTab === "leads" && (
          <div className="bg-nexus-card border border-nexus-border rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-nexus-border text-[11px] uppercase text-nexus-muted font-semibold bg-nexus-bg/50">
                    <th className="p-4">Lead Name</th>
                    <th className="p-4">Company</th>
                    <th className="p-4">Created Date</th>
                    <th className="p-4">Trashed Date</th>
                    <th className="p-4">Assigned To</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-nexus-border">
                  {loading && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-nexus-muted text-xs">
                        Loading trashed leads…
                      </td>
                    </tr>
                  )}
                  {!loading && filteredLeads.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-nexus-muted text-xs italic">
                        No trashed leads found matching your search.
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    filteredLeads.map((l) => (
                      <tr key={l.id} className="hover:bg-nexus-hover/30 transition-colors">
                        <td className="p-4">
                          <p className="font-bold text-nexus-text">
                            {l.firstName} {l.lastName}
                          </p>
                          <p className="text-xs text-nexus-muted">{l.email}</p>
                        </td>
                        <td className="p-4 text-nexus-muted text-xs">
                          {l.user?.company || l.user?.department || l.company || "—"}
                        </td>
                        <td className="p-4 text-nexus-muted text-xs">{formatDate(l.createdAt)}</td>
                        <td className="p-4 text-nexus-muted text-xs">{formatDate(l.deletedAt)}</td>
                        <td className="p-4 text-nexus-muted text-xs">
                          {l.user ? l.user.name : "Unassigned"}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              onClick={() => handleRestoreLead(l)}
                              disabled={actionLoadingId === l.id}
                              className="px-3 py-1.5 text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-colors flex items-center gap-1.5"
                              title="Restore Lead from Trash"
                            >
                              {actionLoadingId === l.id ? (
                                <IconLoader2 size={14} className="animate-spin" />
                              ) : (
                                <IconUserCheck size={14} />
                              )}
                              Restore
                            </button>

                            {isSuperAdmin && (
                              <button
                                onClick={() => setConfirmHardDeleteLead(l)}
                                disabled={actionLoadingId === l.id}
                                className="px-3 py-1.5 text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors flex items-center gap-1.5"
                                title="Permanently Delete Lead"
                              >
                                <IconX size={14} /> Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Confirmation Modal: Hard Delete User */}
        {confirmHardDeleteUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-nexus-card border border-nexus-border rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
                <IconAlertTriangle size={28} />
              </div>
              <div>
                <h3 className="text-base font-bold text-nexus-text">Permanently Delete User?</h3>
                <p className="text-sm font-bold text-red-400 mt-1">{confirmHardDeleteUser.name}</p>
                <p className="text-xs text-nexus-muted mt-2">
                  This action cannot be undone. All database records for this account will be erased forever.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setConfirmHardDeleteUser(null)}
                  className="flex-1 px-4 py-2 text-xs font-semibold text-nexus-muted border border-nexus-border rounded-xl hover:bg-nexus-hover"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handlePermanentDeleteUser(confirmHardDeleteUser)}
                  className="flex-1 px-4 py-2 text-xs font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl shadow-lg shadow-red-500/25"
                >
                  Delete Forever
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal: Hard Delete Lead */}
        {confirmHardDeleteLead && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-nexus-card border border-nexus-border rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
                <IconAlertTriangle size={28} />
              </div>
              <div>
                <h3 className="text-base font-bold text-nexus-text">Permanently Delete Lead?</h3>
                <p className="text-sm font-bold text-red-400 mt-1">
                  {confirmHardDeleteLead.firstName} {confirmHardDeleteLead.lastName}
                </p>
                <p className="text-xs text-nexus-muted mt-2">
                  This action cannot be undone. All lead data and deal history will be erased forever.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setConfirmHardDeleteLead(null)}
                  className="flex-1 px-4 py-2 text-xs font-semibold text-nexus-muted border border-nexus-border rounded-xl hover:bg-nexus-hover"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handlePermanentDeleteLead(confirmHardDeleteLead)}
                  className="flex-1 px-4 py-2 text-xs font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl shadow-lg shadow-red-500/25"
                >
                  Delete Forever
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal: Hard Delete Company */}
        {confirmHardDeleteCompany && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-nexus-card border border-nexus-border rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
                <IconAlertTriangle size={28} />
              </div>
              <div>
                <h3 className="text-base font-bold text-nexus-text">Permanently Delete Company?</h3>
                <p className="text-sm font-bold text-red-400 mt-1">{confirmHardDeleteCompany.name}</p>
                <p className="text-xs text-nexus-muted mt-2">
                  This action cannot be undone. Associated admins and users will be unlinked, and all company data will be erased forever.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setConfirmHardDeleteCompany(null)}
                  className="flex-1 px-4 py-2 text-xs font-semibold text-nexus-muted border border-nexus-border rounded-xl hover:bg-nexus-hover"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handlePermanentDeleteCompany(confirmHardDeleteCompany)}
                  className="flex-1 px-4 py-2 text-xs font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl shadow-lg shadow-red-500/25"
                >
                  Delete Forever
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </PermissionGuard>
  );
}
