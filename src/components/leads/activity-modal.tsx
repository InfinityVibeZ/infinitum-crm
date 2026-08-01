"use client";

import { useState, useEffect, useMemo } from "react";
import {
  IconHistory,
  IconClock,
  IconX,
  IconEdit,
  IconTrash,
  IconPhone,
  IconMessage,
  IconMail,
  IconUsers,
  IconTrendingUp,
  IconCreditCard,
  IconCalendar,
  IconChartBar,
  IconTable,
  IconCheck,
} from "@tabler/icons-react";

interface ActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: any;
  onActivityUpdated?: () => void;
  onShowMessage?: (message: string, type: "success" | "error") => void;
  currentUserId?: string;
}

const format12HrDateTime = (dateVal: any, fallbackTime?: string | null) => {
  if (!dateVal) return "N/A";
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return "N/A";

  const dateStr = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const timeStr = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return `${dateStr}, ${timeStr}`;
};

const formatFollowUpDisplay = (fDate: any, fTime?: string | null, fType?: string | null) => {
  if (!fDate) return null;
  const d = new Date(fDate);
  if (isNaN(d.getTime())) return null;

  const dStr = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return `${dStr} ${fTime ? `• ${fTime}` : ""} (${fType || "Call"})`;
};

export function ActivityModal({ isOpen, onClose, lead, onActivityUpdated, onShowMessage, currentUserId }: ActivityModalProps) {
  const [timelineData, setTimelineData] = useState<{
    lead?: any;
    activities: any[];
    statusHistory: any[];
    payments: any[];
  }>({
    activities: [],
    statusHistory: [],
    payments: [],
  });

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingActivityId, setDeletingActivityId] = useState<string | null>(null);

  // Format Switcher State: "progress" (Timeline Cards) or "table" (Table View)
  const [timelineFormat, setTimelineFormat] = useState<"progress" | "table">("progress");

  // Form states
  const [activityId, setActivityId] = useState<string | null>(null);
  const [type, setType] = useState("Call");
  const [visitDate, setVisitDate] = useState("");
  const [outcome, setOutcome] = useState("Interested");
  const [newStatus, setNewStatus] = useState("NO_CHANGE");
  const [lostReason, setLostReason] = useState("");
  const [summary, setSummary] = useState("");

  // Schedule Next Follow-Up
  const [followUpDate, setFollowUpDate] = useState("");
  const [nextFollowUpTime, setNextFollowUpTime] = useState("");
  const [nextFollowUpType, setNextFollowUpType] = useState("Call");

  useEffect(() => {
    if (isOpen && lead?.id) {
      fetchTimelineData();
      resetForm();
    }
  }, [isOpen, lead]);

  const fetchTimelineData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/activities`);
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === "object") {
          if (Array.isArray(data)) {
            setTimelineData({ activities: data, statusHistory: [], payments: [] });
          } else {
            setTimelineData({
              lead: data.lead || lead,
              activities: data.activities || [],
              statusHistory: data.statusHistory || [],
              payments: data.payments || [],
            });
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch timeline data", err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setActivityId(null);
    setType("Call");
    setVisitDate(new Date().toISOString().split("T")[0]);
    setOutcome("Interested");
    setNewStatus("NO_CHANGE");
    setLostReason("");
    setSummary("");
    setFollowUpDate("");
    setNextFollowUpTime("10:00");
    setNextFollowUpType("Call");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      activityId,
      type,
      visitDate,
      outcome,
      newStatus,
      lostReason: newStatus === "LOST" ? lostReason : undefined,
      summary,
      followUpDate: followUpDate || null,
      nextFollowUpTime: nextFollowUpTime || null,
      nextFollowUpType: nextFollowUpType || null,
      related: `${lead?.firstName || ""} ${lead?.lastName || ""}`.trim(),
    };

    try {
      const method = activityId ? "PUT" : "POST";
      const res = await fetch(`/api/leads/${lead.id}/activities`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        fetchTimelineData();
        resetForm();
        if (onShowMessage) onShowMessage("Activity saved successfully", "success");
        if (onActivityUpdated) onActivityUpdated();
      }
    } catch (err) {
      console.error("Failed to save activity", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (act: any) => {
    let parsed: any = {};
    try {
      parsed = JSON.parse(act.description || "{}");
    } catch (e) {
      parsed = { summary: act.description };
    }

    setActivityId(act.id);

    let uiType = "Call";
    if (act.type === "MEETING") uiType = "Meeting";
    else if (act.type === "EMAIL") uiType = "Email";
    else if (parsed.customType) uiType = parsed.customType;

    setType(uiType);
    setVisitDate(parsed.visitDate || new Date(act.createdAt).toISOString().split("T")[0]);
    setOutcome(act.outcome || parsed.outcome || "Interested");
    setNewStatus(parsed.newStatus || "NO_CHANGE");
    setSummary(parsed.summary || "");
    setFollowUpDate(
      act.nextFollowUpDate
        ? new Date(act.nextFollowUpDate).toISOString().split("T")[0]
        : parsed.followUpDate || ""
    );
    setNextFollowUpTime(act.nextFollowUpTime || parsed.nextFollowUpTime || "10:00");
    setNextFollowUpType(act.nextFollowUpType || parsed.nextFollowUpType || "Call");
  };

  const handleDelete = (activityIdToDelete: string) => {
    setDeletingActivityId(activityIdToDelete);
  };

  const handleConfirmDelete = async () => {
    if (!deletingActivityId) return;
    const activityIdToDelete = deletingActivityId;

    try {
      const res = await fetch(`/api/leads/${lead.id}/activities?activityId=${activityIdToDelete}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchTimelineData();
        if (activityId === activityIdToDelete) {
          resetForm();
        }
        if (onActivityUpdated) onActivityUpdated();
        if (onShowMessage) onShowMessage("Activity deleted successfully", "success");
      } else {
        if (onShowMessage) onShowMessage("Failed to delete activity", "error");
      }
    } catch (err) {
      console.error("Failed to delete activity", err);
      if (onShowMessage) onShowMessage("Failed to delete activity", "error");
    } finally {
      setDeletingActivityId(null);
    }
  };

  const leadName = lead ? `${lead.firstName || ""} ${lead.lastName || ""}`.trim() : "";
  const companyName = lead?.company || "";
  const currentStatus = timelineData.lead?.status || lead?.status || "NEW";

  const getStatusBadgeStyle = (st: string) => {
    switch (st) {
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
      default:
        return "bg-nexus-hover text-nexus-text-secondary border-nexus-border";
    }
  };

  const getActivityIcon = (actType: string) => {
    const t = actType.toLowerCase();
    if (t.includes("call")) return <IconPhone size={14} className="text-sky-400" />;
    if (t.includes("whatsapp")) return <IconMessage size={14} className="text-emerald-450" />;
    if (t.includes("email")) return <IconMail size={14} className="text-amber-400" />;
    if (t.includes("meeting") || t.includes("demo")) return <IconUsers size={14} className="text-purple-400" />;
    return <IconHistory size={14} className="text-nexus-primary" />;
  };

  // Merge timeline items into chronological unified timeline
  const unifiedTimeline = useMemo(() => {
    const items: any[] = [];
    let hasCreatedEvent = false;

    // 1. Status Changes & Initial Lead Creation from Status History
    if (Array.isArray(timelineData.statusHistory)) {
      timelineData.statusHistory.forEach((sh) => {
        if (!sh.fromStatus) {
          hasCreatedEvent = true;
          items.push({
            id: `created-sh-${sh.id}`,
            type: "LEAD_CREATED",
            timestamp: new Date(sh.changedAt).getTime(),
            dateStr: format12HrDateTime(sh.changedAt),
            title: "LEAD CREATED",
            details: `Initial Status: ${sh.toStatus || "NEW"}`,
            actor: sh.user?.name || "System",
          });
        } else if (sh.fromStatus !== sh.toStatus) {
          items.push({
            id: `status-${sh.id}`,
            type: "STATUS_CHANGE",
            timestamp: new Date(sh.changedAt).getTime(),
            dateStr: format12HrDateTime(sh.changedAt),
            fromStatus: sh.fromStatus,
            toStatus: sh.toStatus,
            changedBy: sh.user?.name || "System",
            reason: sh.reason,
            lostReason: sh.lostReason,
            actor: sh.user?.name || "System",
          });
        }
      });
    }

    // 2. Fallback Lead Created Event if no status history entry with null fromStatus exists
    if (!hasCreatedEvent) {
      const creationTime = lead?.createdAt || timelineData.lead?.createdAt;
      if (creationTime && lead?.id) {
        items.push({
          id: `created-${lead.id}`,
          type: "LEAD_CREATED",
          timestamp: new Date(creationTime).getTime(),
          dateStr: format12HrDateTime(creationTime),
          title: "LEAD CREATED",
          details: `Initial Status: ${lead?.status || "NEW"}`,
          actor: "System",
        });
      }
    }

    // 3. Activities
    if (Array.isArray(timelineData.activities)) {
      timelineData.activities.forEach((act) => {
        let parsed: any = {};
        try {
          parsed = JSON.parse(act.description || "{}");
        } catch (e) {
          parsed = { summary: act.description };
        }

        const exactTime = act.createdAt || act.activityDate || parsed.visitDate;

        items.push({
          id: `activity-${act.id}`,
          type: "ACTIVITY",
          raw: act,
          parsed,
          timestamp: new Date(exactTime).getTime(),
          dateStr: format12HrDateTime(exactTime),
          actType: act.type === "TASK" ? "Site Visit" : parsed.customType || act.type,
          outcome: act.outcome || parsed.outcome || "Interested",
          summary: parsed.summary || "",
          nextFollowUpDate: act.nextFollowUpDate || parsed.followUpDate,
          nextFollowUpTime: act.nextFollowUpTime || parsed.nextFollowUpTime,
          nextFollowUpType: act.nextFollowUpType || parsed.nextFollowUpType,
          actor: act.user?.name || "Sales Rep",
        });
      });
    }

    // 4. Payments
    if (Array.isArray(timelineData.payments)) {
      timelineData.payments
        .filter((p) => p.status !== "VOIDED")
        .forEach((p) => {
          items.push({
            id: `payment-${p.id}`,
            type: "PAYMENT",
            timestamp: new Date(p.paymentDate).getTime(),
            dateStr: format12HrDateTime(p.paymentDate),
            amount: parseFloat(p.amount.toString()),
            method: p.paymentMethod,
            reference: p.referenceId,
            actor: p.createdBy || "System",
          });
        });
    }

    // Sort newest first with priority tie-breaker for same-time events
    return items.sort((a, b) => {
      const timeDiff = b.timestamp - a.timestamp;
      if (Math.abs(timeDiff) > 1000) {
        return timeDiff;
      }
      const typePriority: Record<string, number> = {
        STATUS_CHANGE: 4,
        ACTIVITY: 3,
        PAYMENT: 2,
        LEAD_CREATED: 1,
      };
      return (typePriority[b.type] || 0) - (typePriority[a.type] || 0);
    });
  }, [lead, timelineData]);

  if (!isOpen || !lead) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      {/* Extra Large Modal Container (max-w-6xl) */}
      <div className="bg-nexus-card border border-nexus-border rounded-xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-nexus-text">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-nexus-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-nexus-text flex items-center gap-2">
              <span className="p-1.5 bg-nexus-primary/10 rounded-lg text-nexus-primary">
                <IconClock size={20} />
              </span>
              <span>Activity - {leadName} {companyName ? `/ ${companyName}` : ""}</span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-nexus-muted hover:text-nexus-text transition-colors p-1 rounded-lg hover:bg-nexus-hover"
          >
            <IconX size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Log Activity Form */}
          <form onSubmit={handleSave} className="bg-nexus-bg/70 border border-nexus-border rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-nexus-border/50 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-nexus-primary">
                {activityId ? "Edit Activity" : "Log New Activity"}
              </h3>
              {/* CURRENT LEAD STATUS DISPLAY */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-nexus-muted font-medium">Current Status:</span>
                <span className={`px-2.5 py-0.5 rounded-lg border font-bold text-[11px] ${getStatusBadgeStyle(currentStatus)}`}>
                  {currentStatus}
                </span>
              </div>
            </div>

            {/* SINGLE ROW: Activity Inputs (Activity Type, Date, Outcome, Update Lead Status) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-nexus-text-secondary mb-1">
                  Activity Type *
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full bg-nexus-card border border-nexus-border rounded-lg px-3 py-2 text-sm text-nexus-text focus:outline-none focus:border-nexus-primary/50"
                >
                  <option value="Call">Call</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Email">Email</option>
                  <option value="Meeting">Meeting</option>
                  <option value="Demo">Demo</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-nexus-text-secondary mb-1">
                  Activity Date *
                </label>
                <input
                  type="date"
                  required
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  onClick={(e) => e.currentTarget.showPicker?.()}
                  className="w-full bg-nexus-card border border-nexus-border rounded-lg px-3 py-2 text-sm text-nexus-text focus:outline-none focus:border-nexus-primary/50 [color-scheme:dark] cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-nexus-text-secondary mb-1">
                  Outcome *
                </label>
                <select
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  className="w-full bg-nexus-card border border-nexus-border rounded-lg px-3 py-2 text-sm text-nexus-text focus:outline-none focus:border-nexus-primary/50"
                >
                  <option value="Interested">Interested</option>
                  <option value="Follow-up Required">Follow-up Required</option>
                  <option value="No Response">No Response</option>
                  <option value="Not Interested">Not Interested</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-nexus-text-secondary mb-1">
                  Update Lead Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full bg-nexus-card border border-nexus-border rounded-lg px-3 py-2 text-sm text-nexus-text focus:outline-none focus:border-nexus-primary/50 font-semibold"
                >
                  <option value="NO_CHANGE">No Change ({currentStatus})</option>
                  <option value="NEW">New</option>
                  <option value="CONTACTED">Contacted</option>
                  <option value="QUALIFIED">Qualified</option>
                  <option value="PROPOSAL">Proposal Sent</option>
                  <option value="NEGOTIATION">Negotiation</option>
                  <option value="WON">Won</option>
                  <option value="LOST">Lost</option>
                </select>
              </div>
            </div>

            {/* Lost Reason Input if status selected is LOST */}
            {newStatus === "LOST" && (
              <div>
                <label className="block text-xs font-medium text-red-400 mb-1">
                  Reason for Losing Lead
                </label>
                <select
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                  className="w-full bg-nexus-card border border-red-500/30 rounded-lg px-3 py-2 text-sm text-nexus-text focus:outline-none"
                >
                  <option value="">Select Lost Reason...</option>
                  <option value="Price">Price / Budget</option>
                  <option value="No Response">No Response</option>
                  <option value="Competitor">Went with Competitor</option>
                  <option value="Not Interested">Not Interested</option>
                  <option value="Timing">Bad Timing</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            )}

            {/* SINGLE ROW: Follow-up Inputs (Date, Time, Type) */}
            <div className="pt-2 border-t border-nexus-border/50 space-y-2">
              <h4 className="text-xs font-bold text-nexus-primary uppercase tracking-wider">
                Schedule Next Follow-up
              </h4>
              <div className="p-3 bg-nexus-card/80 border border-nexus-border rounded-xl">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-nexus-text-secondary mb-1">
                      Follow-up Date
                    </label>
                    <input
                      type="date"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      onClick={(e) => e.currentTarget.showPicker?.()}
                      className="w-full bg-nexus-bg border border-nexus-border rounded-lg px-3 py-2 text-sm text-nexus-text focus:outline-none focus:border-nexus-primary/50 [color-scheme:dark] cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-nexus-text-secondary mb-1">
                      Follow-up Time
                    </label>
                    <input
                      type="time"
                      value={nextFollowUpTime}
                      onChange={(e) => setNextFollowUpTime(e.target.value)}
                      className="w-full bg-nexus-bg border border-nexus-border rounded-lg px-3 py-2 text-sm text-nexus-text focus:outline-none focus:border-nexus-primary/50 [color-scheme:dark]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-nexus-text-secondary mb-1">
                      Follow-up Type
                    </label>
                    <select
                      value={nextFollowUpType}
                      onChange={(e) => setNextFollowUpType(e.target.value)}
                      className="w-full bg-nexus-bg border border-nexus-border rounded-lg px-3 py-2 text-sm text-nexus-text focus:outline-none focus:border-nexus-primary/50"
                    >
                      <option value="Call">Call</option>
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="Email">Email</option>
                      <option value="Meeting">Meeting</option>
                      <option value="Demo">Demo</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div>
              <label className="block text-xs font-medium text-nexus-text-secondary mb-1">
                Summary
              </label>
              <textarea
                rows={2}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Details of the conversation, customer feedback..."
                className="w-full bg-nexus-card border border-nexus-border rounded-lg p-3 text-sm text-nexus-text focus:outline-none focus:border-nexus-primary/50"
              />
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              {activityId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3 py-1.5 text-xs font-semibold text-nexus-muted hover:text-nexus-text border border-nexus-border rounded-lg hover:bg-nexus-hover"
                >
                  Cancel Edit
                </button>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-xs font-bold bg-nexus-primary text-nexus-bg rounded-lg hover:bg-nexus-primary/90 transition-colors shadow-md disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Save Activity"}
              </button>
            </div>
          </form>

          {/* Timeline & Progression Section Header with 2 Format Tabs */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-nexus-border/50 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-nexus-primary flex items-center gap-2">
                <span>Lead Progression & Activity Timeline</span>
                <span className="px-2 py-0.5 rounded-full bg-nexus-primary/10 text-nexus-primary text-[11px] font-semibold">
                  {unifiedTimeline.length} events
                </span>
              </h3>

              {/* FORMAT TOGGLE TABS */}
              <div className="flex items-center gap-1 bg-nexus-bg p-1 rounded-lg border border-nexus-border">
                <button
                  type="button"
                  onClick={() => setTimelineFormat("progress")}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                    timelineFormat === "progress"
                      ? "bg-nexus-primary text-nexus-bg font-bold shadow-md"
                      : "text-nexus-muted hover:text-nexus-text"
                  }`}
                >
                  <IconChartBar size={14} /> 1. Timeline Cards
                </button>
                <button
                  type="button"
                  onClick={() => setTimelineFormat("table")}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                    timelineFormat === "table"
                      ? "bg-nexus-primary text-nexus-bg font-bold shadow-md"
                      : "text-nexus-muted hover:text-nexus-text"
                  }`}
                >
                  <IconTable size={14} /> 2. Table Format
                </button>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8 text-xs text-nexus-muted">Loading timeline data...</div>
            ) : unifiedTimeline.length === 0 ? (
              <div className="text-center py-8 text-xs text-nexus-muted bg-nexus-bg/30 border border-nexus-border rounded-xl p-4">
                No timeline events logged yet.
              </div>
            ) : timelineFormat === "progress" ? (
              /* FORMAT 1: TIMELINE CARDS VIEW (COMPACT NEAT DESIGN) */
              <div className="space-y-3 animate-fadeIn">
                <div className="relative pl-5 space-y-2.5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-nexus-border">
                  {unifiedTimeline.map((item) => {
                    const activityStatus =
                      item.type === "LEAD_CREATED"
                        ? "NEW"
                        : item.parsed?.newStatus && item.parsed?.newStatus !== "NO_CHANGE"
                        ? item.parsed.newStatus
                        : currentStatus;

                    if (item.type === "LEAD_CREATED") {
                      return (
                        <div
                          key={item.id}
                          className="relative bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2 text-xs flex items-center justify-between shadow-sm"
                        >
                          <span className="absolute -left-5 top-3 w-2.5 h-2.5 rounded-full bg-emerald-450 border-2 border-nexus-card -translate-x-1/2" />
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-emerald-450 text-[11px]">✨ LEAD CREATED</span>
                            <span className="text-nexus-text-secondary text-[11px] font-medium">
                              Initial Status: <strong className="text-nexus-text">{lead?.status || "NEW"}</strong>
                            </span>
                          </div>
                          <span className="text-[11px] text-nexus-muted font-medium">{item.dateStr}</span>
                        </div>
                      );
                    }

                    if (item.type === "STATUS_CHANGE") {
                      return (
                        <div
                          key={item.id}
                          className="relative bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2 text-xs flex items-center justify-between shadow-sm"
                        >
                          <span className="absolute -left-5 top-3 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-nexus-card -translate-x-1/2" />
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="flex items-center gap-1 font-bold text-amber-400 text-[11px]">
                              <IconTrendingUp size={13} /> Stage Transition:
                            </span>
                            <span className={`px-2 py-0.5 rounded border text-[10px] ${getStatusBadgeStyle(item.fromStatus)}`}>
                              {item.fromStatus}
                            </span>
                            <span className="text-nexus-muted font-bold">→</span>
                            <span className={`px-2 py-0.5 rounded border text-[10px] ${getStatusBadgeStyle(item.toStatus)}`}>
                              {item.toStatus}
                            </span>
                            <span className="text-[11px] text-nexus-muted">
                              (By <strong>{item.changedBy}</strong>)
                            </span>
                          </div>
                          <span className="text-[11px] text-nexus-muted font-medium whitespace-nowrap">{item.dateStr}</span>
                        </div>
                      );
                    }

                    if (item.type === "PAYMENT") {
                      return (
                        <div
                          key={item.id}
                          className="relative bg-teal-500/5 border border-teal-500/20 rounded-lg px-3 py-2 text-xs flex items-center justify-between shadow-sm"
                        >
                          <span className="absolute -left-5 top-3 w-2.5 h-2.5 rounded-full bg-teal-400 border-2 border-nexus-card -translate-x-1/2" />
                          <div className="flex items-center gap-2">
                            <IconCreditCard size={14} className="text-teal-400" />
                            <span className="font-bold text-teal-400 text-[11px]">PAYMENT RECORDED</span>
                            <span className="font-bold text-nexus-text">₹{item.amount?.toLocaleString()}</span>
                            <span className="text-nexus-muted text-[11px]">via {item.method}</span>
                          </div>
                          <span className="text-[11px] text-nexus-muted font-medium">{item.dateStr}</span>
                        </div>
                      );
                    }

                    // Activity Item Card (Compact Neat Design)
                    const followUpStr = formatFollowUpDisplay(
                      item.nextFollowUpDate,
                      item.nextFollowUpTime,
                      item.nextFollowUpType
                    );

                    return (
                      <div
                        key={item.id}
                        className="relative bg-nexus-bg/70 border border-nexus-border hover:border-nexus-primary/40 rounded-lg px-3 py-2.5 text-xs space-y-1.5 transition-all shadow-sm"
                      >
                        <span className="absolute -left-5 top-3.5 w-2.5 h-2.5 rounded-full bg-sky-400 border-2 border-nexus-card -translate-x-1/2" />

                        {/* Top Line: Badge + Date + Status + Outcome + Actions */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20 font-bold text-[11px]">
                              {getActivityIcon(item.actType)} {item.actType}
                            </span>
                            <span className="text-[11px] font-semibold text-nexus-text">{item.dateStr}</span>
                            <span className={`px-2 py-0.5 rounded border font-bold text-[10px] ${getStatusBadgeStyle(activityStatus)}`}>
                              {activityStatus}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-nexus-card text-nexus-text border border-nexus-border font-medium text-[11px]">
                              Outcome: <strong className="text-nexus-primary">{item.outcome}</strong>
                            </span>
                            {currentUserId === item.raw.userId && (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleEdit(item.raw)}
                                  className="p-1 text-nexus-muted hover:text-nexus-primary transition-colors"
                                  title="Edit Activity"
                                >
                                  <IconEdit size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(item.raw.id)}
                                  className="p-1 text-nexus-muted hover:text-red-400 transition-colors"
                                  title="Delete Activity"
                                >
                                  <IconTrash size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Bottom Line: Summary & Next Follow-up */}
                        {(item.summary || followUpStr) && (
                          <div className="flex items-center justify-between gap-3 pt-1 border-t border-nexus-border/30 text-[11px]">
                            <p className="text-nexus-text-secondary truncate max-w-xl">
                              {item.summary || `${item.actType} logged`}
                            </p>
                            {followUpStr && (
                              <span className="text-cyan-400 font-medium flex items-center gap-1 whitespace-nowrap bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                                <IconCalendar size={12} /> Next: {followUpStr}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* FORMAT 2: DEDICATED ACTIVITY LOG TABLE FORMAT (ACTIVITIES ONLY) */
              <div className="bg-nexus-bg/80 border border-nexus-border rounded-xl overflow-hidden shadow-lg animate-fadeIn">
                {unifiedTimeline.filter((i) => i.type === "ACTIVITY" || i.type === "LEAD_CREATED").length === 0 ? (
                  <div className="text-center py-8 text-xs text-nexus-muted">
                    No logged interactions or activities found for this lead.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-nexus-card border-b border-nexus-border text-nexus-text-secondary text-[11px] font-semibold uppercase tracking-wider">
                          <th className="py-3 px-4">Date & Time (12-Hr)</th>
                          <th className="py-3 px-4">Activity Type</th>
                          <th className="py-3 px-4">Lead Status</th>
                          <th className="py-3 px-4">Summary & Notes</th>
                          <th className="py-3 px-4">Outcome</th>
                          <th className="py-3 px-4">Next Follow-up</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-nexus-border/50">
                        {unifiedTimeline
                          .filter((item) => item.type === "ACTIVITY" || item.type === "LEAD_CREATED")
                          .map((item) => {
                            const followUpStr = formatFollowUpDisplay(
                              item.nextFollowUpDate,
                              item.nextFollowUpTime,
                              item.nextFollowUpType
                            );

                            const activityStatus =
                              item.type === "LEAD_CREATED"
                                ? "NEW"
                                : item.parsed?.newStatus && item.parsed?.newStatus !== "NO_CHANGE"
                                ? item.parsed.newStatus
                                : currentStatus;

                            return (
                              <tr key={item.id} className="hover:bg-nexus-hover/50 transition-colors">
                                {/* 1. Date & Time (12-Hr format) */}
                                <td className="py-3 px-4 whitespace-nowrap font-semibold text-nexus-text">
                                  {item.dateStr}
                                </td>

                                {/* 2. Activity Type */}
                                <td className="py-3 px-4 whitespace-nowrap">
                                  {item.type === "LEAD_CREATED" ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold text-[11px]">
                                      ✨ Lead Created
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-bold text-[11px]">
                                      {getActivityIcon(item.actType)} {item.actType}
                                    </span>
                                  )}
                                </td>

                                {/* 3. Lead Status */}
                                <td className="py-3 px-4 whitespace-nowrap">
                                  <span className={`px-2 py-0.5 rounded border font-bold text-[10px] ${getStatusBadgeStyle(activityStatus)}`}>
                                    {activityStatus}
                                  </span>
                                </td>

                                {/* 4. Summary & Notes */}
                                <td className="py-3 px-4 text-nexus-text-secondary max-w-sm">
                                  {item.type === "LEAD_CREATED" ? item.details : item.summary || `${item.actType} logged`}
                                </td>

                                {/* 5. Outcome */}
                                <td className="py-3 px-4 whitespace-nowrap">
                                  {item.type === "LEAD_CREATED" ? (
                                    <span className="text-nexus-muted text-[11px]">-</span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded bg-nexus-card border border-nexus-border font-medium text-[11px] text-nexus-text">
                                      {item.outcome}
                                    </span>
                                  )}
                                </td>

                                {/* 6. Next Follow-up */}
                                <td className="py-3 px-4 whitespace-nowrap text-nexus-text">
                                  {followUpStr ? (
                                    <span className="text-cyan-400 font-medium flex items-center gap-1 text-[11px]">
                                      <IconCalendar size={12} /> {followUpStr}
                                    </span>
                                  ) : (
                                    <span className="text-nexus-muted text-[11px]">None</span>
                                  )}
                                </td>

                                {/* 7. Actions */}
                                <td className="py-3 px-4 whitespace-nowrap text-right">
                                  {item.type === "LEAD_CREATED" || currentUserId !== item.raw.userId ? (
                                    <span className="text-nexus-muted text-[11px]">-</span>
                                  ) : (
                                    <div className="flex items-center justify-end gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleEdit(item.raw)}
                                        className="p-1 text-nexus-muted hover:text-nexus-primary transition-colors"
                                        title="Edit Activity"
                                      >
                                        <IconEdit size={14} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDelete(item.raw.id)}
                                        className="p-1 text-nexus-muted hover:text-red-400 transition-colors"
                                        title="Delete Activity"
                                      >
                                        <IconTrash size={14} />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Activity Confirmation Modal */}
      {deletingActivityId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-nexus-card border border-nexus-border rounded-xl w-full max-w-md p-6 space-y-4 shadow-2xl text-nexus-text">
            <h3 className="text-base font-bold text-nexus-text">Delete Activity?</h3>
            <p className="text-sm text-nexus-muted">
              Are you sure you want to delete this activity? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDeletingActivityId(null)}
                className="px-4 py-2 text-sm font-semibold text-nexus-muted border border-nexus-border rounded-lg hover:bg-nexus-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm font-bold bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
