"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { IconKey, IconX, IconCopy, IconCheck, IconLoader2, IconInfinity, IconEye, IconEyeOff } from "@tabler/icons-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";
  const { setAuth } = useAuthStore();

  const initialError = searchParams.get("msg") || (searchParams.get("deactivated") ? "You don't have access to this portal or application. Please contact the Infinity Vibez team." : "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(initialError);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedError = sessionStorage.getItem("nexus-login-error");
      if (storedError) {
        setError(storedError);
        sessionStorage.removeItem("nexus-login-error");
      }

      // Clean query string from browser URL bar to keep URL neat (http://localhost:3000/login)
      if (window.location.search) {
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, []);



  const isEmailError = /email does not exist/i.test(error);
  const isPasswordError = /password is invalid/i.test(error);

  // Forgot password state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotResult, setForgotResult] = useState("");
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      setAuth(data.user, data.token);
      router.replace(redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      setForgotError("Email is required");
      return;
    }
    setIsForgotLoading(true);
    setForgotError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send reset link");
      }
      // Generic message regardless of whether the email exists — prevents account enumeration.
      setForgotResult(data.message || "If an account exists for this email, we've sent password reset instructions.");
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : "Failed to send reset link");
    } finally {
      setIsForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-nexus-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#10D078] to-emerald-400 text-black mb-4 shadow-xl shadow-[#10D078]/20">
            <IconInfinity size={32} stroke={2.5} />
          </div>
          <h1 className="text-2xl font-extrabold text-nexus-text tracking-tight">
            Welcome to Infinity Vibez
          </h1>
          <p className="text-nexus-text-secondary text-xs mt-1">
            Sign in to your Infinity Vibez CRM portal
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-nexus-card border border-nexus-border rounded-xl p-6 space-y-5 animate-in fade-in slide-in-from-bottom-3 duration-300"
        >


          {error && !isEmailError && !isPasswordError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-xs sm:text-sm text-red-400 flex items-center justify-between gap-2 transition-all duration-300 animate-in fade-in slide-in-from-top-1">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError("")}
                className="text-red-400/70 hover:text-red-400 p-0.5 rounded transition-colors shrink-0"
                title="Dismiss"
              >
                <IconX size={16} />
              </button>
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-nexus-text-secondary mb-1.5"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (isEmailError) setError("");
              }}
              placeholder="you@company.com"
              required
              className={`w-full bg-nexus-bg border rounded-lg px-4 py-2.5 text-sm text-nexus-text placeholder:text-nexus-muted focus:outline-none focus:ring-1 ${isEmailError
                ? "border-red-500/60 focus:border-red-500/60 focus:ring-red-500/20"
                : "border-nexus-border focus:border-nexus-primary/50 focus:ring-nexus-primary/20"
                }`}
            />
            {isEmailError && <p className="text-[11px] text-red-400 mt-1">{error}</p>}
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-nexus-text-secondary mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (isPasswordError) setError("");
                }}
                placeholder="••••••••"
                required
                className={`w-full bg-nexus-bg border rounded-lg pl-4 pr-10 py-2.5 text-sm text-nexus-text placeholder:text-nexus-muted focus:outline-none focus:ring-1 ${isPasswordError
                  ? "border-red-500/60 focus:border-red-500/60 focus:ring-red-500/20"
                  : "border-nexus-border focus:border-nexus-primary/50 focus:ring-nexus-primary/20"
                  }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-nexus-muted hover:text-nexus-text transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <IconEyeOff size={17} /> : <IconEye size={17} />}
              </button>
            </div>
            {isPasswordError && <p className="text-[11px] text-red-400 mt-1">{error}</p>}
          </div>

          <div className="flex justify-end -mt-2">
            <button
              type="button"
              onClick={() => {
                setShowForgotModal(true);
                setForgotEmail("");
                setForgotError("");
                setForgotResult("");
              }}
              className="text-xs text-nexus-primary hover:underline font-medium focus:outline-none"
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-nexus-primary hover:bg-nexus-primary/90 text-nexus-bg font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-nexus-card border border-nexus-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-nexus-border">
              <div className="flex items-center gap-3">
                <span className="p-2 bg-nexus-primary/10 rounded-xl text-nexus-primary">
                  <IconKey size={20} />
                </span>
                <div>
                  <h2 className="text-base font-bold text-nexus-text">Reset Password</h2>
                  <p className="text-xs text-nexus-muted">Request a secure password reset link</p>
                </div>
              </div>
              <button
                onClick={() => setShowForgotModal(false)}
                className="p-2 text-nexus-muted hover:text-nexus-text hover:bg-nexus-hover rounded-lg transition-colors"
              >
                <IconX size={18} />
              </button>
            </div>

            {/* Content */}
            <form onSubmit={handleForgotSubmit}>
              <div className="p-6 space-y-4">
                {forgotError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-xs text-red-400 animate-shake">
                    {forgotError}
                  </div>
                )}

                {forgotResult ? (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3 text-xs text-emerald-400 font-semibold flex items-start gap-2">
                      <IconCheck size={16} className="flex-shrink-0 mt-0.5" />
                      <span>{forgotResult}</span>
                    </div>
                    <p className="text-xs text-nexus-text-secondary leading-relaxed">
                      A secure link to reset your password has been sent. The link expires in 24 hours and can only be used once.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs text-nexus-text-secondary leading-relaxed">
                      Enter the email address associated with your account, and we will send you a link to reset your password.
                    </p>
                    <div>
                      <label className="text-xs font-semibold text-nexus-text-secondary mb-1.5 block">Email Address</label>
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="you@company.com"
                        className="w-full px-3 py-2.5 text-sm bg-nexus-bg border border-nexus-border rounded-lg text-nexus-text placeholder-nexus-muted focus:outline-none focus:border-nexus-primary"
                        required
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-nexus-border">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-nexus-muted border border-nexus-border rounded-lg hover:bg-nexus-hover transition-colors"
                >
                  {forgotResult ? "Close" : "Cancel"}
                </button>
                {!forgotResult && (
                  <button
                    type="submit"
                    disabled={isForgotLoading}
                    className="px-5 py-2 text-sm font-bold bg-nexus-primary text-black rounded-lg hover:bg-nexus-primary/90 transition-all flex items-center gap-2 disabled:opacity-60"
                  >
                    {isForgotLoading && <IconLoader2 size={14} className="animate-spin" />}
                    Send Reset Link
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-nexus-bg flex items-center justify-center">
          <div className="text-nexus-text-secondary">Loading...</div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

