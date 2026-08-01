"use client";

import { useState, useMemo } from "react";
import {
  IconShieldCheck,
  IconKey,
  IconEye,
  IconEyeOff,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconLoader2,
} from "@tabler/icons-react";
import { PASSWORD_REQUIREMENTS, getPasswordStrength } from "@/lib/passwordPolicy";

// ─── Component ────────────────────────────────────────────────────────────────

export default function SettingsSecurityPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [currentPasswordError, setCurrentPasswordError] = useState("");
  const [touched, setTouched] = useState({ current: false, new: false, confirm: false });

  const strength = useMemo(() => getPasswordStrength(newPassword), [newPassword]);
  const allReqsMet = PASSWORD_REQUIREMENTS.every((r) => r.test(newPassword));
  const passwordsMatch = confirmPassword.length > 0 && confirmPassword === newPassword;
  const isCurrentPasswordEmpty = touched.current && !currentPassword;
  const isNewSameAsCurrent = newPassword.length > 0 && currentPassword.length > 0 && newPassword === currentPassword;

  const isFormValid =
    currentPassword.length > 0 &&
    allReqsMet &&
    passwordsMatch &&
    !isNewSameAsCurrent;

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setCurrentPasswordError("");
    setTouched({ current: true, new: true, confirm: true });

    if (!currentPassword) {
      setCurrentPasswordError("Current password is required.");
      return;
    }
    if (!newPassword || !confirmPassword) {
      setError("All fields are required.");
      return;
    }
    if (!allReqsMet) {
      setError("New password does not meet all requirements.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    if (isNewSameAsCurrent) {
      setError("New password must be different from your current password.");
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem("nexus-token");
      const res = await fetch("/api/users/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        const message = data.error || "Failed to update password";
        if (/current password/i.test(message)) {
          setCurrentPasswordError(message);
        } else {
          setError(message);
        }
        return;
      }

      setSuccess("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTouched({ current: false, new: false, confirm: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-nexus-text max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="p-2 bg-nexus-primary/10 rounded-xl text-nexus-primary">
            <IconKey size={24} />
          </span>
          Change Password
        </h1>
        <p className="text-sm text-nexus-muted mt-1">
          Update your account password. Use a strong, unique password to keep your account secure.
        </p>
      </div>

      <form
        onSubmit={handlePasswordChange}
        className="bg-nexus-card border border-nexus-border rounded-xl p-6 space-y-5 shadow-sm"
      >
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-xs font-semibold text-red-400 flex items-center gap-2 animate-in fade-in duration-200">
            <IconAlertCircle size={16} className="flex-shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3 text-xs font-semibold text-emerald-400 flex items-center gap-2 animate-in fade-in duration-200">
            <IconShieldCheck size={16} className="flex-shrink-0" />
            {success}
          </div>
        )}

        <div className="space-y-4">
          {/* Current Password */}
          <div>
            <label className="text-xs font-semibold text-nexus-muted mb-1.5 block">Current Password</label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  if (currentPasswordError) setCurrentPasswordError("");
                }}
                onBlur={() => setTouched((t) => ({ ...t, current: true }))}
                placeholder="Enter current password"
                className={`w-full pl-3 pr-10 py-2.5 text-sm bg-nexus-bg border rounded-lg text-nexus-text placeholder-nexus-muted focus:outline-none focus:border-nexus-primary ${
                  currentPasswordError || isCurrentPasswordEmpty ? "border-red-500/50" : "border-nexus-border"
                }`}
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-nexus-muted hover:text-nexus-text transition-colors"
              >
                {showCurrent ? <IconEyeOff size={16} /> : <IconEye size={16} />}
              </button>
            </div>
            {currentPasswordError && (
              <p className="text-[11px] text-red-400 mt-1">{currentPasswordError}</p>
            )}
            {!currentPasswordError && isCurrentPasswordEmpty && (
              <p className="text-[11px] text-red-400 mt-1">Current password is required.</p>
            )}
          </div>

          {/* New Password */}
          <div>
            <label className="text-xs font-semibold text-nexus-muted mb-1.5 block">New Password</label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, new: true }))}
                placeholder="Create a strong password"
                className={`w-full pl-3 pr-10 py-2.5 text-sm bg-nexus-bg border rounded-lg text-nexus-text placeholder-nexus-muted focus:outline-none focus:border-nexus-primary ${
                  isNewSameAsCurrent ? "border-red-500/50" : "border-nexus-border"
                }`}
                required
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-nexus-muted hover:text-nexus-text transition-colors"
              >
                {showNew ? <IconEyeOff size={16} /> : <IconEye size={16} />}
              </button>
            </div>

            {/* Strength bar */}
            {newPassword.length > 0 && (
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-nexus-border rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${strength.barColorClass}`}
                      style={{ width: `${(strength.score / PASSWORD_REQUIREMENTS.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-nexus-muted w-16 text-right">{strength.label}</span>
                </div>
                {/* Requirements list */}
                <div className="grid grid-cols-1 gap-0.5 pt-1">
                  {PASSWORD_REQUIREMENTS.map((req) => {
                    const passed = req.test(newPassword);
                    return (
                      <div key={req.key} className="flex items-center gap-1.5">
                        {passed ? (
                          <IconCheck size={11} className="text-emerald-400 flex-shrink-0" />
                        ) : (
                          <IconX size={11} className="text-nexus-muted flex-shrink-0" />
                        )}
                        <span className={`text-[11px] ${passed ? "text-emerald-400" : "text-nexus-muted"}`}>
                          {req.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {isNewSameAsCurrent && (
              <p className="text-[11px] text-red-400 mt-1">New password must be different from your current password.</p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="text-xs font-semibold text-nexus-muted mb-1.5 block">Confirm New Password</label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
                placeholder="Confirm new password"
                className={`w-full pl-3 pr-10 py-2.5 text-sm bg-nexus-bg border rounded-lg text-nexus-text placeholder-nexus-muted focus:outline-none focus:border-nexus-primary ${
                  confirmPassword && confirmPassword !== newPassword
                    ? "border-red-500/50"
                    : "border-nexus-border"
                }`}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-nexus-muted hover:text-nexus-text transition-colors"
              >
                {showConfirm ? <IconEyeOff size={16} /> : <IconEye size={16} />}
              </button>
            </div>
            {confirmPassword && confirmPassword !== newPassword && (
              <p className="text-[11px] text-red-400 mt-1">Passwords do not match</p>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isLoading || !isFormValid}
            className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold bg-nexus-primary text-black rounded-lg hover:bg-nexus-primary/90 transition-colors shadow-lg shadow-nexus-primary/20 disabled:opacity-50 disabled:cursor-not-allowed min-w-[140px] focus:outline-none"
          >
            {isLoading ? (
              <>
                <IconLoader2 size={16} className="animate-spin" />
                Updating…
              </>
            ) : (
              "Update Password"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
