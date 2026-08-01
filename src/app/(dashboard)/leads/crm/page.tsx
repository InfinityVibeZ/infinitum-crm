"use client";

import { useState, useEffect, useMemo } from "react";
import {
  IconSearch,
  IconFilter,
  IconPlus,
  IconUsers,
  IconEdit,
  IconTrash,
  IconHistory,
  IconClock,
  IconTrendingUp,
  IconAward,
  IconPhoneCall,
  IconCreditCard,
  IconRefresh,
  IconEye,
  IconX,
  IconLayoutKanban,
  IconTable,
} from "@tabler/icons-react";
import { LeadModal } from "@/components/leads/lead-modal";
import { ActivityModal } from "@/components/leads/activity-modal";
import { PaymentModal } from "@/components/leads/payment-modal";
import { useAuthStore } from "@/store/auth";
import { SuccessPopup } from "@/components/common/SuccessPopup";

export default function LeadsCRMPage() {
  const { user } = useAuthStore();
  const isUserRole = user?.role === "USER";
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [assignedFilter, setAssignedFilter] = useState("ALL");
  const [followUpFilter, setFollowUpFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState<"TABLE" | "KANBAN">("TABLE");

  const handleQuickStatusChange = async (leadId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchLeads();
      }
    } catch (err) {
      console.error("Failed to update lead status", err);
    }
  };

  // All users list for Assigned To filter
  const [allUsers, setAllUsers] = useState<any[]>([]);

  // Drag and Drop state for Kanban
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverStageKey, setDragOverStageKey] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData("text/plain", leadId);
    e.dataTransfer.effectAllowed = "move";
    setDraggedLeadId(leadId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragEnter = (stageKey: string) => {
    setDragOverStageKey(stageKey);
  };

  const handleDragLeave = (e: React.DragEvent, stageKey: string) => {
    if (dragOverStageKey === stageKey) {
      setDragOverStageKey(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetStageKey: string) => {
    e.preventDefault();
    setDragOverStageKey(null);
    const leadId = e.dataTransfer.getData("text/plain") || draggedLeadId;
    setDraggedLeadId(null);

    if (!leadId) return;

    const leadToUpdate = leads.find((l) => l.id === leadId);
    if (!leadToUpdate || leadToUpdate.status === targetStageKey) return;

    setLeads((prevLeads) =>
      prevLeads.map((l) => (l.id === leadId ? { ...l, status: targetStageKey } : l))
    );

    handleQuickStatusChange(leadId, targetStageKey);
  };

  // Sorting state
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Add / Edit Lead Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<any>(null);

  // Activity modal state
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [activityLead, setActivityLead] = useState<any>(null);

  // Payment modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentLead, setPaymentLead] = useState<any>(null);

  // Soft Delete Confirmation Modal state
  const [deletingLead, setDeletingLead] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Trash Modal state
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [trashLeads, setTrashLeads] = useState<any[]>([]);
  const [loadingTrash, setLoadingTrash] = useState(false);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leads`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setLeads(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch all company users for Assigned To filter
  const fetchCompanyUsers = async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setAllUsers(data);
      }
    } catch (err) {
      console.error("Failed to fetch users", err);
    }
  };

  // Filter users to only those under the same company (unless SuperAdmin)
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const userCompany = user?.company || user?.department || "";

  const { teamUsers, adminUsers } = useMemo(() => {
    let filtered = allUsers.filter((u) => u.isActive !== false && u.status !== "INACTIVE" && !u.isDeleted);
    if (!isSuperAdmin && userCompany) {
      filtered = filtered.filter((u) => {
        const uComp = (u.company || u.department || "").toLowerCase().trim();
        const currentComp = userCompany.toLowerCase().trim();
        return (
          uComp === currentComp ||
          (u.companyId && user?.companyId && u.companyId === user.companyId)
        );
      });
    }

    const team = filtered
      .filter((u) => u.role === "USER")
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    const admins = filtered
      .filter((u) => u.role !== "USER")
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    return { teamUsers: team, adminUsers: admins };
  }, [allUsers, isSuperAdmin, userCompany, user?.companyId]);

  // Active filter count (excludes search)
  const activeFilterCount = [
    statusFilter !== "ALL",
    priorityFilter !== "ALL",
    sourceFilter !== "ALL",
    assignedFilter !== "ALL",
    followUpFilter !== "ALL",
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setStatusFilter("ALL");
    setPriorityFilter("ALL");
    setSourceFilter("ALL");
    setAssignedFilter("ALL");
    setFollowUpFilter("ALL");
    setSearch("");
  };

  const fetchTrashLeads = async () => {
    setLoadingTrash(true);
    try {
      const res = await fetch(`/api/leads?trash=true`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setTrashLeads(data);
      }
    } catch (err) {
      console.error("Failed to fetch trash leads", err);
    } finally {
      setLoadingTrash(false);
    }
  };

  useEffect(() => {
    fetchLeads();
    fetchCompanyUsers();
  }, []);

  // Dynamic filter options derived ONLY from current leads table data
  const STATUS_LABELS: Record<string, string> = {
    NEW: "New",
    CONTACTED: "Contacted",
    QUALIFIED: "Qualified",
    PROPOSAL: "Proposal",
    NEGOTIATION: "Negotiation",
    WON: "Won",
    LOST: "Lost",
    HOLD: "Hold",
  };

  const PRIORITY_LABELS: Record<string, string> = {
    HIGH: "High",
    MEDIUM: "Medium",
    LOW: "Low",
  };

  const availableStatuses = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      if (l.status) set.add(l.status);
    });
    const ALL_ORDER = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST", "HOLD"];
    const ordered = ALL_ORDER.filter((s) => set.has(s));
    Array.from(set).forEach((s) => {
      if (!ordered.includes(s)) ordered.push(s);
    });
    return ordered;
  }, [leads]);

  const availablePriorities = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      if (l.priority) set.add(l.priority);
    });
    const ALL_ORDER = ["HIGH", "MEDIUM", "LOW"];
    const ordered = ALL_ORDER.filter((p) => set.has(p));
    Array.from(set).forEach((p) => {
      if (!ordered.includes(p)) ordered.push(p);
    });
    return ordered;
  }, [leads]);

  const availableSources = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      if (l.leadSource) set.add(l.leadSource);
    });
    return Array.from(set).sort();
  }, [leads]);

  const availableAssignees = useMemo(() => {
    const assigneeIds = new Set<string>();
    leads.forEach((l) => {
      if (l.user?.id) assigneeIds.add(l.user.id);
      if (l.userId) assigneeIds.add(l.userId);
    });

    const admins = adminUsers.filter((u) => assigneeIds.has(u.id));
    const team = teamUsers.filter((u) => assigneeIds.has(u.id));

    return { admins, team };
  }, [leads, adminUsers, teamUsers]);

  // Helper: Indian Currency Formatter
  const formatCurrency = (val: number) => {
    return `₹${val.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  };

  // Helper: Next Follow-Up Date — returns the follow-up date from the latest logged activity
  const getNextFollowUpDate = (lead: any) => {
    if (!Array.isArray(lead.activities) || lead.activities.length === 0) return null;

    // lead.activities are ordered by createdAt desc (latest activity first)
    for (const act of lead.activities) {
      let rawDate = act.nextFollowUpDate;
      if (!rawDate && act.description) {
        try {
          const parsed = JSON.parse(act.description);
          rawDate = parsed.followUpDate || parsed.nextFollowUpDate;
        } catch (e) {}
      }

      if (rawDate) {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          return d;
        }
      }
    }

    return null;
  };

  // ── Calculations for Professional Lead CRM Metrics ─────────────────────────────
  // 1. Total Leads & New this month
  const totalLeadsCount = leads.length;
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const newLeadsThisMonth = leads.filter(
    (l) => l.createdAt && new Date(l.createdAt) >= startOfMonth
  ).length;

  // 2. Follow-ups Breakdown (Overdue vs Today vs Upcoming)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  let overdueCount = 0;
  let dueTodayCount = 0;
  let upcomingCount = 0;

  leads.forEach((l) => {
    const fup = getNextFollowUpDate(l);
    if (fup) {
      if (fup < today) overdueCount++;
      else if (fup >= today && fup < tomorrow) dueTodayCount++;
      else upcomingCount++;
    }
  });
  const followUpsDueCount = overdueCount + dueTodayCount + upcomingCount;

  // 3. Active Pipeline Value & Open Deals count
  const openLeads = leads.filter((l) => !["WON", "LOST"].includes(l.status));
  const openLeadsCount = openLeads.length;
  const pipelineValue = openLeads.reduce(
    (sum, l) => sum + (parseFloat(l.revenueGenerated?.toString() || "0") || 0),
    0
  );

  // 4. Deals Won, Deals Lost & Conversion Rate (Win Rate)
  const dealsWonCount = leads.filter((l) => l.status === "WON").length;
  const dealsLostCount = leads.filter((l) => l.status === "LOST").length;
  const closedDealsTotal = dealsWonCount + dealsLostCount;
  const winRate = closedDealsTotal > 0 ? Math.round((dealsWonCount / closedDealsTotal) * 100) : 0;

  // 5. Total Cash Collected & Average Deal Value
  const totalRevenueGenerated = leads.reduce((sum, l) => {
    const totalPaid = Array.isArray(l.payments)
      ? l.payments
          .filter((p: any) => p.status === "PAID")
          .reduce((s: number, p: any) => s + parseFloat(p.amount.toString()), 0)
      : parseFloat(l.cashCollected?.toString() || "0");
    return sum + (totalPaid || 0);
  }, 0);

  const avgDealValue =
    dealsWonCount > 0
      ? totalRevenueGenerated / dealsWonCount
      : openLeadsCount > 0
      ? pipelineValue / openLeadsCount
      : 0;

  const sortedLeads = useMemo(() => {
    return [...leads].sort((a, b) => {
      let valA: any = "";
      let valB: any = "";

      if (sortBy === "name") {
        valA = `${a.firstName || ""} ${a.lastName || ""}`.toLowerCase();
        valB = `${b.firstName || ""} ${b.lastName || ""}`.toLowerCase();
      } else if (sortBy === "phone") {
        valA = (a.phone || "").toLowerCase();
        valB = (b.phone || "").toLowerCase();
      } else if (sortBy === "company") {
        valA = (a.company || "").toLowerCase();
        valB = (b.company || "").toLowerCase();
      } else if (sortBy === "status") {
        valA = (a.status || "").toLowerCase();
        valB = (b.status || "").toLowerCase();
      } else if (sortBy === "priority") {
        const priorityOrder: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };
        valA = priorityOrder[a.priority] || 0;
        valB = priorityOrder[b.priority] || 0;
      } else if (sortBy === "source") {
        valA = (a.leadSource || "").toLowerCase();
        valB = (b.leadSource || "").toLowerCase();
      } else if (sortBy === "revenue") {
        valA = parseFloat(a.revenueGenerated?.toString() || "0");
        valB = parseFloat(b.revenueGenerated?.toString() || "0");
      } else if (sortBy === "paid") {
        const paidA = Array.isArray(a.payments)
          ? a.payments.reduce((s: number, p: any) => s + parseFloat(p.amount.toString()), 0)
          : parseFloat(a.cashCollected?.toString() || "0");
        const paidB = Array.isArray(b.payments)
          ? b.payments.reduce((s: number, p: any) => s + parseFloat(p.amount.toString()), 0)
          : parseFloat(b.cashCollected?.toString() || "0");
        valA = paidA;
        valB = paidB;
      } else if (sortBy === "nextFollowUp") {
        const dateA = getNextFollowUpDate(a);
        const dateB = getNextFollowUpDate(b);
        valA = dateA ? dateA.getTime() : 0;
        valB = dateB ? dateB.getTime() : 0;
      } else {
        valA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        valB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [leads, sortBy, sortOrder, statusFilter, priorityFilter, sourceFilter, assignedFilter, followUpFilter, search]).filter((lead) => {
    if (search && search.trim() !== "") {
      const q = search.toLowerCase().trim();
      const name = `${lead.firstName || ""} ${lead.lastName || ""}`.toLowerCase();
      const phone = (lead.phone || "").toLowerCase();
      const email = (lead.email || "").toLowerCase();
      const company = (lead.company || "").toLowerCase();
      const jobTitle = (lead.jobTitle || "").toLowerCase();
      const category = (lead.category || "").toLowerCase();
      const location = (lead.location || "").toLowerCase();
      const interestedProduct = (lead.interestedProduct || "").toLowerCase();
      const userName = (lead.user?.name || "").toLowerCase();

      const matches =
        name.includes(q) ||
        phone.includes(q) ||
        email.includes(q) ||
        company.includes(q) ||
        jobTitle.includes(q) ||
        category.includes(q) ||
        location.includes(q) ||
        interestedProduct.includes(q) ||
        userName.includes(q);

      if (!matches) return false;
    }

    if (statusFilter !== "ALL" && lead.status !== statusFilter) return false;
    if (priorityFilter !== "ALL" && lead.priority !== priorityFilter) return false;
    if (sourceFilter !== "ALL" && lead.leadSource !== sourceFilter) return false;
    if (assignedFilter !== "ALL" && lead.user?.id !== assignedFilter && lead.userId !== assignedFilter) return false;

    if (followUpFilter !== "ALL") {
      const fupDate = getNextFollowUpDate(lead);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      if (followUpFilter === "ACTIVE") {
        if (!fupDate || fupDate < today) return false;
      } else if (followUpFilter === "TODAY") {
        if (!fupDate || fupDate < today || fupDate >= tomorrow) return false;
      } else if (followUpFilter === "OVERDUE") {
        if (!fupDate || fupDate >= today) return false;
      } else if (followUpFilter === "UPCOMING") {
        if (!fupDate || fupDate < tomorrow) return false;
      } else if (followUpFilter === "NONE") {
        if (fupDate !== null) return false;
      }
    }

    return true;
  });

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchLeads();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Check for related data before showing delete confirmation
  const handleDeleteClick = async (lead: any) => {
    try {
      const res = await fetch(`/api/leads/${lead.id}?validate=true`, {
        method: "DELETE",
      });

      if (res.ok) {
        // No related data found - show confirmation popup
        setDeletingLead(lead);
      } else {
        const data = await res.json();
        setErrorMessage(data.error || "Failed to delete lead");
      }
    } catch (err) {
      console.error("Error validating lead delete:", err);
      setErrorMessage("Failed to delete lead");
    }
  };

  // Soft Delete Handler
  const handleConfirmSoftDelete = async () => {
    if (!deletingLead) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/leads/${deletingLead.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchLeads();
        setDeletingLead(null);
        setSuccessMessage("Lead deleted successfully.");
      } else {
        const data = await res.json();
        setErrorMessage(data.error || "Failed to delete lead");
      }
    } catch (err) {
      console.error("Error soft deleting lead:", err);
      setErrorMessage("Failed to delete lead");
    } finally {
      setIsDeleting(false);
    }
  };

  // Restore Soft Deleted Lead Handler
  const handleRestoreLead = async (leadId: string) => {
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDeleted: false }),
      });
      if (res.ok) {
        fetchTrashLeads();
        fetchLeads();
      }
    } catch (err) {
      console.error("Error restoring lead:", err);
    }
  };

  // Permanent Delete Lead Handler (SuperAdmin)
  const handlePermanentDeleteLead = async (leadId: string) => {
    if (!confirm("Are you SURE you want to PERMANENTLY delete this lead? This action cannot be undone.")) return;
    try {
      const res = await fetch(`/api/leads/${leadId}?permanent=true`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchTrashLeads();
      }
    } catch (err) {
      console.error("Error permanently deleting lead:", err);
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case "NEW":
        return "bg-sky-500/10 text-sky-400 border-sky-500/20";
      case "CONTACTED":
        return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
      case "QUALIFIED":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "PROPOSAL":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "NEGOTIATION":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "WON":
        return "bg-teal-500/10 text-teal-400 border-teal-500/20";
      case "LOST":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      case "HOLD":
        return "bg-amber-500/10 text-amber-300 border-amber-500/30";
      default:
        return "bg-nexus-hover text-nexus-text-secondary border-nexus-border";
    }
  };

  const getPriorityBadgeStyle = (priority: string) => {
    switch (priority) {
      case "HIGH":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "MEDIUM":
        return "bg-sky-500/10 text-sky-400 border-sky-500/20";
      case "LOW":
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/20";
    }
  };

  const getPriorityDotStyle = (priority: string) => {
    switch (priority) {
      case "HIGH":
        return "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)]";
      case "MEDIUM":
        return "bg-sky-500 shadow-[0_0_6px_rgba(14,165,233,0.6)]";
      case "LOW":
      default:
        return "bg-slate-500";
    }
  };

  return (
    <div className="space-y-6 text-nexus-text">
      {successMessage && (
        <SuccessPopup message={successMessage} type="success" onClose={() => setSuccessMessage(null)} />
      )}
      {errorMessage && (
        <SuccessPopup message={errorMessage} type="error" onClose={() => setErrorMessage(null)} />
      )}

      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="p-2 bg-nexus-primary/10 rounded-xl text-nexus-primary">
              <IconUsers size={24} />
            </span>
            {isUserRole ? "My Leads" : "Leads CRM"}
          </h1>
          {!isUserRole && (
            <p className="text-sm text-nexus-text-secondary mt-1">
              Store and track your leads through the sales pipeline, activities, and payment status.
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 self-start md:self-auto">
          {/* View Mode Switcher */}
          <div className="flex items-center p-1 bg-nexus-card border border-nexus-border rounded-xl shadow-sm">
            <button
              onClick={() => setViewMode("TABLE")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "TABLE"
                  ? "bg-nexus-primary text-nexus-bg shadow-sm"
                  : "text-nexus-text-secondary hover:text-nexus-text hover:bg-nexus-hover"
              }`}
            >
              <IconTable size={16} />
              <span>Table</span>
            </button>
            <button
              onClick={() => setViewMode("KANBAN")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "KANBAN"
                  ? "bg-nexus-primary text-nexus-bg shadow-sm"
                  : "text-nexus-text-secondary hover:text-nexus-text hover:bg-nexus-hover"
              }`}
            >
              <IconLayoutKanban size={16} />
              <span>Kanban</span>
            </button>
          </div>

          {(user?.role === "SUPER_ADMIN" || user?.role === "ADMIN") && (
            <button
              onClick={() => {
                setEditingLead(null);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-nexus-[#10D078] bg-nexus-primary hover:bg-nexus-primary/90 text-nexus-bg font-semibold rounded-xl transition-colors shadow-lg shadow-nexus-primary/10 text-xs"
            >
              <IconPlus size={18} />
              <span>Add Lead</span>
            </button>
          )}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 select-none">
        {/* 1. Total Leads */}
        <div className="bg-nexus-card border border-nexus-border rounded-xl p-5">
          <div className="flex items-center justify-between text-nexus-text-secondary text-xs font-semibold uppercase tracking-wider">
            <span>Total Leads</span>
            <div className="p-2 bg-nexus-hover rounded-lg text-nexus-primary">
              <IconUsers size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-nexus-text flex items-baseline justify-between">
            <span>{totalLeadsCount}</span>
            <span className="text-xs font-medium text-emerald-400 font-sans">
              +{newLeadsThisMonth} this month
            </span>
          </div>
          <span className="text-xs text-nexus-muted">All leads in portfolio</span>
        </div>

        {/* 2. Follow-ups Due */}
        <div className="bg-nexus-card border border-nexus-border rounded-xl p-5">
          <div className="flex items-center justify-between text-nexus-text-secondary text-xs font-semibold uppercase tracking-wider">
            <span>Follow-ups Due</span>
            <div className="p-2 bg-nexus-hover rounded-lg text-amber-400">
              <IconPhoneCall size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-nexus-text">
            {followUpsDueCount}
          </div>
          <div className="text-xs text-amber-400/90 font-medium mt-0.5">
            {overdueCount > 0 ? `${overdueCount} overdue` : "0 overdue"} • {dueTodayCount} due today
          </div>
        </div>

        {/* 3. Pipeline Value */}
        <div className="bg-nexus-card border border-nexus-border rounded-xl p-5">
          <div className="flex items-center justify-between text-nexus-text-secondary text-xs font-semibold uppercase tracking-wider">
            <span>Pipeline Value</span>
            <div className="p-2 bg-nexus-hover rounded-lg text-sky-400">
              <IconTrendingUp size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-sky-400">
            {formatCurrency(pipelineValue)}
          </div>
          <span className="text-xs text-nexus-muted">{openLeadsCount} active opportunities</span>
        </div>

        {/* 4. Deals Won */}
        <div className="bg-nexus-card border border-nexus-border rounded-xl p-5">
          <div className="flex items-center justify-between text-nexus-text-secondary text-xs font-semibold uppercase tracking-wider">
            <span>Deals Won</span>
            <div className="p-2 bg-nexus-hover rounded-lg text-emerald-450">
              <IconAward size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-450 flex items-baseline justify-between">
            <span>{dealsWonCount}</span>
            <span className="text-xs font-semibold text-emerald-450/90 font-sans">
              {winRate}% win rate
            </span>
          </div>
          <span className="text-xs text-nexus-muted">Closed won deals</span>
        </div>

        {/* 5. Revenue Generated */}
        <div className="bg-nexus-card border border-nexus-border rounded-xl p-5">
          <div className="flex items-center justify-between text-nexus-text-secondary text-xs font-semibold uppercase tracking-wider">
            <span>Revenue Generated</span>
            <div className="p-2 bg-nexus-hover rounded-lg text-teal-400">
              <IconCreditCard size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-teal-400">
            {formatCurrency(totalRevenueGenerated)}
          </div>
          <span className="text-xs text-nexus-muted">
            Avg deal: {formatCurrency(avgDealValue)}
          </span>
        </div>
      </div>

      {/* Table Section & Filters */}
      <div className="bg-nexus-card border border-nexus-border rounded-xl">
        {/* Filter Bar — single row */}
        <div className="px-4 py-3 border-b border-nexus-border flex items-center gap-3 overflow-x-auto">
          {/* Search — left */}
          <div className="relative min-w-[220px] max-w-xs w-full">
            <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone, assignee, company..."
              className="w-full bg-nexus-bg border border-nexus-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-nexus-text placeholder:text-nexus-muted focus:outline-none focus:border-nexus-primary/50"
            />
          </div>

          {/* Divider */}
          <div className="h-5 w-px bg-nexus-border shrink-0" />

          {/* Filters label */}
          <div className="flex items-center gap-1 text-nexus-muted shrink-0">
            <IconFilter size={13} />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Filters:</span>
          </div>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`shrink-0 bg-nexus-bg border rounded-lg px-2.5 py-1.5 text-xs font-medium text-nexus-text focus:outline-none focus:border-nexus-primary/50 transition-colors ${
              statusFilter !== "ALL" ? "border-nexus-primary/60 text-nexus-primary" : "border-nexus-border"
            }`}
          >
            <option value="ALL">All Statuses</option>
            {availableStatuses.map((st) => (
              <option key={st} value={st}>
                {STATUS_LABELS[st] || st}
              </option>
            ))}
          </select>

          {/* Priority */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className={`shrink-0 bg-nexus-bg border rounded-lg px-2.5 py-1.5 text-xs font-medium text-nexus-text focus:outline-none focus:border-nexus-primary/50 transition-colors ${
              priorityFilter !== "ALL" ? "border-nexus-primary/60 text-nexus-primary" : "border-nexus-border"
            }`}
          >
            <option value="ALL">All Priorities</option>
            {availablePriorities.map((pr) => (
              <option key={pr} value={pr}>
                {PRIORITY_LABELS[pr] || pr}
              </option>
            ))}
          </select>

          {/* Lead Source */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className={`shrink-0 bg-nexus-bg border rounded-lg px-2.5 py-1.5 text-xs font-medium text-nexus-text focus:outline-none focus:border-nexus-primary/50 transition-colors ${
              sourceFilter !== "ALL" ? "border-nexus-primary/60 text-nexus-primary" : "border-nexus-border"
            }`}
          >
            <option value="ALL">All Sources</option>
            {availableSources.map((src) => (
              <option key={src} value={src}>
                {src}
              </option>
            ))}
          </select>

          {/* Assigned To */}
          <select
            value={assignedFilter}
            onChange={(e) => setAssignedFilter(e.target.value)}
            className={`shrink-0 bg-nexus-bg border rounded-lg px-2.5 py-1.5 text-xs font-medium text-nexus-text focus:outline-none focus:border-nexus-primary/50 transition-colors ${
              assignedFilter !== "ALL" ? "border-nexus-primary/60 text-nexus-primary" : "border-nexus-border"
            }`}
          >
              <option value="ALL">All Assignees</option>
              {availableAssignees.admins.length > 0 && (
                <optgroup label="Admins">
                  {availableAssignees.admins.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {availableAssignees.team.length > 0 && (
                <optgroup label="Users">
                  {availableAssignees.team.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </optgroup>
              )}
          </select>

          {/* Follow-up Filter */}
          <select
            value={followUpFilter}
            onChange={(e) => setFollowUpFilter(e.target.value)}
            className={`shrink-0 bg-nexus-bg border rounded-lg px-2.5 py-1.5 text-xs font-medium text-nexus-text focus:outline-none focus:border-nexus-primary/50 transition-colors ${
              followUpFilter !== "ALL" ? "border-nexus-primary/60 text-nexus-primary" : "border-nexus-border"
            }`}
          >
            <option value="ALL">All Follow-ups</option>
            <option value="ACTIVE">Active Follow-up</option>
            <option value="TODAY">Due Today</option>
            <option value="OVERDUE">Overdue</option>
            <option value="UPCOMING">Upcoming</option>
            <option value="NONE">No Follow-up</option>
          </select>

          {/* Clear button — appears when any filter active */}
          {(activeFilterCount > 0 || search) && (
            <button
              onClick={clearAllFilters}
              className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-nexus-primary/10 text-nexus-primary border border-nexus-primary/30 hover:bg-nexus-primary/20 transition-colors"
            >
              <IconX size={12} />
              Clear
              {activeFilterCount > 0 && (
                <span className="bg-nexus-primary text-nexus-bg rounded-full w-3.5 h-3.5 flex items-center justify-center text-[9px] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Conditional View Rendering: Table View vs Kanban Board View */}
        {viewMode === "TABLE" ? (
          /* Data Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-nexus-border text-[11px] font-semibold uppercase tracking-wider text-nexus-muted select-none">
                  <th className="p-4 cursor-pointer hover:text-nexus-primary transition-colors" onClick={() => handleSort("name")}>
                    Name {sortBy === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  {!isUserRole && (
                    <th className="p-4 cursor-pointer hover:text-nexus-primary transition-colors" onClick={() => handleSort("user")}>
                      Assigned To {sortBy === "user" && (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                  )}
                  <th className="p-4 cursor-pointer hover:text-nexus-primary transition-colors" onClick={() => handleSort("company")}>
                    Company & Title {sortBy === "company" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="p-4 cursor-pointer hover:text-nexus-primary transition-colors" onClick={() => handleSort("status")}>
                    Status {sortBy === "status" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="p-4 cursor-pointer hover:text-nexus-primary transition-colors" onClick={() => handleSort("priority")}>
                    Priority {sortBy === "priority" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="p-4 cursor-pointer hover:text-nexus-primary transition-colors" onClick={() => handleSort("source")}>
                    Lead Source {sortBy === "source" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="p-4 cursor-pointer hover:text-nexus-primary transition-colors" onClick={() => handleSort("revenue")}>
                    Deal Value {sortBy === "revenue" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="p-4 cursor-pointer hover:text-nexus-primary transition-colors" onClick={() => handleSort("paid")}>
                    Paid {sortBy === "paid" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="p-4">Balance</th>
                  <th className="p-4 cursor-pointer hover:text-nexus-primary transition-colors" onClick={() => handleSort("nextFollowUp")}>
                    Next Follow-up {sortBy === "nextFollowUp" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="p-4 cursor-pointer hover:text-nexus-primary transition-colors" onClick={() => handleSort("createdAt")}>
                    Created {sortBy === "createdAt" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nexus-border text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={isUserRole ? 11 : 12} className="p-8 text-center text-nexus-muted">
                      Loading leads database…
                    </td>
                  </tr>
                ) : sortedLeads.length === 0 ? (
                  <tr>
                    <td colSpan={isUserRole ? 11 : 12} className="p-12 text-center text-nexus-muted">
                      <div className="max-w-xs mx-auto space-y-3">
                        <p className="text-sm font-semibold text-nexus-text">No leads found</p>
                        <p className="text-xs text-nexus-muted">
                          No leads match your current search or filter criteria. Try adjusting your filters.
                        </p>
                        <button
                          onClick={clearAllFilters}
                          className="px-3 py-1.5 bg-nexus-primary/10 text-nexus-primary rounded-lg text-xs font-semibold hover:bg-nexus-primary/20 transition-colors"
                        >
                          Clear all filters
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sortedLeads.map((lead) => {
                    const fullName = `${lead.firstName || ""} ${lead.lastName || ""}`.trim() || "Unnamed Lead";
                    const createdDate = lead.createdAt
                      ? new Date(lead.createdAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "—";

                    const nextFupDateObj = getNextFollowUpDate(lead);
                    const formattedNextFup = nextFupDateObj
                      ? nextFupDateObj.toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "—";

                    const isOverdue = nextFupDateObj ? nextFupDateObj < new Date(new Date().setHours(0,0,0,0)) : false;

                    const totalPaid = Array.isArray(lead.payments)
                      ? lead.payments
                          .filter((p: any) => p.status === "PAID")
                          .reduce((sum: number, p: any) => sum + parseFloat(p.amount.toString()), 0)
                      : parseFloat(lead.cashCollected?.toString() || "0");
                    const totalDealVal = parseFloat(lead.revenueGenerated?.toString() || "0");
                    const balance = Math.max(0, totalDealVal - totalPaid);

                    return (
                      <tr key={lead.id} className="hover:bg-nexus-hover/50 transition-colors group">
                        {/* Name & Phone Number underneath */}
                        <td className="p-4">
                          <div className="font-semibold text-nexus-text">
                            {fullName}
                          </div>
                          <div className="text-xs font-medium text-nexus-primary mt-0.5">
                            {lead.phone || "—"}
                          </div>
                        </td>

                        {/* Assigned To */}
                        {!isUserRole && (
                          <td className="p-4 text-xs font-medium text-nexus-text">
                            {lead.user?.name || <span className="text-nexus-muted font-normal">Unassigned</span>}
                          </td>
                        )}

                        {/* Company & Title */}
                        <td className="p-4">
                          <div className="text-xs font-medium text-nexus-text">{lead.company || "—"}</div>
                          {lead.jobTitle && <div className="text-[11px] text-nexus-muted">{lead.jobTitle}</div>}
                        </td>

                        {/* Status */}
                        <td className="p-4">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusBadgeStyle(lead.status)}`}>
                            {lead.status || "NEW"}
                          </span>
                        </td>

                        {/* Priority */}
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getPriorityBadgeStyle(lead.priority)}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${getPriorityDotStyle(lead.priority)}`} />
                            {lead.priority || "LOW"}
                          </span>
                        </td>

                        {/* Lead Source */}
                        <td className="p-4 text-xs text-nexus-text-secondary whitespace-nowrap">
                          {lead.leadSource || "—"}
                        </td>

                        {/* Deal Value */}
                        <td className="p-4 text-xs font-bold text-nexus-text whitespace-nowrap">
                          {formatCurrency(totalDealVal)}
                        </td>

                        {/* Paid Amount */}
                        <td className="p-4 text-xs font-bold text-emerald-450 whitespace-nowrap">
                          {formatCurrency(totalPaid)}
                        </td>

                        {/* Balance Remaining */}
                        <td className="p-4 text-xs font-bold text-rose-400 whitespace-nowrap">
                          {balance > 0 ? formatCurrency(balance) : <span className="text-nexus-muted font-normal">₹0</span>}
                        </td>

                        {/* Next Follow-up Date (from latest activity) */}
                        <td className={`p-4 text-xs font-semibold whitespace-nowrap ${isOverdue ? "text-rose-400 font-bold" : "text-nexus-text-secondary"}`}>
                          {formattedNextFup}
                        </td>

                        {/* Created */}
                        <td className="p-4 text-xs text-nexus-muted whitespace-nowrap">
                          {createdDate}
                        </td>

                        {/* Actions Column (4 Actions) */}
                        <td className="p-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {isUserRole ? (
                              <>
                                {/* View */}
                                <button
                                  onClick={() => {
                                    setEditingLead(lead);
                                    setIsModalOpen(true);
                                  }}
                                  className="p-1.5 text-nexus-muted hover:text-nexus-text hover:bg-nexus-hover rounded-lg transition-colors"
                                  title="View Lead Details"
                                >
                                  <IconEye size={16} />
                                </button>

                                {/* Log Activity / Follow-up */}
                                <button
                                  onClick={() => {
                                    setActivityLead(lead);
                                    setIsActivityModalOpen(true);
                                  }}
                                  className="p-1.5 text-nexus-muted hover:text-sky-400 hover:bg-nexus-hover rounded-lg transition-colors"
                                  title="Log Activity / Follow-up"
                                >
                                  <IconClock size={16} />
                                </button>

                                {/* Payments */}
                                <button
                                  onClick={() => {
                                    setPaymentLead(lead);
                                    setIsPaymentModalOpen(true);
                                  }}
                                  className="p-1.5 text-nexus-muted hover:text-emerald-450 hover:bg-nexus-hover rounded-lg transition-colors"
                                  title="Payments"
                                >
                                  <IconCreditCard size={16} />
                                </button>
                              </>
                            ) : (
                              <>
                                {/* 1. Edit Lead */}
                                <button
                                  onClick={() => {
                                    setEditingLead(lead);
                                    setIsModalOpen(true);
                                  }}
                                  className="p-1.5 text-nexus-muted hover:text-nexus-primary hover:bg-nexus-hover rounded-lg transition-colors"
                                  title="Edit Lead"
                                >
                                  <IconEdit size={16} />
                                </button>

                                {/* 2. Activity / Follow-up */}
                                <button
                                  onClick={() => {
                                    setActivityLead(lead);
                                    setIsActivityModalOpen(true);
                                  }}
                                  className="p-1.5 text-nexus-muted hover:text-sky-400 hover:bg-nexus-hover rounded-lg transition-colors"
                                  title="Log Activity / Follow-up"
                                >
                                  <IconClock size={16} />
                                </button>

                                {/* 3. Payments */}
                                <button
                                  onClick={() => {
                                    setPaymentLead(lead);
                                    setIsPaymentModalOpen(true);
                                  }}
                                  className="p-1.5 text-nexus-muted hover:text-emerald-450 hover:bg-nexus-hover rounded-lg transition-colors"
                                  title="Payments"
                                >
                                  <IconCreditCard size={16} />
                                </button>

                                {/* 4. Delete Lead (Soft Delete) */}
                                <button
                                  onClick={() => handleDeleteClick(lead)}
                                  className="p-1.5 text-nexus-muted hover:text-red-400 hover:bg-nexus-hover rounded-lg transition-colors"
                                  title="Delete Lead"
                                >
                                  <IconTrash size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Kanban Board View */
          <div className="p-4">
            <div className="flex gap-4 overflow-x-auto pb-6 pt-2 items-start">
              {[
                { key: "NEW", label: "New Leads", color: "border-sky-500/40 text-sky-400 bg-sky-500/10" },
                { key: "CONTACTED", label: "Contacted", color: "border-indigo-500/40 text-indigo-400 bg-indigo-500/10" },
                { key: "QUALIFIED", label: "Qualified", color: "border-[#10D078]/40 text-[#10D078] bg-[#10D078]/10" },
                { key: "PROPOSAL", label: "Proposal", color: "border-purple-500/40 text-purple-400 bg-purple-500/10" },
                { key: "NEGOTIATION", label: "Negotiation", color: "border-amber-500/40 text-amber-400 bg-amber-500/10" },
                { key: "WON", label: "Won", color: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10" },
                { key: "LOST", label: "Lost", color: "border-rose-500/40 text-rose-400 bg-rose-500/10" },
              ].map((stage) => {
                const stageLeads = sortedLeads.filter((l) => (l.status || "NEW") === stage.key);
                const stageTotalValue = stageLeads.reduce(
                  (sum, l) => sum + (parseFloat(l.revenueGenerated?.toString() || "0") || 0),
                  0
                );

                const isDragTarget = dragOverStageKey === stage.key;

                return (
                  <div
                    key={stage.key}
                    onDragOver={handleDragOver}
                    onDragEnter={() => handleDragEnter(stage.key)}
                    onDragLeave={(e) => handleDragLeave(e, stage.key)}
                    onDrop={(e) => handleDrop(e, stage.key)}
                    className={`w-80 shrink-0 bg-nexus-bg border rounded-xl flex flex-col max-h-[calc(100vh-280px)] shadow-sm transition-all ${
                      isDragTarget
                        ? "border-nexus-primary/80 ring-2 ring-nexus-primary/30 bg-nexus-primary/5"
                        : "border-nexus-border"
                    }`}
                  >
                    {/* Column Header */}
                    <div className="p-3 border-b border-nexus-border flex items-center justify-between bg-nexus-hover/30 rounded-t-xl">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold border ${stage.color}`}>
                          {stage.label}
                        </span>
                        <span className="text-xs font-bold text-nexus-text">
                          ({stageLeads.length})
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-nexus-muted">
                        {formatCurrency(stageTotalValue)}
                      </span>
                    </div>

                    {/* Cards Container */}
                    <div className="p-3 overflow-y-auto space-y-3 flex-1">
                      {stageLeads.length === 0 ? (
                        <div
                          className={`p-6 text-center text-xs border border-dashed rounded-lg transition-colors ${
                            isDragTarget
                              ? "border-nexus-primary text-nexus-primary bg-nexus-primary/10 font-bold"
                              : "border-nexus-border text-nexus-muted"
                          }`}
                        >
                          {isDragTarget ? "Drop lead here" : `No leads in ${stage.label}`}
                        </div>
                      ) : (
                        stageLeads.map((lead) => {
                          const fullName = `${lead.firstName || ""} ${lead.lastName || ""}`.trim() || "Unnamed Lead";
                          const fupDate = getNextFollowUpDate(lead);
                          const isBeingDragged = draggedLeadId === lead.id;

                          return (
                            <div
                              key={lead.id}
                              draggable={true}
                              onDragStart={(e) => handleDragStart(e, lead.id)}
                              className={`bg-nexus-card border rounded-xl p-3.5 space-y-2.5 shadow-sm transition-all hover:shadow-md cursor-grab active:cursor-grabbing ${
                                isBeingDragged
                                  ? "opacity-40 border-dashed border-nexus-primary scale-95"
                                  : "border-nexus-border hover:border-nexus-primary/50"
                              }`}
                            >
                              {/* Top Row: Name & Priority */}
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h4 className="font-bold text-sm text-nexus-text leading-snug">
                                    {fullName}
                                  </h4>
                                  {(lead.company || lead.jobTitle) && (
                                    <p className="text-xs text-nexus-text-secondary mt-0.5">
                                      {[lead.company, lead.jobTitle].filter(Boolean).join(" • ")}
                                    </p>
                                  )}
                                </div>
                                <span
                                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase shrink-0 ${
                                    lead.priority === "HIGH"
                                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                                      : lead.priority === "MEDIUM"
                                      ? "bg-sky-500/10 text-sky-400 border border-sky-500/30"
                                      : "bg-slate-500/10 text-slate-400 border border-slate-500/30"
                                  }`}
                                >
                                  {lead.priority || "LOW"}
                                </span>
                              </div>

                              {/* Details Row: Product & Deal Value */}
                              <div className="flex items-center justify-between text-xs pt-1 border-t border-nexus-border/50">
                                <span className="text-nexus-muted font-medium truncate max-w-[130px]">
                                  {lead.interestedProduct || lead.category || "General"}
                                </span>
                                <span className="font-bold text-[#10D078]">
                                  {formatCurrency(parseFloat(lead.revenueGenerated?.toString() || "0"))}
                                </span>
                              </div>

                              {/* Assignee & Follow-up Row */}
                              <div className="flex items-center justify-between text-xs text-nexus-muted pt-1">
                                <span className="text-[11px] font-medium text-nexus-text-secondary truncate max-w-[120px]">
                                  {lead.user?.name || "Unassigned"}
                                </span>

                                {fupDate ? (
                                  <span className="text-[11px] font-semibold text-amber-400 flex items-center gap-1">
                                    <IconPhoneCall size={11} />
                                    {fupDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-nexus-muted">No follow-up</span>
                                )}
                              </div>

                              {/* Card Footer: Table Format Actions (No Status Dropdown) */}
                              <div className="flex items-center justify-end pt-2 border-t border-nexus-border/50 gap-1">
                                {user?.role === "USER" ? (
                                  <button
                                    onClick={() => {
                                      setEditingLead(lead);
                                      setIsModalOpen(true);
                                    }}
                                    className="p-1.5 text-nexus-muted hover:text-nexus-text hover:bg-nexus-hover rounded-lg transition-colors"
                                    title="View Lead Details"
                                  >
                                    <IconEye size={15} />
                                  </button>
                                ) : (
                                  <>
                                    {/* 1. Edit Lead */}
                                    <button
                                      onClick={() => {
                                        setEditingLead(lead);
                                        setIsModalOpen(true);
                                      }}
                                      className="p-1.5 text-nexus-muted hover:text-nexus-primary hover:bg-nexus-hover rounded-lg transition-colors"
                                      title="Edit Lead"
                                    >
                                      <IconEdit size={15} />
                                    </button>

                                    {/* 2. Activity / Follow-up */}
                                    <button
                                      onClick={() => {
                                        setActivityLead(lead);
                                        setIsActivityModalOpen(true);
                                      }}
                                      className="p-1.5 text-nexus-muted hover:text-sky-400 hover:bg-nexus-hover rounded-lg transition-colors"
                                      title="Log Activity / Follow-up"
                                    >
                                      <IconClock size={15} />
                                    </button>

                                    {/* 3. Payments */}
                                    <button
                                      onClick={() => {
                                        setPaymentLead(lead);
                                        setIsPaymentModalOpen(true);
                                      }}
                                      className="p-1.5 text-nexus-muted hover:text-emerald-450 hover:bg-nexus-hover rounded-lg transition-colors"
                                      title="Payments"
                                    >
                                      <IconCreditCard size={15} />
                                    </button>

                                    {/* 4. Delete Lead */}
                                    <button
                                      onClick={() => handleDeleteClick(lead)}
                                      className="p-1.5 text-nexus-muted hover:text-red-400 hover:bg-nexus-hover rounded-lg transition-colors"
                                      title="Delete Lead"
                                    >
                                      <IconTrash size={15} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Lead Modal */}
      <LeadModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingLead(null);
        }}
        onSuccess={(message) => {
          fetchLeads();
          if (message) setSuccessMessage(message);
        }}
        leadData={editingLead}
      />

      {/* Activity / Follow-Up Modal */}
      <ActivityModal
        isOpen={isActivityModalOpen}
        onClose={() => {
          setIsActivityModalOpen(false);
          setActivityLead(null);
        }}
        lead={activityLead}
        onActivityUpdated={fetchLeads}
        onShowMessage={(msg, type) => {
          if (type === "success") setSuccessMessage(msg);
          else setErrorMessage(msg);
        }}
        currentUserId={user?.id}
      />

      {/* Payment Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setPaymentLead(null);
        }}
        lead={paymentLead}
        onPaymentUpdated={fetchLeads}
        onShowMessage={(msg, type) => {
          if (type === "success") setSuccessMessage(msg);
          else setErrorMessage(msg);
        }}
      />

      {/* Soft Delete Confirmation Modal */}
      {deletingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-nexus-card border border-nexus-border rounded-xl w-full max-w-md p-6 space-y-4 shadow-2xl text-nexus-text">
            <h3 className="text-lg font-bold text-red-400">Delete Lead?</h3>
            <p className="text-sm text-nexus-text-secondary leading-relaxed">
              Are you sure you want to delete <strong>{deletingLead.firstName} {deletingLead.lastName}</strong> {deletingLead.company ? `(${deletingLead.company})` : ""}?
              {user?.role === "SUPER_ADMIN" && (
                <>
                  <br /><br />
                  The lead will be moved to <strong>Deleted Leads (Trash)</strong> and can be restored at any time.
                </>
              )}
            </p>
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-nexus-border">
              <button
                type="button"
                onClick={() => setDeletingLead(null)}
                className="px-4 py-2 text-xs font-semibold text-nexus-muted hover:text-nexus-text border border-nexus-border rounded-lg hover:bg-nexus-hover transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmSoftDelete}
                className="px-4 py-2 text-xs font-bold bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors shadow-md disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete Lead"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trash / Deleted Leads Modal */}
      {isTrashOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-nexus-card border border-nexus-border rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-nexus-text">
            <div className="px-6 py-4 border-b border-nexus-border flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-nexus-text flex items-center gap-2">
                  <span className="p-1.5 bg-red-500/10 rounded-lg text-red-400">
                    <IconTrash size={20} />
                  </span>
                  <span>Deleted Leads (Trash)</span>
                </h2>
                <p className="text-xs text-nexus-muted mt-0.5">
                  View soft-deleted leads and restore them with all connected activities and payments.
                </p>
              </div>
              <button
                onClick={() => setIsTrashOpen(false)}
                className="text-nexus-muted hover:text-nexus-text transition-colors p-1 rounded-lg hover:bg-nexus-hover"
              >
                <IconX size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingTrash ? (
                <div className="text-center py-8 text-xs text-nexus-muted">Loading trash...</div>
              ) : trashLeads.length === 0 ? (
                <div className="text-center py-10 text-xs text-nexus-muted bg-nexus-bg/30 border border-nexus-border rounded-xl">
                  No deleted leads in trash.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-nexus-border text-[11px] font-semibold uppercase tracking-wider text-nexus-muted">
                        <th className="py-2.5 px-3">Name</th>
                        <th className="py-2.5 px-3">Company</th>
                        <th className="py-2.5 px-3">Deleted Date</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-nexus-border text-xs">
                      {trashLeads.map((tLead) => (
                        <tr key={tLead.id} className="hover:bg-nexus-hover/50">
                          <td className="py-2.5 px-3 font-semibold">
                            {tLead.firstName} {tLead.lastName}
                          </td>
                          <td className="py-2.5 px-3 text-nexus-text-secondary">
                            {tLead.company || "—"}
                          </td>
                          <td className="py-2.5 px-3 text-nexus-muted">
                            {tLead.deletedAt ? new Date(tLead.deletedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-right space-x-2">
                            <button
                              type="button"
                              onClick={() => handleRestoreLead(tLead.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-nexus-primary/20 text-nexus-primary border border-nexus-primary/30 rounded-lg hover:bg-nexus-primary hover:text-nexus-bg transition-colors"
                            >
                              <IconRefresh size={12} />
                              <span>Restore</span>
                            </button>
                            {user?.role === "SUPER_ADMIN" && (
                              <button
                                type="button"
                                onClick={() => handlePermanentDeleteLead(tLead.id)}
                                className="px-2.5 py-1 text-[11px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
                              >
                                Delete Permanently
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-nexus-border flex items-center justify-end bg-nexus-card/50">
              <button
                type="button"
                onClick={() => setIsTrashOpen(false)}
                className="px-4 py-1.5 text-xs font-semibold bg-nexus-hover hover:bg-nexus-border text-nexus-text rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
