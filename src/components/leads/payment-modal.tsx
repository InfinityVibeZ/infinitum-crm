"use client";

import { useState, useEffect } from "react";
import { IconX, IconCreditCard, IconCheck, IconBan, IconPlus } from "@tabler/icons-react";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: any;
  onPaymentUpdated?: () => void;
  onShowMessage?: (message: string, type: "success" | "error") => void;
}

export function PaymentModal({ isOpen, onClose, lead, onPaymentUpdated, onShowMessage }: PaymentModalProps) {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Add Payment form state
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [referenceId, setReferenceId] = useState("");
  const [notes, setNotes] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    if (isOpen && lead?.id) {
      fetchPayments();
      resetForm();
    }
  }, [isOpen, lead]);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/payments`);
      if (res.ok) {
        const data = await res.json();
        setPayments(data);
      }
    } catch (err) {
      console.error("Failed to fetch payments", err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setAmount("");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentMethod("UPI");
    setReferenceId("");
    setNotes("");
    setError("");
    setShowAddForm(false);
  };

  if (!isOpen || !lead) return null;

  const dealValue = parseFloat(lead.revenueGenerated?.toString() || "0");
  const validPaymentsSum = payments
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);

  const totalPaid = validPaymentsSum;
  const balanceDue = Math.max(dealValue - totalPaid, 0);
  const paidPercentage = dealValue > 0 ? Math.min(Math.round((totalPaid / dealValue) * 100), 100) : 0;

  const derivedPaymentStatus =
    totalPaid === 0
      ? "Not Paid"
      : totalPaid >= dealValue && dealValue > 0
      ? "Paid"
      : "Partially Paid";

  const parsedAmount = parseFloat(amount);
  const isAmountExceeding = !isNaN(parsedAmount) && parsedAmount > balanceDue;

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Please enter a valid positive payment amount.");
      return;
    }

    if (numAmount > balanceDue) {
      setError(`Amount received (₹${numAmount.toLocaleString()}) cannot exceed the remaining balance amount of ₹${balanceDue.toLocaleString()}.`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        amount: numAmount,
        paymentDate,
        paymentMethod,
        referenceId: referenceId || undefined,
        notes: notes || undefined,
      };

      const res = await fetch(`/api/leads/${lead.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to record payment");
      }

      fetchPayments();
      resetForm();
      if (onShowMessage) onShowMessage("Payment saved successfully", "success");
      if (onPaymentUpdated) onPaymentUpdated();
    } catch (err: any) {
      setError(err.message || "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoidPayment = async (paymentId: string) => {
    if (!confirm("Are you sure you want to void this payment record? This action will adjust the balance.")) return;

    try {
      const res = await fetch(`/api/leads/${lead.id}/payments/${paymentId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchPayments();
        if (onPaymentUpdated) onPaymentUpdated();
      }
    } catch (err) {
      console.error("Failed to void payment", err);
    }
  };

  const leadName = `${lead.firstName || ""} ${lead.lastName || ""}`.trim();
  const companyName = lead.company || "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto">
      <div className="bg-nexus-card border border-nexus-border rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-nexus-text">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-nexus-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-nexus-text flex items-center gap-2">
              <span className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-450">
                <IconCreditCard size={20} />
              </span>
              <span>Payments - {leadName} {companyName ? `/ ${companyName}` : ""}</span>
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
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-nexus-bg border border-nexus-border rounded-xl p-4">
              <span className="text-[10px] font-semibold text-nexus-muted uppercase tracking-wider">
                Deal Value
              </span>
              <div className="text-xl font-bold text-nexus-text mt-1">
                ₹{dealValue.toLocaleString(undefined, { minimumFractionDigits: 0 })}
              </div>
            </div>

            <div className="bg-nexus-bg border border-nexus-border rounded-xl p-4">
              <span className="text-[10px] font-semibold text-emerald-450 uppercase tracking-wider">
                Total Paid
              </span>
              <div className="text-xl font-bold text-emerald-450 mt-1">
                ₹{totalPaid.toLocaleString(undefined, { minimumFractionDigits: 0 })}
              </div>
            </div>

            <div className="bg-nexus-bg border border-nexus-border rounded-xl p-4">
              <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
                Balance Due
              </span>
              <div className="text-xl font-bold text-amber-400 mt-1">
                ₹{balanceDue.toLocaleString(undefined, { minimumFractionDigits: 0 })}
              </div>
            </div>
          </div>

          {/* Add Payment Form (Displayed Directly) */}
          <form onSubmit={handleAddPayment} className="bg-nexus-bg/70 border border-nexus-border rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-nexus-border/50 pb-2">
              <h4 className="text-xs font-bold text-nexus-text uppercase tracking-wider">
                Record New Payment
              </h4>
            </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-2 rounded-lg">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-nexus-text-secondary mb-1">
                    Amount Received (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      if (error) setError("");
                    }}
                    className={`w-full bg-nexus-card border rounded-lg px-3 py-2 text-sm text-nexus-text focus:outline-none transition-colors ${
                      isAmountExceeding
                        ? "border-red-500 focus:border-red-500 bg-red-500/5 text-red-300"
                        : "border-nexus-border focus:border-nexus-primary/50"
                    }`}
                  />
                  {isAmountExceeding && (
                    <p className="mt-1.5 text-[11px] font-semibold text-red-400 flex items-center gap-1 animate-in fade-in duration-200">
                      <IconBan size={13} className="flex-shrink-0" />
                      Amount received (₹{parsedAmount.toLocaleString()}) cannot exceed the balance amount of ₹{balanceDue.toLocaleString()}.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-nexus-text-secondary mb-1">
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    onClick={(e) => e.currentTarget.showPicker?.()}
                    className="w-full bg-nexus-card border border-nexus-border rounded-lg px-3 py-2 text-sm text-nexus-text focus:outline-none focus:border-nexus-primary/50 [color-scheme:dark] cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-nexus-text-secondary mb-1">
                    Payment Method *
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full bg-nexus-card border border-nexus-border rounded-lg px-3 py-2 text-sm text-nexus-text focus:outline-none focus:border-nexus-primary/50"
                  >
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-nexus-text-secondary mb-1">
                    Transaction / Reference ID
                  </label>
                  <input
                    type="text"
                    value={referenceId}
                    onChange={(e) => setReferenceId(e.target.value)}
                    className="w-full bg-nexus-card border border-nexus-border rounded-lg px-3 py-2 text-sm text-nexus-text focus:outline-none focus:border-nexus-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-nexus-text-secondary mb-1">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-nexus-card border border-nexus-border rounded-lg px-3 py-2 text-sm text-nexus-text focus:outline-none focus:border-nexus-primary/50"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting || isAmountExceeding}
                  className="px-4 py-1.5 text-xs font-bold bg-nexus-primary text-nexus-bg rounded-lg hover:bg-nexus-primary/90 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Saving..." : "Save Payment"}
                </button>
              </div>
            </form>

          {/* Payment History Table */}
          <div className="overflow-x-auto">
            {payments.filter((p) => p.status !== "VOIDED").length === 0 ? (
              <div className="text-center py-8 text-nexus-muted text-xs bg-nexus-bg/30 border border-nexus-border rounded-xl">
                No payments recorded yet.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-nexus-border text-[11px] font-semibold uppercase tracking-wider text-nexus-muted">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Method</th>
                    <th className="py-2.5 px-3">Reference</th>
                    <th className="py-2.5 px-3">Notes</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-nexus-border/50 text-xs">
                  {payments
                    .filter((p) => p.status !== "VOIDED")
                    .map((p) => {
                      const formattedDate = new Date(p.paymentDate).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      });

                      return (
                        <tr key={p.id} className="hover:bg-nexus-hover/50">
                          <td className="py-2.5 px-3 font-medium">{formattedDate}</td>
                          <td className="py-2.5 px-3 font-bold text-emerald-450">
                            ₹{parseFloat(p.amount).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                          </td>
                          <td className="py-2.5 px-3">{p.paymentMethod}</td>
                          <td className="py-2.5 px-3 text-nexus-muted">{p.referenceId || "—"}</td>
                          <td className="py-2.5 px-3 text-nexus-muted">{p.notes || "—"}</td>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              <IconCheck size={10} /> Paid
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
