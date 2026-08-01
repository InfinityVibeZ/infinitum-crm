"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  IconUserShield,
  IconUserPlus,
  IconSearch,
  IconEdit,
  IconTrash,
  IconX,
  IconCheck,
  IconCopy,
  IconEye,
  IconRefresh,
  IconKey,
  IconCrown,
  IconShieldCheck,
  IconBan,
  IconUsers,
  IconBuilding,
  IconAlertTriangle,
  IconArchive,
  IconPhoneCall,
  IconLoader2,
} from "@tabler/icons-react";
import { useAuthStore } from "@/store/auth";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { SuccessPopup } from "@/components/common/SuccessPopup";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "USER";
  status: "ACTIVE" | "INACTIVE" | "PENDING";
  department?: string;
  company?: string;
  companyId?: string;
  category?: string;
  phone?: string;
  createdBy?: string;
  lastLogin?: string;
  createdAt: string;
  isActive: boolean;
  isInvitationExpired?: boolean;
}

interface CompanyItem {
  id: string;
  name: string;
  category?: string;
  status: "ACTIVE" | "INACTIVE";
  isActive: boolean;
}

function formatDate(d?: string) {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function formatDateTime(d?: string) {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
  INACTIVE: "text-gray-400 bg-gray-500/10 border-gray-500/25",
  PENDING: "text-amber-400 bg-amber-500/10 border-amber-500/25",
  EXPIRED: "text-rose-400 bg-rose-500/10 border-rose-500/25",
};

function getAdminStatusLabel(a: { status: string; isInvitationExpired?: boolean }): string {
  if (a.status === "PENDING" && a.isInvitationExpired) return "INVITATION EXPIRED";
  return a.status;
}

function getAdminStatusColor(a: { status: string; isInvitationExpired?: boolean }): string {
  if (a.status === "PENDING" && a.isInvitationExpired) return STATUS_COLOR.EXPIRED;
  return STATUS_COLOR[a.status] || STATUS_COLOR.ACTIVE;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminManagementPage() {
  const { user: me } = useAuthStore();
  
  // Data state
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [companyFilter, setCompanyFilter] = useState("ALL");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Modals & view targets
  const [viewUser, setViewUser] = useState<AdminUser | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<AdminUser | null>(null);
  const [confirmActivate, setConfirmActivate] = useState<AdminUser | null>(null);
  const [confirmSoftDeleteAdmin, setConfirmSoftDeleteAdmin] = useState<AdminUser | null>(null);
  const [showTrashModal, setShowTrashModal] = useState(false);
  const [trashedAdmins, setTrashedAdmins] = useState<AdminUser[]>([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Admin Form state
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [editAdminTarget, setEditAdminTarget] = useState<AdminUser | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formCompanyId, setFormCompanyId] = useState("");
  const [formCompanyName, setFormCompanyName] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formRole, setFormRole] = useState<"ADMIN" | "SUPER_ADMIN">("ADMIN");
  const [setupLink, setSetupLink] = useState("");
  const [savingAdmin, setSavingAdmin] = useState(false);

  function toast$(msg: string, type: "success" | "error") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  const token = () =>
    typeof window !== "undefined" ? localStorage.getItem("nexus-token") || "" : "";

  // ── Fetch Data ────────────────────────────────────────────────────────────

  const fetchAdmins = useCallback(async () => {
    try {
      const res = await fetch("/api/users", {
        headers: { Authorization: `Bearer ${token()}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setAdmins(data.filter((u: AdminUser) => u.role === "SUPER_ADMIN" || u.role === "ADMIN"));
        setAllUsers(data.filter((u: AdminUser) => u.role === "USER"));
      }
    } catch {
      toast$("Failed to load admins", "error");
    }
  }, []);

  const fetchCompanies = useCallback(async () => {
    try {
      const res = await fetch("/api/companies", {
        headers: { Authorization: `Bearer ${token()}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setCompanies(data);
      }
    } catch {
      toast$("Failed to load companies", "error");
    }
  }, []);

  const fetchTrashedAdmins = useCallback(async () => {
    setTrashLoading(true);
    try {
      const res = await fetch("/api/users?deleted=true", {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setTrashedAdmins(data);
      } else if (data.allUsers && Array.isArray(data.allUsers)) {
        setTrashedAdmins(data.allUsers.filter((u: any) => u.isDeleted));
      }
    } catch (_) {
    } finally {
      setTrashLoading(false);
    }
  }, []);

  function openTrashModal() {
    setShowTrashModal(true);
    fetchTrashedAdmins();
  }

  async function handleRestoreAdmin(a: AdminUser) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/users/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ action: "restore" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to restore account");
      toast$(`"${a.name}" restored successfully`, "success");
      fetchTrashedAdmins();
      loadAll(true);
    } catch (e) {
      toast$(e instanceof Error ? e.message : "Error restoring account", "error");
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePermanentDeleteAdmin(a: AdminUser) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/users/${a.id}?hard=true`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete account");
      toast$(`"${a.name}" permanently deleted`, "success");
      fetchTrashedAdmins();
      loadAll(true);
    } catch (e) {
      toast$(e instanceof Error ? e.message : "Error deleting account", "error");
    } finally {
      setActionLoading(false);
    }
  }

  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    await Promise.all([fetchAdmins(), fetchCompanies(), fetchTrashedAdmins()]);
    if (!silent) setLoading(false);
  }, [fetchAdmins, fetchCompanies, fetchTrashedAdmins]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Filtered admins & counts ─────────────────────────────────────────────
  const activeCompanies = (companies || []).filter((c) => c && c.isActive && c.status === "ACTIVE");

  const filteredAdmins = (admins || []).filter((a) => {
    if (!a) return false;
    const q = (search || "").toLowerCase().trim();
    const nameStr = (a.name || "").toLowerCase();
    const emailStr = (a.email || "").toLowerCase();
    const companyStr = (a.company || a.department || "").toLowerCase();
    const catStr = (a.category || "").toLowerCase();
    const roleStr = (a.role || "").toLowerCase();
    const phoneStr = (a.phone || "").toLowerCase();

    const matchSearch =
      !q ||
      nameStr.includes(q) ||
      emailStr.includes(q) ||
      companyStr.includes(q) ||
      catStr.includes(q) ||
      roleStr.includes(q) ||
      phoneStr.includes(q);

    const matchCompany =
      companyFilter === "ALL" ||
      a.companyId === companyFilter ||
      a.company === companyFilter;

    const matchStatus =
      statusFilter === "ALL" ||
      (statusFilter === "ACTIVE" ? Boolean(a.isActive) : !a.isActive);

    return matchSearch && matchCompany && matchStatus;
  });

  const superCount = (admins || []).filter((a) => a && a.role === "SUPER_ADMIN").length;
  const adminCount = (admins || []).filter((a) => a && a.role === "ADMIN").length;
  const activeAdminCount = (admins || []).filter((a) => a && a.isActive).length;
  const inactiveAdminCount = (admins || []).filter((a) => a && !a.isActive).length;

  const [resendingId, setResendingId] = useState<string | null>(null);

  async function handleResendInvitation(adminUser: AdminUser) {
    setResendingId(adminUser.id);
    try {
      const res = await fetch(`/api/users/${adminUser.id}/resend-invitation`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resend invitation");
      toast$(`Activation link resent to ${adminUser.email}`, "success");
      fetchAdmins();
    } catch (e) {
      toast$(e instanceof Error ? e.message : "Error resending invitation", "error");
    } finally {
      setResendingId(null);
    }
  }

  // ── Admin Modal Handlers ──────────────────────────────────────────────────

  function openCreateAdmin() {
    setEditAdminTarget(null);
    setFormName(""); setFormEmail(""); setFormPhone("");
    setFormCompanyId(""); setFormCompanyName(""); setFormCategory("");
    setFormRole("ADMIN"); setSetupLink("");
    setShowAdminForm(true);
  }

  function openEditAdmin(a: AdminUser) {
    setEditAdminTarget(a);
    setFormName(a.name); setFormEmail(a.email);
    setFormPhone(a.phone || "");
    setFormCompanyId(a.companyId || "");
    const matchedComp = (companies || []).find((c) => c && (c.id === a.companyId || (c.name || "").toLowerCase() === (a.company || "").toLowerCase()));
    const realCompName = matchedComp?.name || a.company || a.department || "";
    setFormCompanyName(realCompName);
    const compCat = a.category || matchedComp?.category || "General";
    setFormCategory(compCat);
    setFormRole(a.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN");
    setSetupLink("");
    setShowAdminForm(true);
  }

  async function handleSaveAdmin() {
    if (!formName.trim() || !formEmail.trim()) {
      toast$("Name and email are required", "error");
      return;
    }

    const cleanPhone = formPhone.replace(/[^0-9+\-\s()]/g, "").slice(0, 15);

    setSavingAdmin(true);
    try {
      const matchedComp = companies.find((c) => c.id === formCompanyId);
      let companyVal = matchedComp ? matchedComp.name : formCompanyName;
      let companyIdVal = formCompanyId || undefined;
      let roleVal = formRole;
      let categoryVal = formCategory || (matchedComp ? matchedComp.category : "General");

      if (editAdminTarget !== null) {
        // Strict Anti-Bypass: Lock company, email, role, and category when editing existing admin
        companyVal = editAdminTarget.company || editAdminTarget.department || "";
        companyIdVal = editAdminTarget.companyId || undefined;
        roleVal = editAdminTarget.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN";
        categoryVal = editAdminTarget.category || (companies.find((c) => c.id === editAdminTarget.companyId || c.name === editAdminTarget.company)?.category) || categoryVal;
      }

      const body = {
        name: formName,
        email: editAdminTarget ? editAdminTarget.email : formEmail,
        phone: formPhone,
        company: companyVal,
        companyId: companyIdVal,
        department: companyVal,
        category: categoryVal,
        role: roleVal,
        status: "ACTIVE",
      };

      if (!editAdminTarget) {
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create");
        toast$(`Admin "${formName}" created successfully. Activation link sent to ${formEmail}`, "success");
        loadAll(true);
        setShowAdminForm(false);
      } else {
        const res = await fetch(`/api/users/${editAdminTarget.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update");
        toast$(`"${formName}" updated successfully`, "success");
        loadAll(true);
        setShowAdminForm(false);
      }
    } catch (e) {
      toast$(e instanceof Error ? e.message : "Error saving", "error");
    } finally {
      setSavingAdmin(false);
    }
  }

  // ── Soft Delete Admin ───────────────────────────────────────────────────

  async function handleSoftDeleteAdmin(a: AdminUser) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/users/${a.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast$(`"${a.name}" moved to Trash / Archive`, "success");
      setConfirmSoftDeleteAdmin(null);
      loadAll(true);
    } catch (e) {
      toast$(e instanceof Error ? e.message : "Error archiving admin", "error");
    } finally {
      setActionLoading(false);
    }
  }

  // ── Deactivate Admin ────────────────────────────────────────────────────

  async function handleConfirmDeactivate(a: AdminUser) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/users/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ action: "toggle-status" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const cascadeMsg = data.cascadeCount > 0
        ? ` (and ${data.cascadeCount} user${data.cascadeCount !== 1 ? "s" : ""} under this admin)`
        : "";
      toast$(`"${a.name}" access revoked${cascadeMsg}`, "success");
      setConfirmDeactivate(null);
      loadAll(true);
    } catch (e) {
      toast$(e instanceof Error ? e.message : "Error deactivating admin", "error");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReactivateAdmin(a: AdminUser) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/users/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ action: "toggle-status" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast$(`"${a.name}" access restored`, "success");
      setConfirmActivate(null);
      loadAll(true);
    } catch (e) {
      toast$(e instanceof Error ? e.message : "Error reactivating admin", "error");
    } finally {
      setActionLoading(false);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────

  return (
    <PermissionGuard roles={["SUPER_ADMIN"]}>
      <div className="space-y-6 text-nexus-text">

        {/* Success confirmation shows as a centered popup; errors stay as a corner toast */}
        {toast && toast.type === "success" && (
          <SuccessPopup message={toast.msg} type="success" onClose={() => setToast(null)} />
        )}
        {toast && toast.type === "error" && (
          <div className="fixed top-5 right-5 z-[60] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl text-sm font-semibold animate-in slide-in-from-top-2 bg-red-950/90 border-red-500/40 text-red-300">
            <IconX size={16} />
            {toast.msg}
          </div>
        )}

        {/* ── PAGE HEADER ─────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-red-500/20 to-red-600/10 rounded-xl border border-red-500/20">
                <IconUserShield size={22} className="text-red-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-nexus-text">Admin Management</h1>
                <p className="text-sm text-nexus-muted mt-0.5">
                  Manage Super Admin and Admin credentials, assign companies, and control access permissions
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => loadAll()} className="p-2 rounded-lg border border-nexus-border text-nexus-muted hover:text-nexus-text hover:bg-nexus-hover transition-colors" title="Refresh">
              <IconRefresh size={16} />
            </button>

            <button
              onClick={openCreateAdmin}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white text-sm font-bold rounded-lg hover:from-red-400 hover:to-red-500 transition-all shadow-lg shadow-red-500/25"
            >
              <IconUserPlus size={16} />
              Add Admin
            </button>
          </div>
        </div>

        {/* ── STAT CARDS ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
          <div className="p-4 rounded-xl border border-nexus-border bg-nexus-card flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center flex-shrink-0 text-orange-400">
              <IconUsers size={18} />
            </div>
            <div>
              <p className="text-[10px] text-nexus-muted font-semibold uppercase tracking-wide">Total Admins</p>
              <p className="text-xl font-black text-orange-400">{admins.length}</p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-nexus-border bg-nexus-card flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0 text-red-400">
              <IconCrown size={18} />
            </div>
            <div>
              <p className="text-[10px] text-nexus-muted font-semibold uppercase tracking-wide">Super Admins</p>
              <p className="text-xl font-black text-red-400">{superCount}</p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-nexus-border bg-nexus-card flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0 text-purple-400">
              <IconUserShield size={18} />
            </div>
            <div>
              <p className="text-[10px] text-nexus-muted font-semibold uppercase tracking-wide">Admins</p>
              <p className="text-xl font-black text-purple-400">{adminCount}</p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-nexus-border bg-nexus-card flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0 text-emerald-400">
              <IconShieldCheck size={18} />
            </div>
            <div>
              <p className="text-[10px] text-nexus-muted font-semibold uppercase tracking-wide">Active Admins</p>
              <p className="text-xl font-black text-emerald-400">{activeAdminCount}</p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-nexus-border bg-nexus-card flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0 text-amber-400">
              <IconX size={18} />
            </div>
            <div>
              <p className="text-[10px] text-nexus-muted font-semibold uppercase tracking-wide">Inactive Admins</p>
              <p className="text-xl font-black text-amber-400">{inactiveAdminCount}</p>
            </div>
          </div>
        </div>

        {/* ── SEARCH & FILTERS TOOLBAR ───────────────────────────────────── */}
        <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center bg-nexus-card p-3.5 border border-nexus-border rounded-xl shadow-sm">
          {/* Search by any input */}
          <div className="relative flex-1 min-w-[240px]">
            <IconSearch size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-nexus-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by any (name, email, company, role, category)..."
              className="w-full pl-10 pr-3.5 py-2 text-sm bg-nexus-bg border border-nexus-border rounded-lg text-nexus-text placeholder-nexus-muted focus:outline-none focus:border-nexus-primary transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Company filter */}
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="px-3.5 py-2 text-sm bg-nexus-bg border border-nexus-border rounded-lg text-nexus-text focus:outline-none focus:border-nexus-primary transition-all font-medium"
            >
              <option value="ALL">All Companies</option>
              {(activeCompanies || []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3.5 py-2 text-sm bg-nexus-bg border border-nexus-border rounded-lg text-nexus-text focus:outline-none focus:border-nexus-primary transition-all font-medium"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>

            <span className="text-xs font-semibold text-nexus-muted whitespace-nowrap pl-1">
              {filteredAdmins.length} of {admins.length} admins
            </span>
          </div>
        </div>

        {/* ── ADMINS TABLE ────────────────────────────────────────────────── */}
        <div className="bg-nexus-card border border-nexus-border rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[750px]">
              <thead>
                <tr className="border-b border-nexus-border text-[11px] uppercase text-nexus-muted font-semibold bg-nexus-bg/40">
                  <th className="px-5 py-3">Admin</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Company & Category</th>
                  <th className="px-5 py-3">Phone</th>
                  <th className="px-5 py-3">Status</th>
                  {/* <th className="px-5 py-3">Users</th> */}
                  <th className="px-5 py-3">Last Login</th>
                  <th className="px-5 py-3">Created On</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nexus-border">
                {loading && (
                  <tr><td colSpan={8} className="p-10 text-center">
                    <div className="flex justify-center"><div className="w-6 h-6 border-2 border-nexus-primary border-t-transparent rounded-full animate-spin" /></div>
                  </td></tr>
                )}
                {!loading && filteredAdmins.length === 0 && (
                  <tr><td colSpan={8} className="p-14 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <IconUsers size={32} className="text-nexus-muted opacity-40" />
                      <p className="text-sm text-nexus-muted">No admins found matching criteria</p>
                    </div>
                  </td></tr>
                )}
                {!loading && filteredAdmins.map((a) => {
                  const isMe = a.id === me?.id;
                  const isSuper = a.role === "SUPER_ADMIN";
                  const companyDisplay = a.company || a.department || "—";
                  const matchedComp = (companies || []).find((c) => c && (c.id === a.companyId || (c.name || "").toLowerCase() === (a.company || "").toLowerCase()));
                  const catDisplay = a.category || matchedComp?.category || "General";
                  const initialChar = (a.name || "A").charAt(0).toUpperCase();
                  const companyIsDeactivated = matchedComp ? !matchedComp.isActive : false;

                  // Per-admin user counts (users strictly created by this admin)
                  const adminUsers = allUsers.filter((u) => u.createdBy === a.id);
                  const activeUserCount = adminUsers.filter((u) => u.isActive).length;
                  const inactiveUserCount = adminUsers.filter((u) => !u.isActive).length;
                  const totalUserCount = adminUsers.length;

                  return (
                    <tr key={a.id} className={`hover:bg-nexus-hover/40 transition-colors ${!a.isActive ? "opacity-60 bg-red-500/5" : ""}`}>
                      <td className="px-5 py-4">
                        <div>
                          <p className="font-semibold text-nexus-text text-[13px] flex items-center gap-1.5">
                            {a.name || "—"}
                            {isMe && <span className="text-[10px] text-nexus-primary bg-nexus-primary/10 px-1.5 py-0.5 rounded">You</span>}
                          </p>
                          <p className="text-[11px] text-nexus-muted">{a.email}</p>
                        </div>
                      </td>

                      {/* Role Badge Column */}
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${
                          isSuper
                            ? "bg-red-500/10 text-red-400 border-red-500/20"
                            : "bg-orange-500/10 text-orange-400 border-orange-500/20"
                        }`}>
                          {isSuper ? <IconCrown size={12} /> : <IconUserShield size={12} />}
                          {isSuper ? "SUPER ADMIN" : "ADMIN"}
                        </span>
                      </td>

                      {/* Combined Company & Category Column */}
                      <td className="px-5 py-4">
                        {isSuper ? (
                          <span className="text-xs text-nexus-muted">—</span>
                        ) : (
                          <>
                            <p className="font-semibold text-nexus-text text-xs">{companyDisplay}</p>
                            <p className="text-[10px] text-nexus-muted mt-0.5">{catDisplay}</p>
                          </>
                        )}
                      </td>

                      <td className="px-5 py-4 text-xs font-medium text-nexus-text">
                        {a.phone || "—"}
                      </td>

                      <td className="px-5 py-4">
                        <span className={`inline-flex text-[11px] font-bold px-2.5 py-1 rounded-full border ${getAdminStatusColor(a)}`}>
                          {getAdminStatusLabel(a)}
                        </span>
                      </td>

                      {/* Per-admin user count (Commented out) */}
                      {/* <td className="px-5 py-4">
                        {totalUserCount > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-black text-nexus-text">{totalUserCount}</span>
                            <div className="flex items-center gap-1 text-[11px] font-bold mt-0.5">
                              <span className="text-emerald-400">{activeUserCount}</span>
                              <span className="text-nexus-muted">•</span>
                              <span className="text-amber-400">{inactiveUserCount}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-nexus-muted">0</span>
                        )}
                      </td> */}

                      <td className="px-5 py-4 text-xs text-nexus-muted">{formatDateTime(a.lastLogin)}</td>
                      <td className="px-5 py-4 text-xs text-nexus-muted">{formatDate(a.createdAt)}</td>

                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => setViewUser(a)}
                            className="p-1.5 rounded-md text-nexus-muted hover:text-nexus-primary hover:bg-nexus-primary/10 transition-colors"
                            title="View Details"
                          >
                            <IconEye size={15} />
                          </button>
                          <button
                            onClick={() => openEditAdmin(a)}
                            className="p-1.5 rounded-md text-nexus-muted hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
                            title="Edit Admin"
                          >
                            <IconEdit size={15} />
                          </button>

                          {a.status === "PENDING" && (
                            <button
                              onClick={() => handleResendInvitation(a)}
                              disabled={resendingId === a.id}
                              className="p-1.5 rounded-md text-amber-400 hover:bg-amber-500/10 transition-colors disabled:opacity-50"
                              title="Resend Setup Link"
                            >
                              {resendingId === a.id ? (
                                <IconLoader2 size={15} className="animate-spin" />
                              ) : (
                                <IconKey size={15} />
                              )}
                            </button>
                          )}

                          {!isMe && (
                            a.isActive ? (
                              /* Active → show X/cross icon (click opens deactivate confirm popup) */
                              <button
                                onClick={() => setConfirmDeactivate(a)}
                                className="p-1.5 rounded-md text-nexus-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Deactivate Admin"
                              >
                                <IconX size={15} />
                              </button>
                            ) : (
                              /* Inactive → show Check icon (click opens activate confirm popup) */
                              !companyIsDeactivated ? (
                                <button
                                  onClick={() => setConfirmActivate(a)}
                                  className="p-1.5 rounded-md text-nexus-muted hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                                  title="Activate Admin"
                                >
                                  <IconCheck size={15} />
                                </button>
                              ) : (
                                <button
                                  disabled
                                  className="p-1.5 rounded-md text-nexus-muted/30 cursor-not-allowed"
                                  title="Company is inactive — activate company first"
                                >
                                  <IconCheck size={15} />
                                </button>
                              )
                            )
                          )}

                          {!isMe && (
                            <button
                              onClick={() => setConfirmSoftDeleteAdmin(a)}
                              className="p-1.5 rounded-md text-nexus-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title="Delete"
                            >
                              <IconTrash size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── CREATE / EDIT ADMIN MODAL ───────────────────────────────────── */}
        {showAdminForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-nexus-card border border-nexus-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-5 border-b border-nexus-border">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/10 border border-red-500/20 flex items-center justify-center text-red-400 flex-shrink-0 shadow-sm">
                    {editAdminTarget ? <IconEdit size={19} /> : <IconUserPlus size={19} />}
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-base font-bold text-nexus-text leading-tight">
                      {editAdminTarget ? `Edit: ${editAdminTarget.name}` : "Add New Admin"}
                    </h2>
                    {editAdminTarget ? (
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-nexus-muted font-medium">Company:</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-nexus-primary/10 text-nexus-primary border border-nexus-primary/20">
                          <IconBuilding size={12} />
                          {(companies || []).find((c) => c && c.id === editAdminTarget.companyId)?.name || editAdminTarget.company || editAdminTarget.department || "N/A"}
                        </span>
                      </div>
                    ) : (
                      <p className="text-xs text-nexus-muted font-medium">
                        Create an Admin account
                      </p>
                    )}
                  </div>
                </div>
                <button onClick={() => setShowAdminForm(false)} className="p-2 text-nexus-muted hover:text-nexus-text hover:bg-nexus-hover rounded-lg transition-colors"><IconX size={18} /></button>
              </div>

                  <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-nexus-text-secondary mb-1 block">Full Name *</label>
                        <input value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full px-3 py-2 text-sm bg-nexus-bg border border-nexus-border rounded-lg text-nexus-text focus:outline-none focus:border-nexus-primary font-medium" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-nexus-text-secondary mb-1 block">Email *</label>
                        <input
                          type="email"
                          value={formEmail}
                          onChange={(e) => setFormEmail(e.target.value)}
                          readOnly={editAdminTarget !== null}
                          className={`w-full px-3 py-2 text-sm border rounded-lg text-nexus-text focus:outline-none ${
                            editAdminTarget !== null
                              ? "bg-nexus-hover border-nexus-border text-nexus-muted cursor-not-allowed font-medium"
                              : "bg-nexus-bg border-nexus-border focus:border-nexus-primary font-medium"
                          }`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-nexus-text-secondary mb-1 block">Phone Number</label>
                      <input
                        type="text"
                        inputMode="tel"
                        maxLength={15}
                        value={formPhone}
                        onChange={(e) => setFormPhone(e.target.value.replace(/[^0-9+\-\s()]/g, "").slice(0, 15))}
                        className="w-full px-3 py-2 text-sm bg-nexus-bg border border-nexus-border rounded-lg text-nexus-text focus:outline-none focus:border-nexus-primary font-mono tracking-wider"
                      />
                    </div>

                    {!editAdminTarget && (
                      <div>
                        <label className="text-xs font-semibold text-nexus-text-secondary mb-1 block">Company *</label>
                        <select
                          value={formCompanyId}
                          onChange={(e) => {
                            const selectedId = e.target.value;
                            setFormCompanyId(selectedId);
                            const matched = activeCompanies.find((c) => c.id === selectedId);
                            if (matched) {
                              setFormCompanyName(matched.name);
                              setFormCategory(matched.category || "General");
                            } else {
                              setFormCompanyName("");
                              setFormCategory("");
                            }
                          }}
                          className="w-full px-3 py-2 text-sm bg-nexus-bg border border-nexus-border rounded-lg text-nexus-text focus:outline-none focus:border-nexus-primary font-medium"
                        >
                          <option value="">Select Company</option>
                          {activeCompanies.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end gap-3 px-6 py-4 border-t border-nexus-border">
                    <button onClick={() => setShowAdminForm(false)} disabled={savingAdmin} className="px-4 py-2 text-sm font-semibold text-nexus-muted border border-nexus-border rounded-lg hover:bg-nexus-hover disabled:opacity-50">Cancel</button>
                    <button onClick={handleSaveAdmin} disabled={savingAdmin} className="px-5 py-2 text-sm font-bold bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-400 hover:to-red-500 shadow-lg shadow-red-500/20 disabled:opacity-60 flex items-center justify-center gap-2">
                      {savingAdmin && <IconLoader2 size={16} className="animate-spin" />}
                      {savingAdmin ? "Saving…" : editAdminTarget ? "Save Changes" : "Create Admin"}
                    </button>
                  </div>
                </div>
              </div>
            )}

        {/* ── CONFIRM SOFT DELETE ADMIN MODAL ────────────────────────────── */}
        {confirmSoftDeleteAdmin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-nexus-card border border-nexus-border rounded-2xl w-full max-w-sm shadow-2xl">
              <div className="p-6 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto">
                  <IconTrash size={24} className="text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-nexus-text">Move Admin to Trash?</h3>
                  <p className="text-base font-bold text-nexus-text mt-2">{confirmSoftDeleteAdmin.name}</p>
                </div>
              </div>
              <div className="flex gap-3 px-6 pb-6">
                <button onClick={() => setConfirmSoftDeleteAdmin(null)} disabled={actionLoading} className="flex-1 px-4 py-2.5 text-sm font-semibold text-nexus-muted border border-nexus-border rounded-xl hover:bg-nexus-hover disabled:opacity-50">
                  Cancel
                </button>
                <button
                  onClick={() => handleSoftDeleteAdmin(confirmSoftDeleteAdmin)}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2.5 text-sm font-bold bg-amber-500 text-black rounded-xl hover:bg-amber-400 shadow-lg shadow-amber-500/25 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {actionLoading && <IconLoader2 size={16} className="animate-spin" />}
                  {actionLoading ? "Processing…" : "Move to Trash"}
                </button>
              </div>
            </div>
          </div>
        )}

        {confirmDeactivate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-nexus-card border border-nexus-border rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-nexus-border">
                <div className="flex items-center gap-2.5 text-amber-400">
                  <IconAlertTriangle size={18} />
                  <h3 className="text-sm font-bold text-nexus-text">Deactivate Admin</h3>
                </div>
                <button onClick={() => setConfirmDeactivate(null)} className="p-1.5 text-nexus-muted hover:text-nexus-text hover:bg-nexus-hover rounded-lg transition-colors">
                  <IconX size={16} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 p-3 bg-nexus-bg rounded-xl border border-nexus-border">
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-sm font-bold text-amber-400 flex-shrink-0">
                    {(confirmDeactivate.name || "A").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-nexus-text">{confirmDeactivate.name}</p>
                    <p className="text-[11px] text-nexus-muted">{confirmDeactivate.email}</p>
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wide">{confirmDeactivate.role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}</span>
                  </div>
                </div>
                <p className="text-xs text-nexus-muted leading-relaxed">
                  Deactivating this admin will <span className="text-amber-400 font-semibold">revoke their access</span>. Users created under this admin may also be affected.
                </p>
              </div>

              {/* Footer */}
              <div className="flex gap-3 px-6 pb-6">
                <button onClick={() => setConfirmDeactivate(null)} disabled={actionLoading} className="flex-1 px-4 py-2.5 text-sm font-semibold text-nexus-muted border border-nexus-border rounded-xl hover:bg-nexus-hover transition-colors disabled:opacity-50">
                  Cancel
                </button>
                <button
                  onClick={() => handleConfirmDeactivate(confirmDeactivate)}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2.5 text-sm font-bold bg-amber-500 text-black rounded-xl hover:bg-amber-400 shadow-lg shadow-amber-500/20 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {actionLoading && <IconLoader2 size={16} className="animate-spin" />}
                  {actionLoading ? "Deactivating…" : "Deactivate"}
                </button>
              </div>
            </div>
          </div>
        )}

        {confirmActivate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-nexus-card border border-nexus-border rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-nexus-border">
                <div className="flex items-center gap-2.5 text-emerald-400">
                  <IconShieldCheck size={18} />
                  <h3 className="text-sm font-bold text-nexus-text">Activate Admin</h3>
                </div>
                <button onClick={() => setConfirmActivate(null)} className="p-1.5 text-nexus-muted hover:text-nexus-text hover:bg-nexus-hover rounded-lg transition-colors">
                  <IconX size={16} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 p-3 bg-nexus-bg rounded-xl border border-nexus-border">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-sm font-bold text-emerald-400 flex-shrink-0">
                    {(confirmActivate.name || "A").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-nexus-text">{confirmActivate.name}</p>
                    <p className="text-[11px] text-nexus-muted">{confirmActivate.email}</p>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide">{confirmActivate.role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}</span>
                  </div>
                </div>
                <p className="text-xs text-nexus-muted leading-relaxed">
                  Activating this admin will <span className="text-emerald-400 font-semibold">restore their account access</span> and allow them to manage their assigned company.
                </p>
              </div>

              {/* Footer */}
              <div className="flex gap-3 px-6 pb-6">
                <button onClick={() => setConfirmActivate(null)} disabled={actionLoading} className="flex-1 px-4 py-2.5 text-sm font-semibold text-nexus-muted border border-nexus-border rounded-xl hover:bg-nexus-hover transition-colors disabled:opacity-50">
                  Cancel
                </button>
                <button
                  onClick={() => handleReactivateAdmin(confirmActivate)}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2.5 text-sm font-bold bg-emerald-500 text-black rounded-xl hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {actionLoading && <IconLoader2 size={16} className="animate-spin" />}
                  {actionLoading ? "Activating…" : "Activate"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── VIEW USER MODAL ─────────────────────────────────────────────── */}
        {viewUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-nexus-card border border-nexus-border rounded-2xl w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between px-6 py-5 border-b border-nexus-border">
                <h2 className="text-base font-bold text-nexus-text">Admin Details</h2>
                <button onClick={() => setViewUser(null)} className="p-2 text-nexus-muted hover:text-nexus-text hover:bg-nexus-hover rounded-lg transition-colors"><IconX size={18} /></button>
              </div>
              <div className="p-6 space-y-5">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold ${
                    viewUser.role === "SUPER_ADMIN" ? "bg-red-500/15 text-red-400" : "bg-orange-500/15 text-orange-400"
                  }`}>
                    {(viewUser.name || "A").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-nexus-text truncate">{viewUser.name || "—"}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        viewUser.role === "SUPER_ADMIN" ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                      }`}>
                        {viewUser.role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}
                      </span>
                    </div>
                    <p className="text-xs text-nexus-muted truncate">{viewUser.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 p-4 bg-nexus-bg border border-nexus-border rounded-xl">
                  <div>
                    <p className="text-[10px] text-nexus-muted font-semibold uppercase tracking-wider mb-0.5">Account Status</p>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${
                      viewUser.status === "PENDING"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : viewUser.isActive
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-red-500/10 text-red-400 border border-red-500/20"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        viewUser.status === "PENDING" ? "bg-amber-400" : viewUser.isActive ? "bg-emerald-400" : "bg-red-400"
                      }`} />
                      {viewUser.status === "PENDING" ? "Pending Setup" : viewUser.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div>
                    <p className="text-[10px] text-nexus-muted font-semibold uppercase tracking-wider mb-0.5">Company</p>
                    <p className="text-xs font-bold text-nexus-text truncate">
                      {(companies || []).find((c) => c && c.id === viewUser.companyId)?.name || viewUser.company || viewUser.department || "N/A"}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] text-nexus-muted font-semibold uppercase tracking-wider mb-0.5">Phone Number</p>
                    <p className="text-xs font-mono font-semibold text-nexus-text">{viewUser.phone || "—"}</p>
                  </div>

                  <div>
                    <p className="text-[10px] text-nexus-muted font-semibold uppercase tracking-wider mb-0.5">Category</p>
                    <p className="text-xs font-semibold text-nexus-text">
                      {viewUser.category || ((companies || []).find((c) => c && (c.id === viewUser.companyId || (c.name || "").toLowerCase() === (viewUser.company || "").toLowerCase()))?.category) || "General"}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] text-nexus-muted font-semibold uppercase tracking-wider mb-0.5">Last Login</p>
                    <p className="text-xs font-medium text-nexus-text">{formatDateTime(viewUser.lastLogin)}</p>
                  </div>

                  <div>
                    <p className="text-[10px] text-nexus-muted font-semibold uppercase tracking-wider mb-0.5">Created Date</p>
                    <p className="text-xs font-medium text-nexus-text">{formatDate(viewUser.createdAt)}</p>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-nexus-border">
                <button onClick={() => setViewUser(null)} className="px-4 py-2 text-sm font-semibold text-nexus-muted border border-nexus-border rounded-lg hover:bg-nexus-hover">Close</button>
              </div>
            </div>
          </div>
        )}

      {/* Trash / Archive Modal */}
      {showTrashModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-nexus-card border border-nexus-border rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-nexus-border">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-red-500/10 text-red-400">
                  <IconTrash size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-nexus-text">Archive</h2>
                  <p className="text-xs text-nexus-muted">Deleted users and admin accounts</p>
                </div>
              </div>
              <button
                onClick={() => setShowTrashModal(false)}
                className="p-2 text-nexus-muted hover:text-nexus-text hover:bg-nexus-hover rounded-lg transition-colors"
              >
                <IconX size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {trashLoading ? (
                <div className="p-8 text-center text-xs text-nexus-muted">Loading trashed items…</div>
              ) : trashedAdmins.length === 0 ? (
                <div className="p-12 text-center text-nexus-muted italic text-xs border border-dashed border-nexus-border rounded-xl">
                  No trashed or deleted accounts found.
                </div>
              ) : (
                <div className="border border-nexus-border rounded-xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-nexus-border text-[11px] uppercase text-nexus-muted font-semibold bg-nexus-bg/40">
                        <th className="p-3 pl-4">Account</th>
                        <th className="p-3">Role</th>
                        <th className="p-3">Company</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-nexus-border text-xs">
                      {trashedAdmins.map((a) => (
                        <tr key={a.id} className="hover:bg-nexus-hover/30">
                          <td className="p-3 pl-4">
                            <p className="font-semibold text-nexus-text">{a.name || "—"}</p>
                            <p className="text-[11px] text-nexus-muted">{a.email}</p>
                          </td>
                          <td className="p-3">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-orange-500/20 bg-orange-500/10 text-orange-400">
                              {a.role}
                            </span>
                          </td>
                          <td className="p-3 text-nexus-muted">{a.company || a.department || "—"}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2 justify-end">
                              <button
                                onClick={() => handleRestoreAdmin(a)}
                                disabled={actionLoading}
                                className="px-2.5 py-1 text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md hover:bg-emerald-500/20 transition-colors flex items-center gap-1"
                                title="Restore Account"
                              >
                                <IconRefresh size={12} /> Restore
                              </button>
                              <button
                                onClick={() => handlePermanentDeleteAdmin(a)}
                                disabled={actionLoading}
                                className="px-2.5 py-1 text-[11px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 rounded-md hover:bg-red-500/20 transition-colors flex items-center gap-1"
                                title="Permanently Delete"
                              >
                                <IconX size={12} /> Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex justify-end px-6 py-3 border-t border-nexus-border">
              <button
                onClick={() => setShowTrashModal(false)}
                className="px-4 py-2 text-xs font-semibold text-nexus-muted border border-nexus-border rounded-lg hover:bg-nexus-hover"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </PermissionGuard>
  );
}
