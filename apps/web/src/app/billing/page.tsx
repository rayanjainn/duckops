"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CreditCard, Zap, CheckCircle2, AlertCircle, Loader2, Bot, Folder } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { billingApi } from "@/lib/api";

interface BillingStatus {
  plan: string;
  devMode: boolean;
  aiPromptsRemaining: number;
  aiPromptsResetAt?: string;
  projectCount: number;
}

function BillingPageInner() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [devModeLoading, setDevModeLoading] = useState(false);
  const [banner, setBanner] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const success = searchParams.get("success");
  const cancelled = searchParams.get("cancelled");

  useEffect(() => {
    if (success === "1") setBanner({ type: "success", msg: "Payment successful! Your plan has been upgraded to Pro." });
    if (cancelled === "1") setBanner({ type: "error", msg: "Checkout was cancelled. No charge was made." });
  }, [success, cancelled]);

  useEffect(() => {
    billingApi.getStatus()
      .then(setStatus)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleUpgrade = async () => {
    setCheckoutLoading(true);
    try {
      const { url } = await billingApi.createCheckout();
      if (url) window.location.href = url;
    } catch (err: any) {
      setBanner({ type: "error", msg: err?.message || "Failed to start checkout." });
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const { url } = await billingApi.getPortal();
      if (url) window.location.href = url;
    } catch (err: any) {
      setBanner({ type: "error", msg: err?.message || "Failed to open billing portal." });
    } finally {
      setPortalLoading(false);
    }
  };

  const handleDevMode = async () => {
    setDevModeLoading(true);
    try {
      const { devMode } = await billingApi.toggleDevMode();
      setStatus((s) => s ? { ...s, devMode } : s);
    } catch (err: any) {
      setBanner({ type: "error", msg: err?.message || "Failed to toggle dev mode." });
    } finally {
      setDevModeLoading(false);
    }
  };

  const isPro = status?.plan === "PRO";

  return (
    <div className="min-h-screen bg-surface">
      <Header title="Billing" description="Manage your plan and usage" />

      <div className="p-8 max-w-3xl space-y-6">
        {/* Banner */}
        {banner && (
          <div className={`flex items-center gap-3 p-4 rounded-xl border text-sm ${
            banner.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
              : "bg-red-500/10 border-red-500/20 text-red-500"
          }`}>
            {banner.type === "success"
              ? <CheckCircle2 className="h-4 w-4 shrink-0" />
              : <AlertCircle className="h-4 w-4 shrink-0" />
            }
            {banner.msg}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-muted text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading billing status...
          </div>
        ) : (
          <>
            {/* Current Plan */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Current Plan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isPro ? "bg-amber-500/15" : "bg-surface-3"}`}>
                      {isPro
                        ? <Zap className="h-5 w-5 text-amber-500" />
                        : <CreditCard className="h-5 w-5 text-muted" />
                      }
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{isPro ? "Pro" : "Free"}</p>
                      <p className="text-xs text-muted">{isPro ? "Unlimited projects & AI prompts" : "Up to 2 projects · 3 AI prompts / 6 hrs"}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${isPro ? "bg-amber-500/10 border-amber-500/20 text-amber-500" : "bg-surface-3 border-border text-muted"}`}>
                    {isPro ? "PRO" : "FREE"}
                  </span>
                </div>

                {/* Usage stats */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                  <div className="p-3 rounded-lg bg-surface-3 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <Folder className="h-3.5 w-3.5 text-muted" />
                      <p className="text-[10px] text-muted uppercase tracking-wider">Projects</p>
                    </div>
                    <p className="text-lg font-bold text-foreground">
                      {status?.projectCount ?? 0}
                      <span className="text-xs font-normal text-muted ml-1">/ {isPro ? "∞" : "2"}</span>
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-surface-3 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <Bot className="h-3.5 w-3.5 text-muted" />
                      <p className="text-[10px] text-muted uppercase tracking-wider">AI Prompts</p>
                    </div>
                    <p className="text-lg font-bold text-foreground">
                      {isPro || status?.devMode ? "∞" : (status?.aiPromptsRemaining ?? 0)}
                      {!isPro && !status?.devMode && <span className="text-xs font-normal text-muted ml-1">/ 3 remaining</span>}
                    </p>
                    {!isPro && !status?.devMode && status?.aiPromptsResetAt && (
                      <p className="text-[10px] text-muted mt-1">
                        Resets {new Date(status.aiPromptsResetAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 pt-1">
                  {!isPro ? (
                    <Button onClick={handleUpgrade} disabled={checkoutLoading} className="flex-1">
                      {checkoutLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Zap className="h-3.5 w-3.5 mr-1" />}
                      Upgrade to Pro — $29/mo
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={handlePortal} disabled={portalLoading} className="flex-1">
                      {portalLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CreditCard className="h-3.5 w-3.5 mr-1" />}
                      Manage Subscription
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Dev Mode toggle */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  Dev Mode
                  <span className="text-[10px] font-normal text-muted bg-surface-3 border border-border px-2 py-0.5 rounded-full">Local only</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-foreground">Bypass plan limits for local development</p>
                    <p className="text-xs text-muted mt-0.5">Enables unlimited projects and AI prompts. Not for production use.</p>
                  </div>
                  <button
                    onClick={handleDevMode}
                    disabled={devModeLoading}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors focus:outline-none ${
                      status?.devMode ? "bg-amber-500 border-amber-600" : "bg-surface-3 border-border"
                    } ${devModeLoading ? "opacity-50" : ""}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        status?.devMode ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Plans comparison */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Plan Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    {
                      name: "Free",
                      price: "$0/mo",
                      current: !isPro,
                      features: ["2 projects max", "3 AI prompts / 6 hrs", "Jenkins CI/CD", "K8s deployment", "Health monitoring"],
                    },
                    {
                      name: "Pro",
                      price: "$29/mo",
                      current: isPro,
                      features: ["Unlimited projects", "Unlimited AI prompts", "Priority builds", "All Free features", "Billing portal"],
                    },
                  ].map((plan) => (
                    <div key={plan.name} className={`p-4 rounded-xl border ${plan.current ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-surface-2"}`}>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-foreground">{plan.name}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-mono text-foreground">{plan.price}</p>
                          {plan.current && (
                            <span className="text-[10px] text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">Current</span>
                          )}
                        </div>
                      </div>
                      <ul className="space-y-1.5">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-center gap-2 text-xs text-muted">
                            <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={null}>
      <BillingPageInner />
    </Suspense>
  );
}
