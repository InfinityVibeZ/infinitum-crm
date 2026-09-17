"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import toast from "react-hot-toast";
import {
  IconCreditCard,
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconLoader2,
  IconRefresh,
  IconTag,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { resetEntitlementsCache } from "@/components/auth/FeatureGate";
import { getPriceDisplayInfo, intervalToggleLabel } from "@/lib/pricing";

interface PlanFeature {
  id: string;
  enabled: boolean;
  limitValue: number | null;
  feature: {
    code: string;
    name: string;
  };
}

interface Plan {
  id: string;
  code: string;
  name: string;
  description: string;
  currency: string;
  features: PlanFeature[];
  prices: {
    id: string;
    billingInterval: string;
    intervalCount: number;
    currency: string;
    amount: string;
    originalAmount: string | null;
    discountAmount: string | null;
    discountPercent: string | null;
    isActive: boolean;
    isDefault: boolean;
  }[];
}

interface Subscription {
  id: string;
  status: string;
  planId: string;
  planPriceId: string | null;
  billingInterval: string | null;
  cancelAtPeriodEnd: boolean;
  trial_starts_at?: string | null;
  trialEndsAt?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  plan: Plan;
  planPrice: any;
}

export default function SettingsSubscriptionPage() {
  const { user } = useAuthStore();
  
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mutation states
  const [isMutating, setIsMutating] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [targetPlanToChange, setTargetPlanToChange] = useState<Plan | null>(null);
  const [targetPriceToChange, setTargetPriceToChange] = useState<any | null>(null);

  // Billing Cycle state
  const [billingInterval, setBillingInterval] = useState<string>("MONTH");
  const [availableIntervals, setAvailableIntervals] = useState<string[]>(["MONTH", "QUARTER", "HALF_YEAR", "YEAR"]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [subRes, plansRes] = await Promise.all([
        fetch("/api/organization/subscription"),
        fetch("/api/organization/subscription/plans"),
      ]);

      if (!subRes.ok) throw new Error("Failed to load subscription");
      if (!plansRes.ok) throw new Error("Failed to load plans");

      const subData = await subRes.json();
      const plansData = await plansRes.json();

      setSubscription(subData);
      setPlans(plansData);

      // Extract available intervals across all plans
      const intervals = new Set<string>();
      plansData.forEach((p: any) => {
        p.prices?.forEach((price: any) => intervals.add(price.billingInterval));
      });
      const order = ["MONTH", "QUARTER", "HALF_YEAR", "YEAR"];
      const sorted = order.filter(i => intervals.has(i));
      if (sorted.length > 0) {
        setAvailableIntervals(sorted);
        // Default to the current subscription's interval if it exists
        if (subData?.planPrice?.billingInterval && sorted.includes(subData.planPrice.billingInterval)) {
          setBillingInterval(subData.planPrice.billingInterval);
        } else if (!sorted.includes(billingInterval)) {
          setBillingInterval(sorted[0]);
        }
      }

    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Only load data if the user is an ADMIN
    if (user?.role === "ADMIN") {
      fetchData();
    }
  }, [user]);

  const handleChangePlan = async () => {
    if (!targetPlanToChange || !targetPriceToChange) return;
    setIsMutating(true);
    try {
      const res = await fetch("/api/organization/subscription/change", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: targetPlanToChange.id, planPriceId: targetPriceToChange.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to change plan");

      toast.success(`Successfully changed plan to ${targetPlanToChange.name}`);
      setTargetPlanToChange(null);
      setTargetPriceToChange(null);
      resetEntitlementsCache();
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsMutating(false);
    }
  };

  const handleCancelSubscription = async () => {
    setIsMutating(true);
    try {
      const res = await fetch("/api/organization/subscription/cancel", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel subscription");

      toast.success("Subscription set to cancel at the end of the period.");
      setShowCancelDialog(false);
      resetEntitlementsCache();
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsMutating(false);
    }
  };

  const handleReactivateSubscription = async () => {
    setIsMutating(true);
    try {
      const res = await fetch("/api/organization/subscription/reactivate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reactivate subscription");

      toast.success("Subscription reactivated successfully.");
      resetEntitlementsCache();
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsMutating(false);
    }
  };

  const handleDevSimulateCheckout = async (planId: string, planPriceId: string) => {
    setIsMutating(true);
    try {
      const res = await fetch("/api/organization/subscription/dev/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, planPriceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Dev billing bypass failed (are you in prod?)");

      toast.success("Dev Billing: Subscription activated!");
      resetEntitlementsCache();
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsMutating(false);
    }
  };

  // Only render for ADMIN
  if (user?.role !== "ADMIN") {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <IconAlertTriangle className="h-16 w-16 text-nexus-primary mb-4 opacity-50" />
        <h2 className="text-xl font-bold text-nexus-text">Access Denied</h2>
        <p className="text-nexus-text-secondary mt-2">Only organization administrators can manage the subscription.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <IconLoader2 className="h-8 w-8 animate-spin text-nexus-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 bg-red-500/10 p-4 rounded-md flex items-center gap-2">
        <IconAlertTriangle className="h-5 w-5" />
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-nexus-text">Subscription & Billing</h1>
          <p className="text-nexus-text-secondary text-sm">Manage your organization's plan and features.</p>
        </div>
      </div>

      {/* Current Subscription Status */}
      {subscription && (
        <Card className="bg-nexus-bg/50 border-nexus-primary/20 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
            <IconCreditCard className="w-32 h-32 text-nexus-primary" />
          </div>
          <CardHeader>
            <CardTitle>Current Subscription</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
              {/* Subscription Status Block */}
              <div className="flex flex-col md:flex-row md:items-start gap-8 flex-wrap">
                <div className="min-w-[200px]">
                  <p className="text-sm text-nexus-text-secondary">Plan</p>
                  <p className="text-3xl font-bold text-nexus-primary mt-1">{subscription.plan.name}</p>
                  {subscription.planPrice && (
                    <p className="text-sm text-nexus-text mt-1 font-semibold">
                      {(() => {
                        const info = getPriceDisplayInfo(subscription.planPrice);
                        return `${info.formattedAmount} / ${info.intervalLabel}`;
                      })()}
                    </p>
                  )}
                </div>

                <div className="min-w-[120px]">
                  <p className="text-sm text-nexus-text-secondary">Status</p>
                  <p className="text-lg font-medium text-nexus-text mt-1 capitalize">
                    {subscription.status.toLowerCase()}
                  </p>
                </div>

                {subscription.planPrice?.trailingDays !== undefined && subscription.planPrice?.trailingDays > 0 && (
                  <div className="min-w-[160px]">
                    <p className="text-sm text-nexus-text-secondary">{subscription.planPrice.trailingDays}-day trial</p>
                    <p className="text-sm text-nexus-text mt-1 font-medium">
                      {subscription.trial_starts_at ? new Date(subscription.trial_starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'} – {subscription.trialEndsAt ? new Date(subscription.trialEndsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </p>
                  </div>
                )}

                <div className="min-w-[200px]">
                  <p className="text-sm text-nexus-text-secondary">Current billing period</p>
                  <p className="text-sm text-nexus-text mt-1 font-medium">
                    {subscription.currentPeriodStart ? new Date(subscription.currentPeriodStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'} – {subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </p>
                </div>

                <div className="min-w-[120px]">
                  <p className="text-sm text-nexus-text-secondary">Next renewal</p>
                  <p className="text-sm text-nexus-text mt-1 font-medium">
                    {subscription.status === 'CANCELED' 
                      ? <span className="text-rose-400">Canceled</span>
                      : subscription.cancelAtPeriodEnd 
                        ? <span className="text-amber-400">Canceled at period end</span>
                        : subscription.currentPeriodEnd 
                          ? new Date(subscription.currentPeriodEnd).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                          : "—"
                    }
                  </p>
                </div>
              </div>
          </CardContent>
          <CardFooter className="bg-nexus-bg/80 border-t border-nexus-border flex gap-4 pt-4">
            {subscription.cancelAtPeriodEnd ? (
              <Button 
                variant="default" 
                onClick={handleReactivateSubscription} 
                disabled={isMutating}
                className="bg-nexus-primary hover:bg-nexus-primary-hover text-black font-semibold"
              >
                {isMutating ? <IconLoader2 className="h-4 w-4 animate-spin mr-2" /> : <IconRefresh className="h-4 w-4 mr-2" />}
                Reactivate Subscription
              </Button>
            ) : (
              <Button 
                variant="destructive" 
                onClick={() => setShowCancelDialog(true)}
                disabled={isMutating || ["CANCELED", "EXPIRED"].includes(subscription.status)}
              >
                Cancel Subscription
              </Button>
            )}
          </CardFooter>
        </Card>
      )}

      {/* Available Plans */}
      <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h2 className="text-xl font-bold text-nexus-text">Available Plans</h2>
          {availableIntervals.length > 1 && (
            <div className="bg-[#151B2C] p-1 rounded-xl inline-flex shadow-inner">
              {availableIntervals.map((interval) => (
                <button
                  key={interval}
                  onClick={() => setBillingInterval(interval)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    billingInterval === interval
                      ? "bg-nexus-primary text-white shadow-md"
                      : "text-nexus-text-secondary hover:text-white"
                  }`}
                >
                  {intervalToggleLabel(interval)}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            // SOURCE OF TRUTH: prices[] only — never plan.basePrice
            const activePrice =
              plan.prices?.find((p: any) => p.billingInterval === billingInterval && p.isActive) ||
              plan.prices?.find((p: any) => p.billingInterval === billingInterval) ||
              plan.prices?.[0];

            if (!activePrice) return null;

            const priceInfo = getPriceDisplayInfo(activePrice);
            const isCurrent = subscription?.planId === plan.id && subscription?.planPriceId === activePrice?.id;
            const isSamePlanDifferentCycle = subscription?.planId === plan.id && !isCurrent;

            return (
              <Card key={plan.id} className={`flex flex-col relative ${isCurrent ? 'border-nexus-primary ring-1 ring-nexus-primary' : 'border-nexus-border'}`}>
                {/* Savings badge */}
                {priceInfo.hasDiscount && priceInfo.savingsPercent !== null && (
                  <div className="absolute top-4 right-4 flex items-center gap-1 bg-green-500/15 border border-green-500/25 text-green-400 text-xs font-bold px-2.5 py-1 rounded-full">
                    <IconTag className="h-3 w-3" />
                    Save {priceInfo.savingsPercent}%
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="flex justify-between items-center pr-16">
                    {plan.name}
                    {isCurrent && <span className="text-xs bg-nexus-primary/20 text-nexus-primary px-2 py-1 rounded-full uppercase tracking-wider font-bold">Current</span>}
                  </CardTitle>
                  {/* Price block */}
                  <div className="mt-2 space-y-0.5">
                    {/* Strike-through original price */}
                    {priceInfo.hasDiscount && priceInfo.formattedOriginalAmount && (
                      <div className="text-nexus-text-secondary text-sm line-through decoration-red-400/70">
                        {priceInfo.formattedOriginalAmount}
                      </div>
                    )}
                    {/* Current price — dominant */}
                    <div className="flex items-end gap-1">
                      <span className="text-2xl font-bold text-nexus-text">{priceInfo.formattedAmount}</span>
                      <span className="text-sm font-normal text-nexus-text-secondary mb-0.5"> / {priceInfo.intervalLabel}</span>
                    </div>
                  </div>
                  <p className="text-sm text-nexus-text-secondary mt-1">{plan.description}</p>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-3 mt-4">
                    {plan.features.map((pf) => (
                      <li key={pf.id} className="flex items-start gap-2 text-sm">
                        {pf.enabled ? (
                          <IconCheck className="h-5 w-5 text-green-500 shrink-0" />
                        ) : (
                          <IconX className="h-5 w-5 text-red-500 shrink-0" />
                        )}
                        <span className="text-nexus-text">
                          {pf.feature.name}
                          {pf.limitValue !== null && (
                            <span className="text-nexus-text-secondary ml-1">
                              (Limit: {pf.limitValue})
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter className="mt-auto">
                  {!isCurrent ? (
                    <div className="w-full space-y-2">
                      <Button 
                        variant="default" 
                        className="w-full bg-nexus-text text-nexus-bg hover:bg-nexus-text-secondary" 
                        onClick={() => {
                          setTargetPlanToChange(plan);
                          setTargetPriceToChange(activePrice);
                        }}
                        disabled={isMutating}
                      >
                        {isSamePlanDifferentCycle ? "Switch Billing Cycle" : `Change to ${plan.name}`}
                      </Button>
                      
                      {/* DEV BYPASS BUTTON */}
                      {process.env.NODE_ENV === "development" && activePrice && (
                        <Button 
                          variant="outline" 
                          className="w-full border-nexus-primary text-nexus-primary hover:bg-nexus-primary/10" 
                          onClick={() => handleDevSimulateCheckout(plan.id, activePrice.id)}
                          disabled={isMutating}
                          title="DEV BILLING BYPASS: Simulates successful checkout"
                        >
                          [DEV] Activate Plan directly
                        </Button>
                      )}
                    </div>
                  ) : (
                    <Button variant="outline" className="w-full" disabled>
                      Active Plan
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Plan Change Confirmation Dialog */}
      <Dialog open={!!targetPlanToChange} onOpenChange={(open) => {
        if (!open) {
          setTargetPlanToChange(null);
          setTargetPriceToChange(null);
        }
      }}>
        <DialogContent className="bg-nexus-bg border-nexus-border">
          <DialogHeader>
            <DialogTitle>Confirm Plan Change</DialogTitle>
            <DialogDescription>
              Are you sure you want to change your subscription to <strong>{targetPlanToChange?.name}</strong> at <strong>${targetPriceToChange?.amount} / {targetPriceToChange?.billingInterval?.toLowerCase()}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => {
              setTargetPlanToChange(null);
              setTargetPriceToChange(null);
            }} disabled={isMutating}>
              Cancel
            </Button>
            <Button variant="default" onClick={handleChangePlan} disabled={isMutating}>
              {isMutating && <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="bg-nexus-bg border-nexus-border">
          <DialogHeader>
            <DialogTitle>Cancel Subscription</DialogTitle>
            <DialogDescription>
              Your subscription will remain active until the end of the current billing period. After that, your organization will lose access to premium features.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowCancelDialog(false)} disabled={isMutating}>
              Keep Subscription
            </Button>
            <Button variant="destructive" onClick={handleCancelSubscription} disabled={isMutating}>
              {isMutating && <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />}
              Cancel Subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
