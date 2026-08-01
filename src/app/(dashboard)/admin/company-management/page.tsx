"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  IconBuilding,
  IconPlus,
  IconSearch,
  IconEdit,
  IconTrash,
  IconX,
  IconCheck,
  IconRefresh,
  IconUserShield,
  IconUsers,
  IconFolder,
  IconBuildingCommunity,
  IconChecklist,
  IconAlertTriangle,
  IconBan,
  IconLoader2,
} from "@tabler/icons-react";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { SuccessPopup } from "@/components/common/SuccessPopup";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CompanyItem {
  id: string;
  name: string;
  category?: string;
  status: "ACTIVE" | "INACTIVE";
  isActive: boolean;
  adminCount: number;
  userCount: number;
  totalMembers: number;
  createdAt: string;
  admins?: Array<{ id: string; name: string; email: string; status?: string; isActive?: boolean }>;
  users?: Array<{ id: string; name: string; email: string; status?: string; isActive?: boolean }>;
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
  INACTIVE: "text-amber-400 bg-amber-500/10 border-amber-500/25",
};

const COMPANY_CATEGORIES = [
  "Technology & Software",
  "Healthcare & Life Sciences",
  "Finance & Banking",
  "Real Estate & Construction",
  "E-Commerce & Retail",
  "Marketing & Advertising",
  "Education & EdTech",
  "Consulting & Services",
  "Manufacturing & Logistics",
  "Other",
];

