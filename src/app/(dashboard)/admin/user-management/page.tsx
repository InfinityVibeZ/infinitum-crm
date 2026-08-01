"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  IconUsers,
  IconUserPlus,
  IconSearch,
  IconEdit,
  IconCheck,
  IconX,
  IconRefresh,
  IconKey,
  IconEye,
  IconCopy,
  IconChevronDown,
  IconChevronRight,
  IconUser,
  IconUserShield,
  IconCrown,
  IconBuilding,
  IconTrash,
  IconArchive,
  IconLoader2,
} from "@tabler/icons-react";
import { useAuthStore } from "@/store/auth";
import { SuccessPopup } from "@/components/common/SuccessPopup";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AppUser {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "USER";
  status: "ACTIVE" | "INACTIVE";
  department?: string;
  company?: string;
  companyId?: string;
  category?: string;
  phone?: string;
  modules?: string[];
  createdBy?: string;
  createdByName?: string;
  lastLogin?: string;
  createdAt: string;
  isActive: boolean;
  isInvitationExpired?: boolean;
}

interface AdminGroup extends AppUser {
  users: AppUser[];
  userCount: number;
}

interface CompanyItem {
  id: string;
  name: string;
  category?: string;
  status: "ACTIVE" | "INACTIVE";
  isActive: boolean;
  adminCount: number;
  userCount: number;
  totalMembers: number;
}

type ModalMode = "create" | "edit" | "view" | null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_BADGE: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  SUPER_ADMIN: { label: "Super Admin", color: "text-red-400 bg-red-500/10 border-red-500/25", icon: <IconCrown size={11} /> },
  ADMIN:       { label: "Admin",       color: "text-orange-400 bg-orange-500/10 border-orange-500/25", icon: <IconUserShield size={11} /> },
  USER:        { label: "User",        color: "text-blue-400 bg-blue-500/10 border-blue-500/25", icon: <IconUser size={11} /> },
};

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  ACTIVE:   { label: "Active",   color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25" },
  INACTIVE: { label: "Inactive", color: "text-gray-400 bg-gray-500/10 border-gray-500/25" },
  PENDING:  { label: "Pending",  color: "text-amber-400 bg-amber-500/10 border-amber-500/25" },
  EXPIRED:  { label: "Invitation Expired", color: "text-rose-400 bg-rose-500/10 border-rose-500/25" },
};

