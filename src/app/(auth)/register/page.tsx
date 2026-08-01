"use client";

import { useState } from "react";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { IconCrown, IconCheck, IconAlertCircle, IconLoader2 } from "@tabler/icons-react";

function CreateSuperAdminForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const token = () =>
    typeof window !== "undefined" ? localStorage.getItem("nexus-token") || "" : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          role: "SUPER_ADMIN",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create Super Admin");
      }

      setSuccess(`Super Admin account created. An activation link has been sent to ${email.trim()}.`);
      setName("");
      setEmail("");
      setPhone("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create Super Admin");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-nexus-bg flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 mb-4">
            <IconCrown size={28} />
          </div>
          <h1 className="text-2xl font-extrabold text-nexus-text tracking-tight">Create Super Admin</h1>
          <p className="text-nexus-text-secondary mt-1 text-xs">
            Grants full system control. The new Super Admin sets their own password via a secure emailed link.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-nexus-card border border-nexus-border rounded-2xl p-6 space-y-5 shadow-xl"
        >
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-xs font-semibold text-red-400 flex items-center gap-2">
              <IconAlertCircle size={16} className="flex-shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3 text-xs font-semibold text-emerald-400 flex items-center gap-2">
              <IconCheck size={16} className="flex-shrink-0" />
              {success}
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-nexus-text-secondary mb-1.5">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              required
              className="w-full bg-nexus-bg border border-nexus-border rounded-lg px-4 py-2.5 text-sm text-nexus-text placeholder:text-nexus-muted focus:outline-none focus:border-nexus-primary/50 focus:ring-1 focus:ring-nexus-primary/20"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-nexus-text-secondary mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              className="w-full bg-nexus-bg border border-nexus-border rounded-lg px-4 py-2.5 text-sm text-nexus-text placeholder:text-nexus-muted focus:outline-none focus:border-nexus-primary/50 focus:ring-1 focus:ring-nexus-primary/20"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-nexus-text-secondary mb-1.5">
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 000 0000"
              className="w-full bg-nexus-bg border border-nexus-border rounded-lg px-4 py-2.5 text-sm text-nexus-text placeholder:text-nexus-muted focus:outline-none focus:border-nexus-primary/50 focus:ring-1 focus:ring-nexus-primary/20"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-nexus-primary hover:bg-nexus-primary/90 text-nexus-bg font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-nexus-primary/20 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <IconLoader2 size={16} className="animate-spin" />
                Creating…
              </>
            ) : (
              "Create Super Admin"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <PermissionGuard roles={["SUPER_ADMIN"]}>
      <CreateSuperAdminForm />
    </PermissionGuard>
  );
}