function formatDate(d?: string) {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CompanyManagementPage() {
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Form State
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [editCompanyTarget, setEditCompanyTarget] = useState<CompanyItem | null>(null);
  const [compName, setCompName] = useState("");
  const [compCategory, setCompCategory] = useState("Technology & Software");
  const [compCustomCat, setCompCustomCat] = useState("");
  const [compStatus, setCompStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [savingCompany, setSavingCompany] = useState(false);

  // Soft delete & toggle status targets
  const [confirmSoftDelete, setConfirmSoftDelete] = useState<CompanyItem | null>(null);
  const [confirmToggleStatus, setConfirmToggleStatus] = useState<CompanyItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  function toast$(msg: string, type: "success" | "error") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  const token = () =>
    typeof window !== "undefined" ? localStorage.getItem("nexus-token") || "" : "";

  // ── Fetch Companies ───────────────────────────────────────────────────────

  const fetchCompanies = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/companies", {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setCompanies(data);
      }
    } catch {
      toast$("Failed to load companies", "error");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  // ── Modal Actions ──────────────────────────────────────────────────────────

  function openCreateCompany() {
    setEditCompanyTarget(null);
    setCompName("");
    setCompCategory("Technology & Software");
    setCompCustomCat("");
    setCompStatus("ACTIVE");
    setShowCompanyForm(true);
  }

  function openEditCompany(c: CompanyItem) {
    setEditCompanyTarget(c);
    setCompName(c.name);
    if (c.category && COMPANY_CATEGORIES.includes(c.category)) {
      setCompCategory(c.category);
      setCompCustomCat("");
    } else {
      setCompCategory("Other");
      setCompCustomCat(c.category || "");
    }
    setCompStatus(c.status);
    setShowCompanyForm(true);
  }

  async function handleSaveCompany() {
    if (!compName.trim()) {
      toast$("Company name is required", "error");
      return;
    }
    setSavingCompany(true);
    try {
      const finalCategory = compCategory === "Other" ? (compCustomCat.trim() || "General") : compCategory;
      const body = {
        name: compName.trim(),
        category: finalCategory,
        status: compStatus,
      };

      if (!editCompanyTarget) {
        const res = await fetch("/api/companies", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create company");
        toast$(`Company "${compName}" created successfully!`, "success");
      } else {
        const res = await fetch(`/api/companies/${editCompanyTarget.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update company");
        toast$(`Company "${compName}" updated successfully!`, "success");
      }

      setShowCompanyForm(false);
      fetchCompanies(true);
    } catch (e) {
      toast$(e instanceof Error ? e.message : "Error saving company", "error");
    } finally {
      setSavingCompany(false);
    }
  }

  async function handleToggleStatus(c: CompanyItem) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/companies/${c.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast$(`Company "${c.name}" status updated to ${data.isActive ? "ACTIVE" : "INACTIVE"}`, "success");
      setConfirmToggleStatus(null);
      fetchCompanies(true);
    } catch (e) {
      toast$(e instanceof Error ? e.message : "Error updating status", "error");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSoftDeleteCompany(c: CompanyItem) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/companies/${c.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast$(`Company "${c.name}" moved to Trash / Archive`, "success");
      setConfirmSoftDelete(null);
      fetchCompanies(true);
    } catch (e) {
      toast$(e instanceof Error ? e.message : "Error archiving company", "error");
    } finally {
      setActionLoading(false);
    }
  }

  // ── Filters ────────────────────────────────────────────────────────────────

  const filteredCompanies = companies.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = c.name.toLowerCase().includes(q) || (c.category || "").toLowerCase().includes(q);
    const matchCategory = categoryFilter === "ALL" || c.category === categoryFilter;
    const matchStatus = statusTab === "ALL" || (statusTab === "ACTIVE" ? c.isActive : !c.isActive);
    return matchSearch && matchCategory && matchStatus;
  });

  const totalMembersCount = companies.reduce((sum, c) => sum + c.totalMembers, 0);
  const activeCount = companies.filter((c) => c.isActive).length;
  const inactiveCount = companies.filter((c) => !c.isActive).length;

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

        {/* ── HEADER ───────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400">
              <IconBuildingCommunity size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-nexus-text">Company Management</h1>
              <p className="text-sm text-nexus-muted mt-0.5">
                Register companies, manage active/inactive lists, categories, and member counts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => fetchCompanies()} className="p-2 rounded-lg border border-nexus-border text-nexus-muted hover:text-nexus-text hover:bg-nexus-hover transition-colors" title="Refresh">
              <IconRefresh size={16} />
            </button>

            <button
              onClick={openCreateCompany}
              className="flex items-center gap-2 px-4 py-2.5 bg-nexus-primary text-black text-sm font-bold rounded-lg hover:bg-nexus-primary/90 transition-colors shadow-lg shadow-nexus-primary/20"
            >
              <IconPlus size={16} />
              Create Company
            </button>
          </div>
        </div>

        {/* ── STAT CARDS ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            onClick={() => setStatusTab("ALL")}
            className={`p-4 rounded-xl border flex items-center gap-3.5 cursor-pointer transition-all ${
              statusTab === "ALL"
                ? "bg-blue-500/10 border-blue-500/40 shadow-lg shadow-blue-500/10"
                : "bg-nexus-card border-nexus-border hover:border-nexus-primary/40"
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0 text-blue-400">
              <IconBuilding size={20} />
            </div>
            <div>
              <p className="text-[11px] text-nexus-muted font-semibold uppercase tracking-wide">Total Companies</p>
              <p className="text-2xl font-black text-blue-400">{companies.length}</p>
            </div>
          </div>

          <div
            onClick={() => setStatusTab("ACTIVE")}
            className={`p-4 rounded-xl border flex items-center gap-3.5 cursor-pointer transition-all ${
              statusTab === "ACTIVE"
                ? "bg-emerald-500/10 border-emerald-500/40 shadow-lg shadow-emerald-500/10"
                : "bg-nexus-card border-nexus-border hover:border-nexus-primary/40"
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0 text-emerald-400">
              <IconChecklist size={20} />
            </div>
            <div>
              <p className="text-[11px] text-nexus-muted font-semibold uppercase tracking-wide">Active List</p>
              <p className="text-2xl font-black text-emerald-400">{activeCount}</p>
            </div>
          </div>

          <div
            onClick={() => setStatusTab("INACTIVE")}
            className={`p-4 rounded-xl border flex items-center gap-3.5 cursor-pointer transition-all ${
              statusTab === "INACTIVE"
                ? "bg-amber-500/10 border-amber-500/40 shadow-lg shadow-amber-500/10"
                : "bg-nexus-card border-nexus-border hover:border-nexus-primary/40"
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0 text-amber-400">
              <IconBan size={20} />
            </div>
            <div>
              <p className="text-[11px] text-nexus-muted font-semibold uppercase tracking-wide">Inactive List</p>
              <p className="text-2xl font-black text-amber-400">{inactiveCount}</p>
            </div>
          </div>

          <div className="bg-nexus-card border border-nexus-border rounded-xl p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0 text-purple-400">
              <IconUsers size={20} />
            </div>
            <div>
              <p className="text-[11px] text-nexus-muted font-semibold uppercase tracking-wide">Total Members</p>
              <p className="text-2xl font-black text-purple-400">{totalMembersCount}</p>
            </div>
          </div>
        </div>

        {/* ── SEARCH & FILTER TOOLBAR ────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between w-full">
          <div className="relative flex-1 max-w-2xl">
            <IconSearch size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-nexus-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search company name, category, or members…"
              className="w-full pl-10 pr-9 py-2.5 text-sm bg-nexus-card border border-nexus-border rounded-xl text-nexus-text placeholder-nexus-muted focus:outline-none focus:border-nexus-primary focus:ring-2 focus:ring-nexus-primary/20 transition-all font-medium"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-nexus-muted hover:text-nexus-text p-1 rounded-md transition-colors"
                title="Clear search"
              >
                <IconX size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2.5 text-sm bg-nexus-card border border-nexus-border rounded-xl text-nexus-text font-semibold focus:outline-none focus:border-nexus-primary focus:ring-2 focus:ring-nexus-primary/20 transition-all"
            >
              <option value="ALL">All Categories</option>
              {COMPANY_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── COMPANIES TABLE ─────────────────────────────────────────────── */}
        <div className="bg-nexus-card border border-nexus-border rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[750px]">
              <thead>
                <tr className="border-b border-nexus-border text-[11px] uppercase text-nexus-muted font-semibold bg-nexus-bg/40">
                  <th className="px-5 py-3">Company Name</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Admins</th>
                  <th className="px-5 py-3">Users</th>
                  <th className="px-5 py-3">Total Members</th>
                  <th className="px-5 py-3">Created Date</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nexus-border">
                {loading && (
                  <tr><td colSpan={8} className="p-10 text-center">
                    <div className="flex justify-center"><div className="w-6 h-6 border-2 border-nexus-primary border-t-transparent rounded-full animate-spin" /></div>
                  </td></tr>
                )}
                {!loading && filteredCompanies.length === 0 && (
                  <tr><td colSpan={8} className="p-14 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <IconBuilding size={32} className="text-nexus-muted opacity-40" />
                      <p className="text-sm text-nexus-muted">
                        {statusTab === "INACTIVE"
                          ? "No inactive companies found"
                          : statusTab === "ACTIVE"
                          ? "No active companies found"
                          : "No companies found"}
                      </p>
                      {statusTab !== "INACTIVE" && (
                        <button
                          onClick={openCreateCompany}
                          className="text-xs font-semibold text-nexus-primary hover:underline flex items-center gap-1"
                        >
                          <IconPlus size={12} /> Create a new company
                        </button>
                      )}
                    </div>
                  </td></tr>
                )}
                {!loading && filteredCompanies.map((c) => {
                  const adminList = c.admins || [];
                  const userList = c.users || [];
                  const activeAdmins = adminList.filter((a) => a.isActive !== false && a.status !== "INACTIVE").length;
                  const inactiveAdmins = (c.adminCount || 0) - activeAdmins;
                  const activeUsers = userList.filter((u) => u.isActive !== false && u.status !== "INACTIVE").length;
                  const inactiveUsers = (c.userCount || 0) - activeUsers;
                  const totalActive = activeAdmins + activeUsers;
                  const totalInactive = inactiveAdmins + inactiveUsers;

                  return (
                    <tr key={c.id} className={`hover:bg-nexus-hover/40 transition-colors ${!c.isActive ? "bg-amber-500/5" : ""}`}>
                      <td className="px-5 py-4 font-bold text-nexus-text text-[13.5px]">
                        {c.name}
                      </td>

                      <td className="px-5 py-4 text-xs text-nexus-muted font-medium">
                        {c.category || "General"}
                      </td>

                      <td className="px-5 py-4">
                        <span className={`inline-flex text-[11px] font-bold px-2.5 py-1 rounded-full border ${STATUS_COLOR[c.status] || STATUS_COLOR.ACTIVE}`}>
                          {c.status}
                        </span>
                      </td>

                      {/* Admins */}
                      <td className="px-5 py-4">
                        {c.isActive && (c.adminCount || 0) > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-black text-nexus-text">{c.adminCount}</span>
                            <div className="flex items-center gap-1 text-[11px] font-bold mt-0.5">
                              <span className="text-emerald-400">{activeAdmins}</span>
                              <span className="text-nexus-muted">•</span>
                              <span className="text-amber-400">{Math.max(0, inactiveAdmins)}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-nexus-text">{c.adminCount || 0}</span>
                        )}
                      </td>

                      {/* Users */}
                      <td className="px-5 py-4">
                        {c.isActive && (c.userCount || 0) > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-black text-nexus-text">{c.userCount}</span>
                            <div className="flex items-center gap-1 text-[11px] font-bold mt-0.5">
                              <span className="text-emerald-400">{activeUsers}</span>
                              <span className="text-nexus-muted">•</span>
                              <span className="text-amber-400">{Math.max(0, inactiveUsers)}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-nexus-text">{c.userCount || 0}</span>
                        )}
                      </td>

                      {/* Total Members */}
                      <td className="px-5 py-4">
                        {c.isActive && (c.totalMembers || 0) > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-black text-nexus-text">{c.totalMembers}</span>
                            <div className="flex items-center gap-1 text-[11px] font-bold mt-0.5">
                              <span className="text-emerald-400">{totalActive}</span>
                              <span className="text-nexus-muted">•</span>
                              <span className="text-amber-400">{Math.max(0, totalInactive)}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-nexus-text">{c.totalMembers || 0}</span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-xs text-nexus-muted">{formatDate(c.createdAt)}</td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => openEditCompany(c)}
                            className="p-1.5 rounded-md text-nexus-muted hover:text-nexus-primary hover:bg-nexus-primary/10 transition-colors"
                            title="Edit Company"
                          >
                            <IconEdit size={15} />
                          </button>
                          
                          <button
                            onClick={() => setConfirmToggleStatus(c)}
                            className={`p-1.5 rounded-md transition-colors ${
                              c.isActive
                                ? "text-nexus-muted hover:text-red-400 hover:bg-red-500/10"
                                : "text-emerald-400 hover:bg-emerald-500/10 font-bold"
                            }`}
                            title={c.isActive ? "Deactivate Company" : "Activate Company"}
                          >
                            {c.isActive ? <IconX size={15} /> : <IconCheck size={15} />}
                          </button>

                          <button
                            onClick={() => setConfirmSoftDelete(c)}
                            className="p-1.5 rounded-md text-nexus-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Delete"
                          >
                            <IconTrash size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── CREATE / EDIT COMPANY MODAL ────────────────────────────────── */}
        {showCompanyForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-nexus-card border border-nexus-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-5 border-b border-nexus-border">
                <div className="flex items-center gap-3">
                  <span className="p-2.5 bg-blue-500/10 rounded-xl text-blue-400">
                    <IconBuilding size={22} />
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-nexus-text">
                      {editCompanyTarget ? `Edit Company: ${editCompanyTarget.name}` : "Create New Company"}
                    </h2>
                    <p className="text-xs text-nexus-muted">
                      {editCompanyTarget ? "Update company profile and status" : "Register a new company in the system"}
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowCompanyForm(false)} className="p-2 text-nexus-muted hover:text-nexus-text hover:bg-nexus-hover rounded-lg transition-colors"><IconX size={18} /></button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-nexus-text-secondary mb-1 block">Company Name *</label>
                  <input
                    value={compName}
                    onChange={(e) => setCompName(e.target.value)}
                    placeholder="e.g. Acme Corporation, Tech Corp…"
                    className="w-full px-3 py-2.5 text-sm bg-nexus-bg border border-nexus-border rounded-xl text-nexus-text placeholder-nexus-muted focus:outline-none focus:border-nexus-primary font-semibold"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-nexus-text-secondary mb-1 block">Industry Category</label>
                  <select
                    value={compCategory}
                    onChange={(e) => setCompCategory(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-nexus-bg border border-nexus-border rounded-xl text-nexus-text focus:outline-none focus:border-nexus-primary"
                  >
                    {COMPANY_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {compCategory === "Other" && (
                  <div>
                    <label className="text-xs font-semibold text-nexus-text-secondary mb-1 block">Specify Custom Category</label>
                    <input
                      value={compCustomCat}
                      onChange={(e) => setCompCustomCat(e.target.value)}
                      placeholder="e.g. Aerospace, Biotech…"
                      className="w-full px-3 py-2 text-sm bg-nexus-bg border border-nexus-border rounded-xl text-nexus-text placeholder-nexus-muted focus:outline-none focus:border-nexus-primary"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-nexus-text-secondary mb-1 block">Company Status</label>
                  <select
                    value={compStatus}
                    onChange={(e) => setCompStatus(e.target.value as "ACTIVE" | "INACTIVE")}
                    className="w-full px-3 py-2.5 text-sm bg-nexus-bg border border-nexus-border rounded-xl text-nexus-text focus:outline-none focus:border-nexus-primary"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 px-6 py-4 border-t border-nexus-border bg-nexus-bg/30">
                <button onClick={() => setShowCompanyForm(false)} disabled={savingCompany} className="px-4 py-2 text-sm font-semibold text-nexus-muted border border-nexus-border rounded-xl hover:bg-nexus-hover disabled:opacity-50">Cancel</button>
                <button
                  onClick={handleSaveCompany}
                  disabled={savingCompany}
                  className="px-5 py-2 text-sm font-bold bg-nexus-primary text-black rounded-xl hover:bg-nexus-primary/90 shadow-lg shadow-nexus-primary/20 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {savingCompany && <IconLoader2 size={16} className="animate-spin" />}
                  {savingCompany ? "Saving…" : editCompanyTarget ? "Save Changes" : "Create Company"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── CONFIRM SOFT DELETE COMPANY MODAL ──────────────────────────── */}
        {confirmSoftDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-nexus-card border border-nexus-border rounded-2xl w-full max-w-sm shadow-2xl">
              <div className="p-6 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto">
                  <IconTrash size={24} className="text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-nexus-text">Move Company to Trash?</h3>
                  <p className="text-base font-bold text-nexus-text mt-2">{confirmSoftDelete.name}</p>
                </div>
              </div>
              <div className="flex gap-3 px-6 pb-6">
                <button onClick={() => setConfirmSoftDelete(null)} disabled={actionLoading} className="flex-1 px-4 py-2.5 text-sm font-semibold text-nexus-muted border border-nexus-border rounded-xl hover:bg-nexus-hover disabled:opacity-50">
                  Cancel
                </button>
                <button
                  onClick={() => handleSoftDeleteCompany(confirmSoftDelete)}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2.5 text-sm font-bold bg-amber-500 text-black rounded-xl hover:bg-amber-400 shadow-lg shadow-amber-500/25 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {actionLoading && <IconLoader2 size={16} className="animate-spin" />}
                  {actionLoading ? "Processing…" : "Move to Trash"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── CONFIRM TOGGLE STATUS COMPANY MODAL ───────────────────────── */}
        {confirmToggleStatus && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-nexus-card border border-nexus-border rounded-2xl w-full max-w-sm shadow-2xl">
              <div className="p-6 text-center space-y-4">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto border ${
                  confirmToggleStatus.isActive
                    ? "bg-red-500/10 border-red-500/20 text-red-400"
                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                }`}>
                  {confirmToggleStatus.isActive ? <IconX size={26} /> : <IconCheck size={26} />}
                </div>

                <div>
                  <h3 className="text-lg font-bold text-nexus-text">
                    {confirmToggleStatus.isActive ? "Deactivate Company?" : "Activate Company?"}
                  </h3>
                  <p className="text-base font-bold text-nexus-text mt-1">{confirmToggleStatus.name}</p>
                </div>
              </div>

              <div className="flex gap-3 px-6 pb-6">
                <button
                  onClick={() => setConfirmToggleStatus(null)}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-nexus-muted border border-nexus-border rounded-xl hover:bg-nexus-hover disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (confirmToggleStatus) {
                      handleToggleStatus(confirmToggleStatus);
                    }
                  }}
                  disabled={actionLoading}
                  className={`flex-1 px-4 py-2.5 text-sm font-bold text-black rounded-xl shadow-lg disabled:opacity-60 flex items-center justify-center gap-2 ${
                    confirmToggleStatus.isActive
                      ? "bg-amber-500 hover:bg-amber-400 shadow-amber-500/25"
                      : "bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/25"
                  }`}
                >
                  {actionLoading && <IconLoader2 size={16} className="animate-spin" />}
                  {actionLoading ? (confirmToggleStatus.isActive ? "Deactivating…" : "Activating…") : (confirmToggleStatus.isActive ? "Deactivate" : "Activate")}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </PermissionGuard>
  );
}