function formatDate(d?: string) {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(d?: string) {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

// ─── User Row Component ───────────────────────────────────────────────────────

function UserRow({
  u, currentUserId, currentUserRole, onView, onEdit, onToggleStatus, onSoftDelete, onResendInvitation,
  companyIsDeactivated, adminIsDeactivated, companyCategory, creatorName,
  showUserCountColumn = false, showCreatedBy = false, showRoleColumn = false, showActions = true,
}: {
  u: AppUser;
  currentUserId?: string;
  currentUserRole?: string;
  companyIsDeactivated?: boolean;
  adminIsDeactivated?: boolean;
  companyCategory?: string;
  creatorName?: string;
  showUserCountColumn?: boolean;
  showCreatedBy?: boolean;
  showRoleColumn?: boolean;
  showActions?: boolean;
  onView: (u: AppUser) => void;
  onEdit: (u: AppUser) => void;
  onToggleStatus: (u: AppUser) => void;
  onSoftDelete: (u: AppUser) => void;
  onResendInvitation?: (u: AppUser) => void;
}) {
  const roleBadge = ROLE_BADGE[u.role] ?? ROLE_BADGE.USER;
  const statusBadge = (u.status as string) === "PENDING" && u.isInvitationExpired
    ? STATUS_BADGE.EXPIRED
    : STATUS_BADGE[u.status] ?? STATUS_BADGE.ACTIVE;
  const isMe = u.id === currentUserId;
  const isBlockedFromActivation = companyIsDeactivated || adminIsDeactivated;

  const isTargetAdmin = u.role === "ADMIN" || u.role === "SUPER_ADMIN";
  const isLoggedAdminSelf = currentUserRole === "ADMIN" && isTargetAdmin && isMe;
  const isLoggedAdminOtherAdmin = currentUserRole === "ADMIN" && isTargetAdmin && !isMe;

  const tooltipText = companyIsDeactivated
    ? "Company is inactive — activate company first"
    : adminIsDeactivated
    ? "Admin account is inactive — activate admin account first"
    : "";

  const statusLabel = companyIsDeactivated
    ? "Company Inactive"
    : adminIsDeactivated
    ? "Admin Inactive"
    : statusBadge.label;

  return (
    <tr className={`hover:bg-nexus-hover/30 transition-colors ${!u.isActive || isBlockedFromActivation ? "opacity-60 bg-red-500/5" : ""}`}>
      <td className="p-3 pl-10">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-blue-500/10 flex items-center justify-center text-xs font-bold text-blue-400 flex-shrink-0">
            {u.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-nexus-text text-[13px]">
              {u.name}
              {isMe && (
                <span className="ml-1 text-[10px] text-nexus-primary bg-nexus-primary/10 px-1.5 py-0.5 rounded">You</span>
              )}
            </p>
            <p className="text-[11px] text-nexus-muted">{u.email}</p>
          </div>
        </div>
      </td>

      {showRoleColumn && (
        <td className="p-3">
          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${roleBadge.color}`}>
            {roleBadge.icon}
            {roleBadge.label}
          </span>
        </td>
      )}

      <td className="p-3">
        <span className={`inline-flex text-[11px] font-bold px-2 py-0.5 rounded-full border ${statusBadge.color}`}>
          {statusBadge.label}
        </span>
      </td>

      <td className="p-3 text-xs text-nexus-muted">{u.phone || "—"}</td>
      {showCreatedBy && (
        <td className="p-3">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-nexus-bg text-nexus-text border border-nexus-border">
            <IconUserShield size={12} className="text-orange-400 flex-shrink-0" />
            {creatorName || "Super Admin"}
          </span>
        </td>
      )}
      {showUserCountColumn && <td className="p-3 text-xs text-nexus-muted">—</td>}
      <td className="p-3 text-xs text-nexus-muted">{formatDateTime(u.lastLogin)}</td>
      <td className="p-3 text-xs text-nexus-muted">{formatDate(u.createdAt)}</td>

      {showActions && (
        <td className="p-3">
          {isLoggedAdminOtherAdmin ? (
            <div className="flex items-center justify-end pr-2 text-nexus-muted/40 font-mono text-[11px]">—</div>
          ) : isLoggedAdminSelf ? (
            <div className="flex items-center gap-1 justify-end">
              <button
                onClick={() => onEdit(u)}
                className="p-1.5 rounded-md text-nexus-muted hover:text-nexus-primary hover:bg-nexus-primary/10 transition-colors"
                title="Edit My Profile"
              >
                <IconEdit size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 justify-end">
              <button onClick={() => onEdit(u)} className="p-1.5 rounded-md text-nexus-muted hover:text-nexus-primary hover:bg-nexus-primary/10 transition-colors" title="Edit">
                <IconEdit size={14} />
              </button>
              {(u.status as string) === "PENDING" && onResendInvitation && (
                <button
                  onClick={() => onResendInvitation(u)}
                  className="p-1.5 rounded-md text-amber-400 hover:bg-amber-500/10 transition-colors"
                  title="Resend Setup Link"
                >
                  <IconKey size={14} />
                </button>
              )}
              {!isMe && (
                u.isActive ? (
                  <button
                    onClick={() => onToggleStatus(u)}
                    className="p-1.5 rounded-md text-nexus-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Deactivate User"
                  >
                    <IconX size={14} />
                  </button>
                ) : !isBlockedFromActivation ? (
                  <button
                    onClick={() => onToggleStatus(u)}
                    className="p-1.5 rounded-md text-nexus-muted hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                    title="Activate User"
                  >
                    <IconCheck size={14} />
                  </button>
                ) : (
                  <button
                    disabled
                    className="p-1.5 rounded-md text-nexus-muted/30 cursor-not-allowed"
                    title={tooltipText}
                  >
                    <IconCheck size={14} />
                  </button>
                )
              )}
              {!isMe && (
                <button
                  onClick={() => onSoftDelete(u)}
                  className="p-1.5 rounded-md text-nexus-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Delete"
                >
                  <IconTrash size={14} />
                </button>
              )}
            </div>
          )}
        </td>
      )}
    </tr>
  );
}

// ─── Admin Row (Flat) ─────────────────────────────────────────────────────────

function AdminRow({
  admin, currentUserId, onView, onEdit, onToggleStatus, onSoftDelete, showActions = true,
}: {
  admin: AppUser;
  currentUserId?: string;
  showActions?: boolean;
  onView: (u: AppUser) => void;
  onEdit: (u: AppUser) => void;
  onToggleStatus: (u: AppUser) => void;
  onSoftDelete: (u: AppUser) => void;
}) {
  const statusBadge = STATUS_BADGE[admin.status] ?? STATUS_BADGE.ACTIVE;
  const isMe = admin.id === currentUserId;

  return (
    <tr className="hover:bg-nexus-hover/50 transition-colors border-t border-nexus-border">
      <td className="p-3 pl-4">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
            admin.role === "SUPER_ADMIN" ? "bg-red-500/10 text-red-400" : "bg-orange-500/10 text-orange-400"
          }`}>
            {admin.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-nexus-text text-[13px]">
              {admin.name}
              {isMe && <span className="ml-1 text-[10px] text-nexus-primary bg-nexus-primary/10 px-1.5 py-0.5 rounded">You</span>}
            </p>
            <p className="text-[11px] text-nexus-muted">{admin.email}</p>
          </div>
        </div>
      </td>

      <td className="p-3">
        <span className={`inline-flex text-[11px] font-bold px-2 py-0.5 rounded-full border ${statusBadge.color}`}>
          {statusBadge.label}
        </span>
      </td>

      <td className="p-3 text-xs text-nexus-muted">{admin.phone || "—"}</td>
      <td className="p-3 text-xs text-nexus-muted">{formatDateTime(admin.lastLogin)}</td>
      <td className="p-3 text-xs text-nexus-muted">{formatDate(admin.createdAt)}</td>
      {showActions && (
        <td className="p-3">
          <div className="flex items-center gap-1 justify-end">
            <button onClick={() => onEdit(admin)} className="p-1.5 rounded-md text-nexus-muted hover:text-nexus-primary hover:bg-nexus-primary/10 transition-colors" title="Edit">
              <IconEdit size={14} />
            </button>
            {!isMe && (
              admin.isActive ? (
                <button
                  onClick={() => onToggleStatus(admin)}
                  className="p-1.5 rounded-md text-nexus-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Deactivate Admin"
                >
                  <IconX size={14} />
                </button>
              ) : (
                <button
                  onClick={() => onToggleStatus(admin)}
                  className="p-1.5 rounded-md text-nexus-muted hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                  title="Activate Admin"
                >
                  <IconCheck size={14} />
                </button>
              )
            )}
            {!isMe && (
              <button
                onClick={() => onSoftDelete(admin)}
                className="p-1.5 rounded-md text-nexus-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Delete"
              >
                <IconTrash size={14} />
              </button>
            )}
          </div>
        </td>
      )}
    </tr>
  );
}

// ─── Company Accordion Card ───────────────────────────────────────────────────

function CompanyAccordionCard({
  company,
  admins,
  directUsers,
  currentUserId,
  expanded,
  onToggleCompany,
  onView,
  onEdit,
  onToggleStatus,
  onSoftDelete,
  showActions = false,
}: {
  company: { id: string; name: string; category?: string; status?: string; isActive?: boolean };
  admins: AppUser[];
  directUsers: AppUser[];
  currentUserId?: string;
  expanded: boolean;
  showActions?: boolean;
  onToggleCompany: () => void;
  onView: (u: AppUser) => void;
  onEdit: (u: AppUser) => void;
  onToggleStatus: (u: AppUser) => void;
  onSoftDelete: (u: AppUser) => void;
}) {
  const isInactive = !company.isActive || company.status === "INACTIVE";
  const totalUserCount = directUsers.length;

  return (
    <div className="bg-nexus-card border border-nexus-border rounded-xl overflow-hidden shadow-sm">
      {/* Header Bar */}
      <div
        onClick={onToggleCompany}
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-nexus-hover/50 transition-colors border-b border-nexus-border bg-nexus-bg/40"
      >
        <div className="flex items-center gap-3">
          <span className="text-nexus-muted">
            {expanded ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
          </span>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-nexus-text">{company.name}</h3>
            {company.category && (
              <span className="text-[10px] text-nexus-muted bg-nexus-bg px-2 py-0.5 rounded border border-nexus-border">
                {company.category}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-semibold">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20">
            <IconUserShield size={13} /> {admins.length} Admin{admins.length !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <IconUsers size={13} /> {totalUserCount} User{totalUserCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="p-4 space-y-6 bg-nexus-bg/20">
          {/* SECTION 1: ADMINS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                <IconUserShield size={14} /> Admins ({admins.length})
              </h4>
            </div>

            {admins.length === 0 ? (
              <div className="p-4 rounded-lg border border-nexus-border bg-nexus-card text-center text-xs text-nexus-muted italic">
                No admins assigned to this company.
              </div>
            ) : (
              <div className="bg-nexus-card border border-nexus-border rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm min-w-[850px]">
                    <thead>
                      <tr className="border-b border-nexus-border text-[11px] uppercase text-nexus-muted font-semibold bg-nexus-bg/40">
                        <th className="p-3 pl-4">Admin</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Phone</th>
                        <th className="p-3">Last Login</th>
                        <th className="p-3">Created</th>
                        {showActions && <th className="p-3 text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-nexus-border">
                      {admins.map((admin) => (
                        <AdminRow
                          key={admin.id}
                          admin={admin}
                          currentUserId={currentUserId}
                          showActions={showActions}
                          onView={onView}
                          onEdit={onEdit}
                          onToggleStatus={onToggleStatus}
                          onSoftDelete={onSoftDelete}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: USERS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                <IconUsers size={14} /> Users ({directUsers.length})
              </h4>
            </div>

            {directUsers.length === 0 ? (
              <div className="p-4 rounded-lg border border-nexus-border bg-nexus-card text-center text-xs text-nexus-muted italic">
                No users in this company.
              </div>
            ) : (
              <div className="bg-nexus-card border border-nexus-border rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm min-w-[850px]">
                    <thead>
                      <tr className="border-b border-nexus-border text-[11px] uppercase text-nexus-muted font-semibold bg-nexus-bg/40">
                        <th className="p-3 pl-10">User</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Phone</th>
                        <th className="p-3">Created By</th>
                        <th className="p-3">Last Login</th>
                        <th className="p-3">Created</th>
                        {showActions && <th className="p-3 text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-nexus-border">
                      {directUsers.map((u) => {
                        const creatorAdmin = admins.find((a) => a.id === u.createdBy);
                        const isCreatorAdminInactive = creatorAdmin ? (!creatorAdmin.isActive || creatorAdmin.status === "INACTIVE") : false;
                        const creatorName = u.createdByName || creatorAdmin?.name || (u.createdBy ? "Admin" : "Super Admin");
                        return (
                          <UserRow
                            key={u.id}
                            u={u}
                            currentUserId={currentUserId}
                            companyIsDeactivated={isInactive}
                            adminIsDeactivated={isCreatorAdminInactive}
                            companyCategory={company.category}
                            creatorName={creatorName}
                            showCreatedBy={true}
                            showUserCountColumn={false}
                            showActions={showActions}
                            onView={onView}
                            onEdit={onEdit}
                            onToggleStatus={onToggleStatus}
                            onSoftDelete={onSoftDelete}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UserManagementPage() {
  const { user: currentUser } = useAuthStore();
  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";
  const isAdmin = currentUser?.role === "ADMIN";

  // Data State
  const [adminGroups, setAdminGroups] = useState<AdminGroup[]>([]);
  const [expandedAdmins, setExpandedAdmins] = useState<Set<string>>(new Set());
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());
  const [users, setUsers] = useState<AppUser[]>([]);
  const [companies, setCompanies] = useState<CompanyItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterCompany, setFilterCompany] = useState("ALL");
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [confirmSoftDeleteUser, setConfirmSoftDeleteUser] = useState<AppUser | null>(null);
  const [confirmToggleStatusUser, setConfirmToggleStatusUser] = useState<AppUser | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form State
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formCompanyId, setFormCompanyId] = useState("");
  const [formCompanyName, setFormCompanyName] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formRole, setFormRole] = useState<"ADMIN" | "USER">("USER");
  const [formStatus, setFormStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [formAdminId, setFormAdminId] = useState("");
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [setupLink, setSetupLink] = useState("");
  const [formSaving, setFormSaving] = useState(false);

  function showToast(msg: string, type: "success" | "error") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  const [resendingId, setResendingId] = useState<string | null>(null);

  async function handleResendInvitation(u: AppUser) {
    setResendingId(u.id);
    try {
      const token = localStorage.getItem("nexus-token");
      const res = await fetch(`/api/users/${u.id}/resend-invitation`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resend invitation");
      showToast(`Activation link resent to ${u.email}`, "success");
      fetchData(true);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error resending invitation", "error");
    } finally {
      setResendingId(null);
    }
  }

  const [myAdminAccount, setMyAdminAccount] = useState<{ isActive: boolean; status: string } | null>(null);

  // ── Fetch Data ────────────────────────────────────────────────────────────

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      useAuthStore.getState().fetchCurrentUser();
      const token = localStorage.getItem("nexus-token");
      const headers = { Authorization: `Bearer ${token}` };

      const [compRes, userRes, meRes] = await Promise.all([
        fetch("/api/companies", { headers, cache: "no-store" }),
        fetch(isSuperAdmin ? "/api/users?grouped=true" : "/api/users", { headers, cache: "no-store" }),
        fetch("/api/auth/me", { headers, cache: "no-store" }),
      ]);

      const compData = await compRes.json();
      if (Array.isArray(compData)) setCompanies(compData);

      if (meRes.ok) {
        const meData = await meRes.json();
        const meObj = meData.user || meData;
        setMyAdminAccount({ isActive: meObj.isActive ?? true, status: meObj.status ?? "ACTIVE" });
      }

      const data = await userRes.json();
      if (isSuperAdmin && data.admins) {
        setAdminGroups(data.admins);
        if (Array.isArray(data.allUsers)) setUsers(data.allUsers);
        if (!silent) setExpandedAdmins(new Set());
      } else if (Array.isArray(data)) {
        setUsers(data);
      }
    } catch {
      showToast("Failed to load user management data", "error");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function toggleCompany(id: string) {
    setExpandedCompanies((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAdmin(id: string) {
    setExpandedAdmins((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const onlyAdmins = adminGroups.filter((a) => a.role === "ADMIN");
  const totalAdminsCount = onlyAdmins.length;
  const activeAdminsCount = onlyAdmins.filter((a) => a.status === "ACTIVE" && a.isActive !== false).length;
  const inactiveAdminsCount = onlyAdmins.filter((a) => a.status === "INACTIVE" || a.isActive === false).length;

  const validActiveCompanies = (companies || []).filter((c) => {
    if (!c || c.isActive === false || c.status === "INACTIVE") return false;
    const hasAdmin = onlyAdmins.some((a) => a.companyId === c.id || (a.company || "").toLowerCase().trim() === c.name.toLowerCase().trim());
    return hasAdmin;
  });

  const totalCompaniesCount = validActiveCompanies.length;
  const totalUsersCount = isSuperAdmin
    ? users.filter((u) => {
        if (u.role !== "USER") return false;
        return validActiveCompanies.some(
          (c) => c.id === u.companyId || c.name.toLowerCase().trim() === (u.company || "").toLowerCase().trim()
        );
      }).length
    : users.filter((u) => u.role === "USER").length;

  const adminRoleAdmins = users.filter((u) => u.role === "ADMIN" || u.role === "SUPER_ADMIN");
  const adminRoleUsers = users.filter((u) => u.role === "USER");
  const companyAdminCount = adminRoleAdmins.length;
  const companyUserCount = adminRoleUsers.length;
  const companyActiveMemberCount = users.filter((u) => u.status === "ACTIVE" && u.isActive !== false).length;
  const companyInactiveMemberCount = users.filter((u) => u.status === "INACTIVE" || u.isActive === false).length;

  // ── Filters ────────────────────────────────────────────────────────────────

  const filteredUsers = users
    .filter((u) => {
      if (u.role === "SUPER_ADMIN") return false;
      const q = search.toLowerCase();
      const matchSearch =
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone || "").toLowerCase().includes(q) ||
        (u.company || u.department || "").toLowerCase().includes(q);
      const matchStatus = filterStatus === "ALL" || u.status === filterStatus;
      const matchComp = filterCompany === "ALL" || u.companyId === filterCompany || u.company === filterCompany;
      const matchRole =
        filterRole === "ALL" ||
        (filterRole === "ADMIN" && (u.role === "ADMIN" || (u.role as string) === "SUPER_ADMIN")) ||
        (filterRole === "USER" && u.role === "USER");
      return matchSearch && matchStatus && matchComp && matchRole;
    })
    .sort((a, b) => {
      const aIsMe = a.id === currentUser?.id;
      const bIsMe = b.id === currentUser?.id;
      if (aIsMe) return -1;
      if (bIsMe) return 1;

      const aIsAdmin = a.role === "ADMIN" || a.role === "SUPER_ADMIN";
      const bIsAdmin = b.role === "ADMIN" || b.role === "SUPER_ADMIN";
      if (aIsAdmin && !bIsAdmin) return -1;
      if (!aIsAdmin && bIsAdmin) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const filteredGroups = adminGroups
    .filter((admin) => admin.role === "ADMIN")
    .map((admin) => {
      const q = search.toLowerCase().trim();
      const adminCompMatch = (admin.company || admin.department || "").toLowerCase().includes(q);
      const adminMatch = !q || admin.name.toLowerCase().includes(q) || admin.email.toLowerCase().includes(q) || (admin.phone || "").toLowerCase().includes(q) || adminCompMatch;

      const filteredUsers = (admin.users || []).filter((u) => {
        if (u.role === "SUPER_ADMIN") return false;
        const userCompMatch = (u.company || u.department || "").toLowerCase().includes(q);
        const userMatch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.phone || "").toLowerCase().includes(q) || userCompMatch;
        const matchSearch = adminMatch || userMatch;
        const matchStatus = filterStatus === "ALL" || u.status === filterStatus;
        const matchComp = filterCompany === "ALL" || u.companyId === filterCompany || u.company === filterCompany;
        const matchRole =
          filterRole === "ALL" ||
          (filterRole === "ADMIN" && u.role === "ADMIN") ||
          (filterRole === "USER" && u.role === "USER");
        return matchSearch && matchStatus && matchComp && matchRole;
      });

      return {
        ...admin,
        users: filteredUsers,
      };
    }).filter((admin) => {
      const q = search.toLowerCase().trim();
      const adminCompMatch = (admin.company || admin.department || "").toLowerCase().includes(q);
      const adminMatch = !q || admin.name.toLowerCase().includes(q) || admin.email.toLowerCase().includes(q) || (admin.phone || "").toLowerCase().includes(q) || adminCompMatch;
      const matchCompanyFilter = filterCompany === "ALL" || admin.companyId === filterCompany || admin.company === filterCompany;
      const matchStatus = filterStatus === "ALL" || admin.status === filterStatus;
      return ((adminMatch && matchCompanyFilter) || admin.users.length > 0) && matchStatus;
    });

  // Company Accordions Data for SuperAdmin (Active Companies Only, Admin Data Only)
  const companyAccordions = validActiveCompanies.map((comp) => {
    const compAdmins = filteredGroups.filter((a) => {
      return a.role === "ADMIN" && (a.companyId === comp.id || (a.company || "").toLowerCase().trim() === comp.name.toLowerCase().trim());
    });

    const compDirectUsers = users.filter((u) => {
      if (u.role !== "USER") return false; // ONLY regular users, NOT admins!
      const isComp = u.companyId === comp.id || (u.company || "").toLowerCase().trim() === comp.name.toLowerCase().trim();
      const q = search.toLowerCase().trim();
      const compNameMatch = comp.name.toLowerCase().includes(q) || (comp.category || "").toLowerCase().includes(q);
      const userCompMatch = (u.company || u.department || "").toLowerCase().includes(q);
      const creatorAdmin = adminGroups.find((a) => a.id === u.createdBy);
      const creatorMatch = creatorAdmin ? (creatorAdmin.name.toLowerCase().includes(q) || creatorAdmin.email.toLowerCase().includes(q) || (creatorAdmin.phone || "").toLowerCase().includes(q)) : false;
      const matchSearch = !q || compNameMatch || userCompMatch || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.phone || "").toLowerCase().includes(q) || creatorMatch;
      const matchStatus = filterStatus === "ALL" || u.status === filterStatus;
      return isComp && matchSearch && matchStatus;
    });

    return {
      company: comp,
      admins: compAdmins,
      directUsers: compDirectUsers,
      totalCount: compAdmins.length + compDirectUsers.length + compAdmins.reduce((acc, a) => acc + a.users.length, 0),
    };
  }).filter((item) => {
    if (filterCompany !== "ALL" && filterCompany !== item.company.id) return false;
    const q = search.toLowerCase().trim();
    const compNameMatch = !q || item.company.name.toLowerCase().includes(q) || (item.company.category || "").toLowerCase().includes(q);
    const hasAnyMatches = item.admins.length > 0 || item.directUsers.length > 0;
    return compNameMatch || hasAnyMatches;
  });

  // ── Soft Delete Helper ────────────────────────────────────────────────────

  async function handleSoftDeleteUser(u: AppUser) {
    setActionLoading(true);
    try {
      const token = localStorage.getItem("nexus-token");
      const res = await fetch(`/api/users/${u.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(`User "${u.name}" deleted successfully`, "success");
      setConfirmSoftDeleteUser(null);
      fetchData(true);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error deleting user", "error");
    } finally {
      setActionLoading(false);
    }
  }

  // ── Modal Helpers ──────────────────────────────────────────────────────────

  const myAdminObj = users.find((u) => u.id === currentUser?.id) || adminGroups.find((a) => a.id === currentUser?.id);
  const myCompanyVal = currentUser?.company || (currentUser as any)?.department || myAdminObj?.company || myAdminObj?.department || "";
  const myCompanyIdVal = currentUser?.companyId || myAdminObj?.companyId || "";

  function openCreate() {
    setSelectedUser(null);
    setFormName(""); setFormEmail(""); setFormPhone("");
    setFormCompanyId(isSuperAdmin ? "" : myCompanyIdVal);
    setFormCompanyName(isSuperAdmin ? "" : myCompanyVal);
    setFormCategory("");
    setFormRole("USER"); setFormStatus("ACTIVE"); setFormAdminId("");
    setGeneratedPassword("");
    setSetupLink("");
    setModalMode("create");
  }

  function openEdit(u: AppUser) {
    setSelectedUser(u);
    setFormName(u.name); setFormEmail(u.email); setFormPhone(u.phone || "");
    setFormCompanyId(u.companyId || ""); setFormCompanyName(u.company || u.department || "");
    setFormCategory(u.category || "");
    setFormRole(u.role === "ADMIN" ? "ADMIN" : "USER");
    setFormStatus(u.status); setFormAdminId(u.createdBy || "");
    setGeneratedPassword("");
    setSetupLink("");
    setModalMode("edit");
  }

  function openView(u: AppUser) {
    setSelectedUser(u);
    setModalMode("view");
  }

  function closeModal() {
    setModalMode(null);
    setSelectedUser(null);
    setGeneratedPassword("");
    setSetupLink("");
  }

  // ── Save User ──────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!formName.trim() || !formEmail.trim()) {
      showToast("Name and email are required", "error");
      return;
    }
    setFormSaving(true);
    try {
      const token = localStorage.getItem("nexus-token");
      const matchedComp = companies.find((c) => c.id === formCompanyId);
      const finalCompanyVal = isSuperAdmin
        ? (matchedComp ? matchedComp.name : formCompanyName)
        : (currentUser?.company || currentUser?.department || formCompanyName);
      const finalCompanyId = isSuperAdmin
        ? formCompanyId
        : (currentUser?.companyId || formCompanyId);

      const body: any = {
        name: formName, email: formEmail, phone: formPhone,
        company: finalCompanyVal, companyId: finalCompanyId || undefined,
        department: finalCompanyVal, category: formCategory,
        role: formRole, status: formStatus,
      };
      if (isSuperAdmin && formAdminId) body.assignedAdminId = formAdminId;

      if (modalMode === "create") {
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create user");
        showToast(`User "${formName}" created successfully. Activation link sent to ${formEmail}`, "success");
        fetchData(true);
        closeModal();
      } else if (modalMode === "edit" && selectedUser) {
        const res = await fetch(`/api/users/${selectedUser.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update user");
        showToast(`User "${formName}" updated successfully`, "success");
        fetchData(true);
        closeModal();
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error saving", "error");
    } finally {
      setFormSaving(false);
    }
  }

  async function handleToggleStatus(u: AppUser) {
    setActionLoading(true);
    try {
      const token = localStorage.getItem("nexus-token");
      const res = await fetch(`/api/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "toggle-status" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(`"${u.name}" status updated to ${data.isActive ? "ACTIVE" : "INACTIVE"}`, "success");
      setConfirmToggleStatusUser(null);
      fetchData(true);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error updating status", "error");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-6 text-nexus-text">

      {/* Success confirmation shows as a centered popup; errors stay as a corner toast */}
      {toast && toast.type === "success" && (
        <SuccessPopup message={toast.msg} type="success" onClose={() => setToast(null)} />
      )}
      {toast && toast.type === "error" && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl text-sm font-semibold transition-all bg-red-900/80 border-red-500/40 text-red-300">
          <IconX size={16} />
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="p-2 bg-nexus-primary/10 rounded-xl text-nexus-primary">
              <IconUsers size={24} />
            </span>
            User Management
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchData()}
            className="p-2 rounded-lg border border-nexus-border text-nexus-muted hover:text-nexus-text hover:bg-nexus-hover transition-colors"
            title="Refresh"
          >
            <IconRefresh size={16} />
          </button>

          {!isSuperAdmin && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-nexus-primary text-black text-sm font-bold rounded-lg hover:bg-nexus-primary/90 transition-colors shadow-lg shadow-nexus-primary/20"
            >
              <IconUserPlus size={16} />
              Create User
            </button>
          )}
        </div>
      </div>

      {/* Dashboard Overview Cards */}
      {isSuperAdmin ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Total Companies Card */}
          <div className="bg-nexus-card border border-nexus-border rounded-xl p-4 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-nexus-muted uppercase tracking-wider">Total Companies</span>
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                <IconBuilding size={18} />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-nexus-text mt-2">{totalCompaniesCount}</p>
            <p className="text-[11px] text-nexus-muted mt-2 font-medium">Active Admin Workspaces</p>
          </div>

          {/* Total Admins Card */}
          <div className="bg-nexus-card border border-nexus-border rounded-xl p-4 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-nexus-muted uppercase tracking-wider">Total Admins</span>
              <div className="p-2 rounded-lg bg-orange-500/10 text-orange-400">
                <IconUserShield size={18} />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-nexus-text mt-2">{totalAdminsCount}</p>
            <div className="flex items-center gap-2 mt-2 text-[11px] font-semibold">
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {activeAdminsCount} Active
              </span>
              <span className="px-2 py-0.5 rounded bg-gray-500/10 text-gray-400 border border-gray-500/20">
                {inactiveAdminsCount} Inactive
              </span>
            </div>
          </div>

          {/* Total Users Card */}
          <div className="bg-nexus-card border border-nexus-border rounded-xl p-4 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-nexus-muted uppercase tracking-wider">Total Users</span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <IconUsers size={18} />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-nexus-text mt-2">{totalUsersCount}</p>
            <p className="text-[11px] text-nexus-muted mt-2 font-medium">Total Managed Members</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Admins */}
          <div className="bg-nexus-card border border-nexus-border rounded-xl p-4 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-nexus-muted uppercase tracking-wider">Total Admins</span>
              <div className="p-2 rounded-lg bg-orange-500/10 text-orange-400">
                <IconUserShield size={18} />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-nexus-text mt-2">{companyAdminCount}</p>
            <p className="text-[11px] text-orange-400/80 mt-2 font-medium">Company Admins</p>
          </div>

          {/* Total Users */}
          <div className="bg-nexus-card border border-nexus-border rounded-xl p-4 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-nexus-muted uppercase tracking-wider">Total Users</span>
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                <IconUsers size={18} />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-nexus-text mt-2">{companyUserCount}</p>
            <p className="text-[11px] text-nexus-muted mt-2 font-medium">Company Users</p>
          </div>

          {/* Active Members */}
          <div className="bg-nexus-card border border-nexus-border rounded-xl p-4 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-nexus-muted uppercase tracking-wider">Active Members</span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <IconCheck size={18} />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-emerald-400 mt-2">{companyActiveMemberCount}</p>
            <p className="text-[11px] text-emerald-500/70 mt-2 font-medium">Active & Enabled</p>
          </div>

          {/* Inactive Members */}
          <div className="bg-nexus-card border border-nexus-border rounded-xl p-4 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-nexus-muted uppercase tracking-wider">Inactive Members</span>
              <div className="p-2 rounded-lg bg-red-500/10 text-red-400">
                <IconX size={18} />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-red-400 mt-2">{companyInactiveMemberCount}</p>
            <p className="text-[11px] text-red-500/70 mt-2 font-medium">Disabled or Pending</p>
          </div>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              isSuperAdmin
                ? "Search by name, email, or company…"
                : "Search users by name, email, or phone…"
            }
            className="w-full pl-9 pr-3 py-2 text-sm bg-nexus-card border border-nexus-border rounded-lg text-nexus-text placeholder-nexus-muted focus:outline-none focus:border-nexus-primary"
          />
        </div>

        {/* Status Filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 text-sm bg-nexus-card border border-nexus-border rounded-lg text-nexus-text focus:outline-none focus:border-nexus-primary"
        >
          <option value="ALL">All Statuses</option>
          <option value="ACTIVE">Active Users</option>
          <option value="INACTIVE">Inactive Users</option>
        </select>

        {/* Company Filter (SuperAdmin Only) */}
        {isSuperAdmin && (
          <select
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
            className="px-3 py-2 text-sm bg-nexus-card border border-nexus-border rounded-lg text-nexus-text focus:outline-none focus:border-nexus-primary"
          >
            <option value="ALL">All Companies</option>
            {validActiveCompanies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* SuperAdmin View: Company-Based Accordions */}
      {isSuperAdmin && (
        <div className="space-y-4">
          {loading && (
            <div className="p-12 text-center text-nexus-muted bg-nexus-card border border-nexus-border rounded-xl">
              <div className="flex justify-center font-semibold">Loading company workspaces…</div>
            </div>
          )}

          {!loading && companyAccordions.length === 0 && (
            <div className="p-12 text-center text-nexus-muted bg-nexus-card border border-nexus-border rounded-xl">
              No companies or users found matching filters
            </div>
          )}

          {!loading && companyAccordions.map((item) => (
            <CompanyAccordionCard
              key={item.company.id}
              company={item.company}
              admins={item.admins}
              directUsers={item.directUsers}
              currentUserId={currentUser?.id}
              expanded={expandedCompanies.has(item.company.id)}
              onToggleCompany={() => toggleCompany(item.company.id)}
              onView={openView}
              onEdit={openEdit}
              onToggleStatus={(u) => setConfirmToggleStatusUser(u)}
              onSoftDelete={(u) => setConfirmSoftDeleteUser(u)}
            />
          ))}
        </div>
      )}

      {isAdmin && (
        <div className="bg-nexus-card border border-nexus-border rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[800px]">
              <thead>
                <tr className="border-b border-nexus-border text-[11px] uppercase text-nexus-muted font-semibold bg-nexus-bg/40">
                  <th className="p-4 pl-10">User</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Phone</th>
                  <th className="p-4">Last Login</th>
                  <th className="p-4">Created</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nexus-border">
                {loading && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-nexus-muted text-sm">Loading company team members…</td>
                  </tr>
                )}
                {!loading && filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-nexus-muted text-sm">No team members found matching filters</td>
                  </tr>
                )}
                {!loading && filteredUsers.map((u) => {
                  const userCompId = u.companyId || (myAdminAccount as any)?.companyId || currentUser?.companyId;
                  const userCompName = u.company || (myAdminAccount as any)?.company || currentUser?.company;

                  const compIsInactive = (() => {
                    if (userCompId) {
                      const comp = companies.find((c) => c.id === userCompId);
                      if (comp) return !comp.isActive || comp.status === "INACTIVE";
                    }
                    if (userCompName) {
                      const comp = companies.find((c) => (c.name || "").toLowerCase().trim() === (userCompName || "").toLowerCase().trim());
                      if (comp) return !comp.isActive || comp.status === "INACTIVE";
                    }
                    return false;
                  })();

                  const adminIsInactive = myAdminAccount
                    ? (myAdminAccount.isActive === false || myAdminAccount.status === "INACTIVE")
                    : false;

                  return (
                    <UserRow
                      key={u.id}
                      u={u}
                      currentUserId={currentUser?.id}
                      currentUserRole={currentUser?.role}
                      showRoleColumn={true}
                      companyIsDeactivated={compIsInactive}
                      adminIsDeactivated={adminIsInactive}
                      onView={openView}
                      onEdit={openEdit}
                      onToggleStatus={(userToToggle) => setConfirmToggleStatusUser(userToToggle)}
                      onSoftDelete={(userToDel) => setConfirmSoftDeleteUser(userToDel)}
                      onResendInvitation={handleResendInvitation}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal create/edit */}
      {(modalMode === "create" || modalMode === "edit") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-nexus-card border border-nexus-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-nexus-border">
              <div className="flex items-center gap-3">
                <span className="p-2 bg-nexus-primary/10 rounded-xl text-nexus-primary">
                  <IconUserPlus size={20} />
                </span>
                <div>
                  <h2 className="text-base font-bold text-nexus-text">
                    {modalMode === "create" ? "Create New User" : `Edit: ${selectedUser?.name}`}
                  </h2>
                  <p className="text-xs text-nexus-muted">
                    {modalMode === "create" ? "Fill in user details below" : "Update user information"}
                  </p>
                </div>
              </div>
              <button onClick={closeModal} className="p-2 text-nexus-muted hover:text-nexus-text hover:bg-nexus-hover rounded-lg transition-colors">
                <IconX size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-nexus-text-secondary mb-1 block">Full Name *</label>
                    <input value={formName} onChange={(e) => setFormName(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-nexus-bg border border-nexus-border rounded-lg text-nexus-text focus:outline-none focus:border-nexus-primary font-medium" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-nexus-text-secondary mb-1 block">Email *</label>
                    <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)}
                      readOnly={modalMode === "edit"}
                      className={`w-full px-3 py-2 text-sm border rounded-lg text-nexus-text focus:outline-none ${
                        modalMode === "edit"
                          ? "bg-nexus-hover border-nexus-border text-nexus-muted cursor-not-allowed font-medium"
                          : "bg-nexus-bg border-nexus-border focus:border-nexus-primary font-medium"
                      }`} />
                  </div>
                </div>

                <div className={`grid ${isSuperAdmin ? "grid-cols-2" : "grid-cols-1"} gap-3`}>
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

                  {isSuperAdmin && (
                    <div>
                      <label className="text-xs font-semibold text-nexus-text-secondary mb-1 block">Company *</label>
                      <select
                        value={formCompanyId}
                        onChange={(e) => {
                          setFormCompanyId(e.target.value);
                          const matched = companies.find((c) => c.id === e.target.value);
                          if (matched) setFormCompanyName(matched.name);
                        }}
                        className="w-full px-3 py-2 text-sm bg-nexus-bg border border-nexus-border rounded-lg text-nexus-text focus:outline-none focus:border-nexus-primary"
                      >
                        <option value="">Select Company</option>
                        {companies.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>



                {isSuperAdmin && modalMode === "create" && (
                  <div>
                    <label className="text-xs font-semibold text-nexus-text-secondary mb-1 block">Assign to Admin</label>
                    <select value={formAdminId} onChange={(e) => setFormAdminId(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-nexus-bg border border-nexus-border rounded-lg text-nexus-text focus:outline-none focus:border-nexus-primary">
                      <option value="">— Unassigned (created by Super Admin) —</option>
                      {adminGroups.filter((a) => a.role === "ADMIN").map((a) => (
                        <option key={a.id} value={a.id}>{a.name} ({a.email})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 px-6 py-4 border-t border-nexus-border">
                <button onClick={closeModal} disabled={formSaving}
                  className="px-4 py-2 text-sm font-semibold text-nexus-muted hover:text-nexus-text border border-nexus-border rounded-lg hover:bg-nexus-hover transition-colors disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={formSaving}
                  className="px-5 py-2 text-sm font-bold bg-nexus-primary text-black rounded-lg hover:bg-nexus-primary/90 transition-colors shadow-lg shadow-nexus-primary/20 disabled:opacity-60 flex items-center justify-center gap-2">
                  {formSaving && <IconLoader2 size={16} className="animate-spin" />}
                  {formSaving ? "Saving…" : modalMode === "create" ? "Create User" : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Soft Delete User Modal */}
      {confirmSoftDeleteUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-nexus-card border border-nexus-border rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto">
                <IconTrash size={24} className="text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-nexus-text">Delete User?</h3>
                <p className="text-base font-bold text-nexus-text mt-2">{confirmSoftDeleteUser.name}</p>
                <p className="text-xs text-nexus-muted">{confirmSoftDeleteUser.email}</p>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setConfirmSoftDeleteUser(null)} disabled={actionLoading} className="flex-1 px-4 py-2.5 text-sm font-semibold text-nexus-muted border border-nexus-border rounded-xl hover:bg-nexus-hover disabled:opacity-50">
                Cancel
              </button>
              <button
                onClick={() => handleSoftDeleteUser(confirmSoftDeleteUser)}
                disabled={actionLoading}
                className="flex-1 px-4 py-2.5 text-sm font-bold bg-amber-500 text-black rounded-xl hover:bg-amber-400 shadow-lg shadow-amber-500/25 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {actionLoading && <IconLoader2 size={16} className="animate-spin" />}
                {actionLoading ? "Processing…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {modalMode === "view" && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-nexus-card border border-nexus-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-nexus-border">
              <h2 className="text-base font-bold text-nexus-text">User Details</h2>
              <button onClick={closeModal} className="p-2 text-nexus-muted hover:text-nexus-text hover:bg-nexus-hover rounded-lg transition-colors">
                <IconX size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-nexus-primary/10 flex items-center justify-center text-2xl font-bold text-nexus-primary">
                  {selectedUser.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-nexus-text">{selectedUser.name}</h3>
                  <p className="text-sm text-nexus-muted">{selectedUser.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[10px] text-nexus-muted font-semibold uppercase tracking-wider mb-0.5">Company</p>
                  <p className="text-nexus-text font-semibold">{selectedUser.company || selectedUser.department || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-nexus-muted font-semibold uppercase tracking-wider mb-0.5">Category</p>
                  <p className="text-nexus-text font-semibold">{selectedUser.category || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-nexus-muted font-semibold uppercase tracking-wider mb-0.5">Phone</p>
                  <p className="text-nexus-text font-semibold">{selectedUser.phone || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-nexus-muted font-semibold uppercase tracking-wider mb-0.5">Status</p>
                  <p className="text-nexus-text font-semibold">{selectedUser.status}</p>
                </div>
                <div>
                  <p className="text-[10px] text-nexus-muted font-semibold uppercase tracking-wider mb-0.5">Last Login</p>
                  <p className="text-nexus-text font-semibold">{formatDateTime(selectedUser.lastLogin)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-nexus-muted font-semibold uppercase tracking-wider mb-0.5">Created At</p>
                  <p className="text-nexus-text font-semibold">{formatDate(selectedUser.createdAt)}</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-nexus-border">
              <button onClick={closeModal} className="px-4 py-2 text-sm font-semibold text-nexus-muted border border-nexus-border rounded-lg hover:bg-nexus-hover">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Activate / Deactivate Confirmation Modal */}
      {confirmToggleStatusUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-nexus-card border border-nexus-border rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center space-y-4">
              <div className={`w-14 h-14 rounded-full border flex items-center justify-center mx-auto ${
                confirmToggleStatusUser.isActive
                  ? "bg-red-500/10 border-red-500/20 text-red-400"
                  : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              }`}>
                {confirmToggleStatusUser.isActive ? <IconX size={26} /> : <IconCheck size={26} />}
              </div>
              <div>
                <h3 className="text-lg font-bold text-nexus-text">
                  {confirmToggleStatusUser.isActive ? "Deactivate User Account?" : "Activate User Account?"}
                </h3>
                <p className="text-base font-bold text-nexus-text mt-1">{confirmToggleStatusUser.name}</p>
                <p className="text-xs text-nexus-muted mb-2">{confirmToggleStatusUser.email}</p>
                <p className="text-xs text-nexus-muted">
                  {confirmToggleStatusUser.isActive
                    ? "This user will lose access to the portal until reactivated."
                    : "Access will be restored for this user account immediately."}
                </p>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => setConfirmToggleStatusUser(null)}
                disabled={actionLoading}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-nexus-muted border border-nexus-border rounded-xl hover:bg-nexus-hover disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleToggleStatus(confirmToggleStatusUser)}
                disabled={actionLoading}
                className={`flex-1 px-4 py-2.5 text-sm font-bold text-black rounded-xl shadow-lg disabled:opacity-60 flex items-center justify-center gap-2 ${
                  confirmToggleStatusUser.isActive
                    ? "bg-red-500 hover:bg-red-400 shadow-red-500/25"
                    : "bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/25"
                }`}
              >
                {actionLoading && <IconLoader2 size={16} className="animate-spin" />}
                {actionLoading ? "Processing…" : confirmToggleStatusUser.isActive ? "Deactivate" : "Activate"}
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
