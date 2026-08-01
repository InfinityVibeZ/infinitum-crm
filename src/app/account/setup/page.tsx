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
  IconBuilding,
  IconUser,
  IconMail,
  IconShieldCheck,
  IconClock,
} from "@tabler/icons-react";
import { PASSWORD_REQUIREMENTS, getPasswordStrength } from "@/lib/passwordPolicy";

export default function AccountSetupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0A0D14] flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#111622] border border-nexus-border/60 rounded-2xl shadow-2xl p-6 sm:p-8 relative z-10 backdrop-blur-xl">
            <p className="text-center text-sm text-nexus-muted">Loading account setup...</p>
          </div>
        </div>
      }
    >
      <AccountSetupPageClient />
    </Suspense>
  );
}

function AccountSetupPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expiredContext, setExpiredContext] = useState<{
    role?: string;
    company?: string;
    expired?: boolean;
    code?: string;
  } | null>(null);
  const [accountContext, setAccountContext] = useState<{
    name: string;
    email: string;
    role: string;
    company: string;
  } | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Validate token on initial render
  useEffect(() => {
    if (!token) {
      setError("No setup token provided. Please click the activation link in your invitation email.");
      setLoading(false);
      return;
    }

    async function fetchTokenInfo() {
      try {
        const res = await fetch(`/api/auth/setup-account?token=${encodeURIComponent(token!)}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "This setup link has expired or is no longer valid.");
          if (data.expired) {
            setExpiredContext({
              role: data.role,
              company: data.company,
              expired: true,
              code: data.code,
            });
          }
        } else {
          setAccountContext(data.user);
        }
      } catch (err) {
        setError("Failed to verify setup token. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchTokenInfo();
  }, [token]);

  // Shared password policy — same rules/UI as Change Password and Reset Password
  const allReqsMet = PASSWORD_REQUIREMENTS.every((r) => r.test(password));
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const isFormValid = allReqsMet && passwordsMatch;
  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/setup-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to activate account");
      }
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  // Determine expired message based on role
  const companyName = expiredContext?.company && expiredContext.company !== "Infinitum"
    ? `${expiredContext.company} Team`
    : "Infinitum Team";

  return (
    <div className="min-h-screen bg-[#0A0D14] flex flex-col items-center justify-center p-4">
      {/* Decorative Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 via-transparent to-primary/5 pointer-events-none" />

      <div className="w-full max-w-md bg-[#111622] border border-nexus-border/60 rounded-2xl shadow-2xl p-6 sm:p-8 relative z-10 backdrop-blur-xl">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-nexus-primary/10 border border-nexus-primary/30 text-nexus-primary mb-3">
            <IconShieldCheck size={28} />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Infinitum Account Setup</h1>
          <p className="text-xs text-nexus-muted mt-1">Create your secure password to activate your account</p>
        </div>

        {loading ? (
          <div className="py-12 text-center space-y-3">
            <IconLoader2 size={32} className="animate-spin text-nexus-primary mx-auto" />
            <p className="text-xs text-nexus-muted font-medium">Verifying invitation token…</p>
          </div>
        ) : error && !accountContext && expiredContext?.code === "USED" ? (
          /* ── ALREADY ACTIVATED SCREEN ─────────────────────────── */
          <div className="space-y-5 text-center py-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <IconCircleCheck size={28} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Account Already Activated</h3>
              <p className="text-xs text-nexus-muted mt-1 leading-relaxed">
                This account has already been activated and this link has already been used.
              </p>
            </div>
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 text-left space-y-2">
              <p className="text-xs text-nexus-muted leading-relaxed">
                You can sign in with the email and password you already set up. If you've forgotten your password, use{" "}
                <strong className="text-white">Forgot password?</strong> on the sign-in page.
              </p>
            </div>
            <button
              onClick={() => router.push("/login")}
              className="w-full py-3 px-4 text-sm font-bold bg-nexus-primary text-black rounded-xl hover:bg-nexus-primary/90 transition-all shadow-lg shadow-nexus-primary/20"
            >
              Continue to Sign In
            </button>
          </div>
        ) : error && !accountContext ? (
          /* ── EXPIRED / INVALID TOKEN SCREEN ─────────────────────────── */
          <div className="space-y-5 text-center py-4">
            <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <IconClock size={28} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Activation Link Expired</h3>
              <p className="text-xs text-nexus-muted mt-1 leading-relaxed">
                This activation link is no longer valid.
              </p>
            </div>

            {/* Role-aware contact message */}
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 text-left space-y-2">
              {expiredContext?.expired ? (
                <>
                  <p className="text-xs font-semibold text-amber-300">What to do next:</p>
                  <p className="text-xs text-nexus-muted leading-relaxed">
                    Your activation link has expired. Please contact the{" "}
                    <strong className="text-white">{companyName}</strong> to request a new activation link.
                  </p>
                </>
              ) : (
                <p className="text-xs text-nexus-muted leading-relaxed">{error}</p>
              )}
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
              <h2 className="text-lg font-bold text-white">Account Activated!</h2>
              <p className="text-xs text-nexus-muted mt-2 leading-relaxed">
                Your account has been activated successfully. You can now log in with your email and new password.
              </p>
            </div>
            <button
              onClick={() => router.push("/login")}
              className="w-full py-3 px-4 text-sm font-bold bg-nexus-primary text-black rounded-xl hover:bg-nexus-primary/90 transition-all shadow-lg shadow-nexus-primary/20"
            >
              Proceed to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Context Badge */}
            {accountContext && (
              <div className="bg-nexus-hover/50 border border-nexus-border/80 rounded-xl p-3.5 space-y-1.5 text-xs">
                <div className="flex items-center gap-2 text-nexus-text">
                  <IconUser size={14} className="text-nexus-primary" />
                  <span className="font-bold">{accountContext.name}</span>
                  <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-nexus-primary/10 text-nexus-primary border border-nexus-primary/20 ml-auto">
                    {accountContext.role}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-nexus-muted">
                  <IconMail size={14} />
                  <span>{accountContext.email}</span>
                </div>
                <div className="flex items-center gap-2 text-nexus-muted">
                  <IconBuilding size={14} />
                  <span>{accountContext.company}</span>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 flex items-start gap-2">
                <IconAlertTriangle size={16} className="shrink-0 text-rose-400 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Password Input */}
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
                  placeholder="Enter secure password"
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

            {/* Confirm Password Input */}
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

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!isFormValid || submitting}
              className="w-full py-3 px-4 text-sm font-bold bg-nexus-primary text-black rounded-xl hover:bg-nexus-primary/90 transition-all shadow-lg shadow-nexus-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <IconLoader2 size={18} className="animate-spin" />
                  <span>Activating Account…</span>
                </>
              ) : (
                <span>Create Password & Activate Account</span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
