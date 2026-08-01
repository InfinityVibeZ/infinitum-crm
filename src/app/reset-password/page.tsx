"use client";

import React, { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  IconLock,
  IconEye,
  IconEyeOff,
  IconCheck,
  IconX,
  IconLoader2,
  IconAlertTriangle,
  IconCircleCheck,
  IconKey,
  IconClock,
} from "@tabler/icons-react";
import { PASSWORD_REQUIREMENTS, getPasswordStrength } from "@/lib/passwordPolicy";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0A0D14] flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#111622] border border-nexus-border/60 rounded-2xl shadow-2xl p-6 sm:p-8 relative z-10 backdrop-blur-xl">
            <p className="text-center text-sm text-nexus-muted">Loading reset password...</p>
          </div>
        </div>
      }
    >
      <ResetPasswordPageClient />
    </Suspense>
  );
}

function ResetPasswordPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [linkError, setLinkError] = useState<{ message: string; code: string } | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Pre-validate the token before showing the form — same pattern as Account Setup,
  // so "expired" / "already used" is caught upfront instead of only on submit.
  useEffect(() => {
    if (!token) {
      setLinkError({ message: "This password reset link is invalid or incomplete.", code: "INVALID" });
      setLoading(false);
      return;
    }

    async function checkToken() {
      try {
        const res = await fetch(`/api/auth/reset-password?token=${encodeURIComponent(token!)}`);
        const data = await res.json();
        if (!res.ok) {
          setLinkError({
            message: data.error || "This password reset link has expired or is no longer valid.",
            code: data.code || "INVALID",
          });
        }
      } catch {
        setLinkError({ message: "Failed to verify reset link. Please try again.", code: "INVALID" });
      } finally {
        setLoading(false);
      }
    }

    checkToken();
  }, [token]);

  // Shared password policy — same rules/UI as Account Setup and Change Password
  const allReqsMet = PASSWORD_REQUIREMENTS.every((r) => r.test(password));
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const isFormValid = allReqsMet && passwordsMatch;
  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError("Reset token is missing from the link.");
      return;
    }
    if (!isFormValid || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "This password reset link has expired or is no longer valid.");
      }
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0D14] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#111622] border border-nexus-border/60 rounded-2xl shadow-2xl p-6 sm:p-8 relative z-10 backdrop-blur-xl">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-3">
            <IconKey size={28} />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Reset Your Password</h1>
          <p className="text-xs text-nexus-muted mt-1">Enter your new secure password below</p>
        </div>

        {loading ? (
          <div className="py-12 text-center space-y-3">
            <IconLoader2 size={32} className="animate-spin text-nexus-primary mx-auto" />
            <p className="text-xs text-nexus-muted font-medium">Verifying reset link…</p>
          </div>
        ) : linkError?.code === "USED" ? (
          /* ── LINK ALREADY USED SCREEN — same pattern as Account Setup ── */
          <div className="space-y-5 text-center py-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <IconCircleCheck size={28} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Link Already Used</h3>
              <p className="text-xs text-nexus-muted mt-1 leading-relaxed">
                This password reset link has already been used and is no longer valid.
              </p>
            </div>
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 text-left">
              <p className="text-xs text-nexus-muted leading-relaxed">
                Your password was already updated with this link. Sign in with your current password, or request a new reset link if you've forgotten it.
              </p>
            </div>
            <button
              onClick={() => router.push("/login")}
              className="w-full py-3 px-4 text-sm font-bold bg-nexus-primary text-black rounded-xl hover:bg-nexus-primary/90 transition-all shadow-lg shadow-nexus-primary/20"
            >
              Continue to Sign In
            </button>
          </div>
        ) : linkError ? (
          /* ── EXPIRED / INVALID LINK SCREEN — same pattern as Account Setup ── */
          <div className="space-y-5 text-center py-4">
            <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <IconClock size={28} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Reset Link Expired</h3>
              <p className="text-xs text-nexus-muted mt-1 leading-relaxed">
                This password reset link is no longer valid.
              </p>
            </div>
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 text-left space-y-2">
              <p className="text-xs font-semibold text-amber-300">What to do next:</p>
              <p className="text-xs text-nexus-muted leading-relaxed">
                Please go back to Sign In and use <strong className="text-white">Forgot password?</strong> to request a new secure reset link.
              </p>
            </div>
            <button
              onClick={() => router.push("/login")}
              className="w-full py-2.5 px-4 text-xs font-bold text-nexus-muted hover:text-white border border-nexus-border rounded-xl hover:bg-nexus-hover transition-colors"
            >
              Go to Sign In
            </button>
          </div>
        ) : success ? (
          <div className="space-y-6 text-center py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <IconCircleCheck size={36} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Password Reset Successfully</h2>
              <p className="text-xs text-nexus-muted mt-2">
                Your password has been updated. You can now sign in with your email and new password.
              </p>
            </div>
            <button
              onClick={() => router.push("/login")}
              className="w-full py-3 px-4 text-sm font-bold bg-nexus-primary text-black rounded-xl hover:bg-nexus-primary/90 transition-all shadow-lg shadow-nexus-primary/20"
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 flex items-start gap-2">
                <IconAlertTriangle size={16} className="shrink-0 text-rose-400 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-nexus-text-secondary block">New Password *</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-nexus-muted">
                  <IconLock size={16} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full pl-9 pr-10 py-2.5 text-sm bg-nexus-bg border border-nexus-border rounded-xl text-nexus-text focus:outline-none focus:border-nexus-primary font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-nexus-muted hover:text-nexus-text"
                >
                  {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>

              {/* Strength bar + live requirements — only appears once typing starts */}
              {password.length > 0 && (
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
                  <div className="grid grid-cols-1 gap-0.5 pt-0.5">
                    {PASSWORD_REQUIREMENTS.map((req) => {
                      const passed = req.test(password);
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
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-nexus-text-secondary block">Confirm Password *</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-nexus-muted">
                  <IconLock size={16} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className={`w-full pl-9 pr-3 py-2.5 text-sm bg-nexus-bg border rounded-xl text-nexus-text focus:outline-none focus:border-nexus-primary font-mono ${
                    confirmPassword && confirmPassword !== password ? "border-red-500/50" : "border-nexus-border"
                  }`}
                  required
                />
              </div>
              {confirmPassword && confirmPassword !== password && (
                <p className="text-[11px] text-red-400 mt-1">Passwords do not match</p>
              )}
            </div>

            <button
              type="submit"
              disabled={!isFormValid || submitting}
              className="w-full py-3 px-4 text-sm font-bold bg-amber-500 text-black rounded-xl hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <IconLoader2 size={18} className="animate-spin" />
                  <span>Updating Password…</span>
                </>
              ) : (
                <span>Reset Password</span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
