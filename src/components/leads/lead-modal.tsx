"use client";

import { useState, useEffect, useMemo } from "react";
import { IconX } from "@tabler/icons-react";
import { useAuthStore } from "@/store/auth";
import { SearchableAssigneeSelect } from "./searchable-assignee-select";

export interface LeadRecord {
  id: string;
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  category?: string;
  location?: string;
  leadSource?: string;
  interestedProduct?: string;
  status: string;
  priority: string;
  revenueGenerated?: number;
  notes?: string;
  userId?: string;
}

interface LeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message?: string) => void;
  leadData?: any;
  readOnly?: boolean;
}

export function LeadModal({
  isOpen,
  onClose,
  onSuccess,
  leadData,
  readOnly,
}: LeadModalProps) {
  const { user: currentUser } = useAuthStore();
  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";
  const isReadOnly = readOnly || currentUser?.role === "USER";
  const userCompany = currentUser?.company || currentUser?.department || "";

  // Basic Information State
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");

  // Lead Details State
  const [leadSource, setLeadSource] = useState("");
  const [interestedProduct, setInterestedProduct] = useState("");
  const [userId, setUserId] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [status, setStatus] = useState("NEW");
  const [revenueGenerated, setRevenueGenerated] = useState("0");
  const [leadCreatedDate, setLeadCreatedDate] = useState("");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [notes, setNotes] = useState("");

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error("Failed to fetch users", err);
    }
  };

  // Filter users to only active users under the same company (unless SuperAdmin)
  const { teamUsers, adminUsers } = useMemo(() => {
    let filtered = users.filter((u) => (u.isActive !== false && u.status !== "INACTIVE" && !u.isDeleted) || u.id === userId);
    if (!isSuperAdmin && userCompany) {
      filtered = filtered.filter((u) => {
        const uComp = (u.company || u.department || "").toLowerCase().trim();
        const currentComp = userCompany.toLowerCase().trim();
        return (
          uComp === currentComp ||
          (u.companyId && currentUser?.companyId && u.companyId === currentUser.companyId)
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
  }, [users, isSuperAdmin, userCompany, currentUser?.companyId, currentUser?.id, userId]);

  useEffect(() => {
    if (leadData) {
      const fullName = `${leadData.firstName || ""} ${leadData.lastName || ""}`.trim();
      setName(fullName);
      setPhone(leadData.phone || "");
      setEmail(leadData.email && !leadData.email.endsWith("@nexus.internal") ? leadData.email : "");
      setCompany(leadData.company || "");
      setJobTitle(leadData.jobTitle || "");
      setCategory(leadData.category || "");
      setLocation(leadData.location || "");
      setLeadSource(leadData.leadSource || "");
      setInterestedProduct(leadData.interestedProduct || "");
      setUserId(leadData.userId || "");
      setPriority(leadData.priority || "MEDIUM");
      setStatus(leadData.status || "NEW");
      setRevenueGenerated(leadData.revenueGenerated?.toString() || "0");
      setLeadCreatedDate(
        leadData.createdAt
          ? new Date(leadData.createdAt).toISOString().split("T")[0]
          : ""
      );
      setExpectedCloseDate(
        leadData.expectedCloseDate
          ? new Date(leadData.expectedCloseDate).toISOString().split("T")[0]
          : ""
      );
      setNotes(leadData.notes || "");
    } else {
      setName("");
      setPhone("");
      setEmail("");
      setCompany("");
      setJobTitle("");
      setCategory("");
      setLocation("");
      setLeadSource("");
      setInterestedProduct("");
      setUserId("");
      setPriority("MEDIUM");
      setStatus("NEW");
      setRevenueGenerated("0");
      setLeadCreatedDate("");
      setExpectedCloseDate("");
      setNotes("");
    }
  }, [leadData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) {
      onClose();
      return;
    }
    setLoading(true);
    setError("");

    try {
      const payload = {
        firstName: name.trim(),
        lastName: "",
        phone,
        email,
        company,
        jobTitle,
        category,
        location,
        leadSource: leadSource || undefined,
        interestedProduct,
        userId: userId || undefined,
        priority,
        status,
        revenueGenerated: parseFloat(revenueGenerated) || 0,
        leadCreatedDate: leadCreatedDate ? new Date(leadCreatedDate).toISOString() : undefined,
        expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate).toISOString() : undefined,
        notes,
      };

      const url = leadData ? `/api/leads/${leadData.id}` : "/api/leads";
      const method = leadData ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save lead");
      }

      onSuccess(leadData ? "Lead updated successfully." : "Lead created successfully.");
      onClose();
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-nexus-card border border-nexus-border rounded-xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-nexus-text">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-nexus-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-nexus-text">
              {isReadOnly ? "View Lead Details" : leadData ? "Edit Lead" : "Add Lead"}
            </h2>
            <p className="text-xs text-nexus-muted mt-0.5">
              Fill in the lead information below to save it to your pipeline.
            </p>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-nexus-muted hover:text-nexus-text transition-colors p-1 rounded-lg hover:bg-nexus-hover"
          >
            <IconX size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* SECTION 1: Basic Information */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-nexus-primary pb-1 border-b border-nexus-border/50">
              Basic Information
            </h3>

            {/* Row 1: Full Name, Phone, Email */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-nexus-text-secondary mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  disabled={isReadOnly}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${
                    isReadOnly
                      ? "bg-nexus-hover border-nexus-border text-nexus-muted cursor-not-allowed"
                      : "bg-nexus-bg border-nexus-border text-nexus-text focus:outline-none focus:border-nexus-primary/50"
                  }`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-nexus-text-secondary mb-1">
                  Phone *
                </label>
                <input
                  type="text"
                  required
                  disabled={isReadOnly}
                  value={phone}
                  maxLength={15}
                  onChange={(e) => setPhone(e.target.value.replace(/[^0-9+\-\s()]/g, "").slice(0, 15))}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${
                    isReadOnly
                      ? "bg-nexus-hover border-nexus-border text-nexus-muted cursor-not-allowed"
                      : "bg-nexus-bg border-nexus-border text-nexus-text focus:outline-none focus:border-nexus-primary/50"
                  }`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-nexus-text-secondary mb-1">
                  Email
                </label>
                <input
                  type="email"
                  disabled={isReadOnly}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${
                    isReadOnly
                      ? "bg-nexus-hover border-nexus-border text-nexus-muted cursor-not-allowed"
                      : "bg-nexus-bg border-nexus-border text-nexus-text focus:outline-none focus:border-nexus-primary/50"
                  }`}
                />
              </div>
            </div>

            {/* Row 2: Company Name, Job Title, Category */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-nexus-text-secondary mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  disabled={isReadOnly}
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${
                    isReadOnly
                      ? "bg-nexus-hover border-nexus-border text-nexus-muted cursor-not-allowed"
                      : "bg-nexus-bg border-nexus-border text-nexus-text focus:outline-none focus:border-nexus-primary/50"
                  }`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-nexus-text-secondary mb-1">
                  Job Title / Role
                </label>
                <input
                  type="text"
                  disabled={isReadOnly}
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${
                    isReadOnly
                      ? "bg-nexus-hover border-nexus-border text-nexus-muted cursor-not-allowed"
                      : "bg-nexus-bg border-nexus-border text-nexus-text focus:outline-none focus:border-nexus-primary/50"
                  }`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-nexus-text-secondary mb-1">
                  Category
                </label>
                <input
                  type="text"
                  disabled={isReadOnly}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${
                    isReadOnly
                      ? "bg-nexus-hover border-nexus-border text-nexus-muted cursor-not-allowed"
                      : "bg-nexus-bg border-nexus-border text-nexus-text focus:outline-none focus:border-nexus-primary/50"
                  }`}
                />
              </div>
            </div>

            {/* Row 3: Location */}
            <div>
              <label className="block text-xs font-medium text-nexus-text-secondary mb-1">
                Location
              </label>
              <input
                type="text"
                disabled={isReadOnly}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm ${
                  isReadOnly
                    ? "bg-nexus-hover border-nexus-border text-nexus-muted cursor-not-allowed"
                    : "bg-nexus-bg border-nexus-border text-nexus-text focus:outline-none focus:border-nexus-primary/50"
                }`}
              />
            </div>
          </div>

          {/* SECTION 2: Lead Details */}
          <div className="space-y-3 pt-2 border-t border-nexus-border">
            <h3 className="text-xs font-bold uppercase tracking-wider text-nexus-primary pb-1 border-b border-nexus-border/50">
              Lead Details
            </h3>

            {/* Row 1: Lead Source, Interested Service / Product, Assign To */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-nexus-text-secondary mb-1">
                  Lead Source
                </label>
                <select
                  disabled={isReadOnly}
                  value={leadSource}
                  onChange={(e) => setLeadSource(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${
                    isReadOnly
                      ? "bg-nexus-hover border-nexus-border text-nexus-muted cursor-not-allowed"
                      : "bg-nexus-bg border-nexus-border text-nexus-text focus:outline-none focus:border-nexus-primary/50"
                  }`}
                >
                  <option value="">Select Source...</option>
                  <option value="WEBSITE">Website</option>
                  <option value="REFERRAL">Referral</option>
                  <option value="LINKEDIN">LinkedIn</option>
                  <option value="COLD_CALL">Cold Call</option>
                  <option value="COLD_EMAIL">Cold Email</option>
                  <option value="ADVERTISING">Advertising / Social Media</option>
                  <option value="EVENT">Event</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-nexus-text-secondary mb-1">
                  Interested Service / Product
                </label>
                <input
                  type="text"
                  disabled={isReadOnly}
                  value={interestedProduct}
                  onChange={(e) => setInterestedProduct(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${
                    isReadOnly
                      ? "bg-nexus-hover border-nexus-border text-nexus-muted cursor-not-allowed"
                      : "bg-nexus-bg border-nexus-border text-nexus-text focus:outline-none focus:border-nexus-primary/50"
                  }`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-nexus-text-secondary mb-1">
                  Assign To
                </label>
                {isReadOnly ? (
                  <div className="w-full border rounded-lg px-3 py-2 text-sm bg-nexus-hover border-nexus-border text-nexus-text">
                    {leadData?.user?.name ||
                      [...adminUsers, ...teamUsers].find((u) => u.id === userId)?.name || (
                        <span className="text-nexus-muted">Unassigned</span>
                      )}
                  </div>
                ) : (
                  <SearchableAssigneeSelect
                    value={userId}
                    onChange={setUserId}
                    admins={adminUsers}
                    users={teamUsers}
                  />
                )}
              </div>
            </div>

            {/* Row 2: Priority, Lead Status, Deal Value ₹ */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-nexus-text-secondary mb-1">
                  Priority
                </label>
                <select
                  disabled={isReadOnly}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${
                    isReadOnly
                      ? "bg-nexus-hover border-nexus-border text-nexus-muted cursor-not-allowed"
                      : "bg-nexus-bg border-nexus-border text-nexus-text focus:outline-none focus:border-nexus-primary/50"
                  }`}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-nexus-text-secondary mb-1">
                  Lead Status
                </label>
                <select
                  disabled={isReadOnly}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${
                    isReadOnly
                      ? "bg-nexus-hover border-nexus-border text-nexus-muted cursor-not-allowed"
                      : "bg-nexus-bg border-nexus-border text-nexus-text focus:outline-none focus:border-nexus-primary/50"
                  }`}
                >
                  <option value="NEW">New</option>
                  <option value="CONTACTED">Contacted</option>
                  <option value="QUALIFIED">Qualified</option>
                  <option value="PROPOSAL">Proposal</option>
                  <option value="NEGOTIATION">Negotiation</option>
                  <option value="WON">Won</option>
                  <option value="LOST">Lost</option>
                  <option value="HOLD">Hold</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-nexus-text-secondary mb-1">
                  Deal Value ₹
                </label>
                <input
                  type="number"
                  disabled={isReadOnly}
                  value={revenueGenerated}
                  onChange={(e) => setRevenueGenerated(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${
                    isReadOnly
                      ? "bg-nexus-hover border-nexus-border text-nexus-muted cursor-not-allowed"
                      : "bg-nexus-bg border-nexus-border text-nexus-text focus:outline-none focus:border-nexus-primary/50"
                  }`}
                />
              </div>
            </div>

            {/* Row 3: Lead Created Date, Expected Close Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-nexus-text-secondary mb-1">
                  Lead Created Date
                </label>
                <input
                  type="date"
                  disabled={isReadOnly}
                  value={leadCreatedDate}
                  onChange={(e) => setLeadCreatedDate(e.target.value)}
                  onClick={(e) => !isReadOnly && e.currentTarget.showPicker?.()}
                  className={`w-full border rounded-lg px-3 py-2 text-sm [color-scheme:dark] ${
                    isReadOnly
                      ? "bg-nexus-hover border-nexus-border text-nexus-muted cursor-not-allowed"
                      : "bg-nexus-bg border-nexus-border text-nexus-text focus:outline-none focus:border-nexus-primary/50 cursor-pointer"
                  }`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-nexus-text-secondary mb-1">
                  Expected Close Date
                </label>
                <input
                  type="date"
                  disabled={isReadOnly}
                  value={expectedCloseDate}
                  onChange={(e) => setExpectedCloseDate(e.target.value)}
                  onClick={(e) => !isReadOnly && e.currentTarget.showPicker?.()}
                  className={`w-full border rounded-lg px-3 py-2 text-sm [color-scheme:dark] ${
                    isReadOnly
                      ? "bg-nexus-hover border-nexus-border text-nexus-muted cursor-not-allowed"
                      : "bg-nexus-bg border-nexus-border text-nexus-text focus:outline-none focus:border-nexus-primary/50 cursor-pointer"
                  }`}
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-nexus-text-secondary mb-1">
                Notes
              </label>
              <textarea
                rows={3}
                disabled={isReadOnly}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Key observations, requirements, follow-up notes..."
                className={`w-full border rounded-lg p-3 text-sm ${
                  isReadOnly
                    ? "bg-nexus-hover border-nexus-border text-nexus-muted cursor-not-allowed"
                    : "bg-nexus-bg border-nexus-border text-nexus-text focus:outline-none focus:border-nexus-primary/50"
                }`}
              />
            </div>
          </div>

          {/* Submit Actions */}
          <div className="pt-4 border-t border-nexus-border flex items-center justify-end gap-3">
            {isReadOnly ? (
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 text-sm font-bold bg-nexus-primary text-black rounded-lg hover:bg-nexus-primary/90 transition-colors shadow-lg shadow-nexus-primary/20"
              >
                Close
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-semibold text-nexus-muted hover:text-nexus-text border border-nexus-border rounded-lg hover:bg-nexus-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 text-sm font-bold bg-nexus-primary text-black rounded-lg hover:bg-nexus-primary/90 transition-colors shadow-lg shadow-nexus-primary/20 disabled:opacity-50"
                >
                  {loading ? "Saving..." : leadData ? "Update Lead" : "Save Lead"}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
