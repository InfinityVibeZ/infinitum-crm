"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { IconBuildingSkyscraper, IconLoader2, IconAlertCircle, IconCheck, IconEye, IconEyeOff } from "@tabler/icons-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/apiClient";
import { getPriceDisplayInfo } from "@/lib/pricing";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = searchParams.get("planId") || "";
  const planPriceId = searchParams.get("planPriceId") || "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlanCode, setSelectedPlanCode] = useState("");


  const [isLoading, setIsLoading] = useState(false);
  const [fetchingPlans, setFetchingPlans] = useState(true);
  const hasFetched = React.useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    async function fetchPlans() {
      try {
        const res = await fetch("/api/public/plans");
        if (res.ok) {
          const data = await res.json();
          setPlans(data);

          if (planId) {
            const matchedPlan = data.find((p: any) => p.id === planId);
            if (matchedPlan) {
              setSelectedPlanCode(matchedPlan.code);
            }
          } else if (data.length > 0) {
            // Default to first plan or the default plan
            const defaultPlan = data.find((p: any) => p.isDefault) || data[0];
            setSelectedPlanCode(defaultPlan.code);
          }
        }
      } catch (err) {
        console.error("Failed to fetch public plans:", err);
      } finally {
        setFetchingPlans(false);
      }
    }
    fetchPlans();
  }, [planId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !password || !companyName.trim()) {
      toast.error("All fields are required.");
      return;
    }

    setIsLoading(true);
    try {
      const data = await apiClient.post("/api/auth/signup", {
        name: name.trim(),
        email: email.trim(),
        password,
        companyName: companyName.trim(),
        planCode: selectedPlanCode || undefined,
        planPriceId: planPriceId || undefined,
      });

      // Automatically authenticate the user with the returned JWT token
      if (data.token) {
        localStorage.setItem("nexus-token", data.token);
        localStorage.setItem("nexus-user", JSON.stringify(data.user));

        // Wait a small bit before redirecting so local storage sets
        setTimeout(() => {
          router.push("/login");
        }, 300);
      } else {
        router.push("/login");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create account");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-nexus-bg flex flex-col items-center justify-center px-4 py-8">
      <Link href="/" className="flex items-center gap-2 mb-8 hover:opacity-80 transition-opacity">
        <div className="w-10 h-10 rounded-xl bg-nexus-primary/10 border border-nexus-primary/20 text-nexus-primary flex items-center justify-center">
          <IconBuildingSkyscraper size={24} />
        </div>
        <span className="text-2xl font-extrabold tracking-tight text-white">Infinity Vibez</span>
      </Link>

      <div className="w-full max-w-md bg-[#0B0F19] border border-[#151B2C] rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Create your account</h1>
          <p className="text-nexus-text-secondary text-sm">Start managing your CRM today.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">


          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-nexus-text-secondary mb-1.5">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-[#151B2C] border border-[#1E2638] rounded-lg px-4 py-3 text-sm text-white placeholder:text-nexus-muted focus:outline-none focus:border-nexus-primary/50 focus:ring-1 focus:ring-nexus-primary/20"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-nexus-text-secondary mb-1.5">Work Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[#151B2C] border border-[#1E2638] rounded-lg px-4 py-3 text-sm text-white placeholder:text-nexus-muted focus:outline-none focus:border-nexus-primary/50 focus:ring-1 focus:ring-nexus-primary/20"
                placeholder="john@company.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-nexus-text-secondary mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full bg-[#151B2C] border border-[#1E2638] rounded-lg px-4 py-3 text-sm text-white placeholder:text-nexus-muted focus:outline-none focus:border-nexus-primary/50 focus:ring-1 focus:ring-nexus-primary/20"
                placeholder="••••••••"
              />
            </div>

            <div className="pt-2">
              <label className="block text-sm font-medium text-nexus-text-secondary mb-1.5">Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                className="w-full bg-[#151B2C] border border-[#1E2638] rounded-lg px-4 py-3 text-sm text-white placeholder:text-nexus-muted focus:outline-none focus:border-nexus-primary/50 focus:ring-1 focus:ring-nexus-primary/20"
                placeholder="Acme Inc."
              />
            </div>

            {!fetchingPlans && plans.length > 0 && (
              <div className="pt-2">
                <label className="block text-sm font-medium text-nexus-text-secondary mb-1.5">Selected Plan</label>
                <select
                  value={selectedPlanCode}
                  onChange={(e) => setSelectedPlanCode(e.target.value)}
                  className="w-full bg-[#151B2C] border border-[#1E2638] rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-nexus-primary/50 focus:ring-1 focus:ring-nexus-primary/20"
                >
                  {plans.map((p) => {
                    const matchedPrice = planPriceId && p.id === planId
                      ? p.prices?.find((pr: any) => pr.id === planPriceId)
                      : (p.prices?.find((pr: any) => pr.isDefault) || p.prices?.[0]);

                    const priceInfo = matchedPrice ? getPriceDisplayInfo(matchedPrice) : null;
                    const priceText = priceInfo ? `${priceInfo.formattedAmount} / ${priceInfo.intervalLabel}` : "Free";

                    return (
                      <option key={p.id} value={p.code}>
                        {p.name} - {priceText}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || fetchingPlans}
            className="w-full mt-6 bg-nexus-primary hover:bg-nexus-primary/90 text-white font-semibold py-3 rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-nexus-primary/20"
          >
            {isLoading ? (
              <>
                <IconLoader2 size={18} className="animate-spin" /> Creating account...
              </>
            ) : (
              "Sign Up"
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-nexus-text-secondary">
          Already have an account?{" "}
          <Link href="/login" className="text-nexus-primary hover:underline font-semibold">
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-nexus-bg flex items-center justify-center"><IconLoader2 size={32} className="text-nexus-primary animate-spin" /></div>}>
      <SignupForm />
    </Suspense>
  );
}
