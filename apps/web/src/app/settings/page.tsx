"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  User,
  Shield,
  CreditCard,
  Trash2,
  Github,
  AlertTriangle,
  CheckCircle,
  Zap,
  BarChart2,
  Clock,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { billingApi, authApi } from "@/lib/api";
import { clearSession } from "@/lib/auth";

interface BillingStatus {
  plan: string;
  devMode: boolean;
  aiPromptsRemaining: number;
  aiPromptsResetAt: string;
  projectCount: number;
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    billingApi.getStatus().then(setBilling).catch(() => {});
  }, []);

  const handleUpgrade = async () => {
    setCheckoutLoading(true);
    try {
      const { url } = await billingApi.createCheckout();
      window.location.href = url;
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const { url } = await billingApi.getPortal();
      window.location.href = url;
    } finally {
      setPortalLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "DELETE") return;
    setDeleting(true);
    setDeleteError("");
    try {
      await authApi.deleteAccount();
      clearSession();
      router.push("/login");
    } catch (e: any) {
      setDeleteError(e.message || "Failed to delete account");
      setDeleting(false);
    }
  };

  const resetTime = billing?.aiPromptsResetAt
    ? new Date(billing.aiPromptsResetAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  const projectLimit = billing?.plan === "PRO" || billing?.devMode ? "∞" : "2";

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Account Settings</h1>
        <p className="text-sm text-muted mt-1">Manage your profile, plan, and account</p>
      </div>

      {/* ── Profile ──────────────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-surface p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <User className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Profile</h2>
        </div>
        {user && (
          <div className="flex items-center gap-4">
            {user.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt={user.name}
                width={64}
                height={64}
                className="rounded-full ring-2 ring-border-2"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-amber-600 flex items-center justify-center text-2xl font-bold text-white">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">{user.name}</p>
              <p className="text-sm text-muted flex items-center gap-1.5">
                <Github className="h-3.5 w-3.5" />
                @{user.githubUsername}
              </p>
              <p className="text-xs text-muted">{user.email}</p>
            </div>
          </div>
        )}
        <p className="text-xs text-muted">
          Profile is synced from GitHub. To update your name or avatar, change them on GitHub and log in again.
        </p>
      </section>

      {/* ── Usage ────────────────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-surface p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <BarChart2 className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Usage</h2>
        </div>
        {billing ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-surface-2 border border-border p-4 space-y-1">
              <p className="text-xs text-muted">Projects</p>
              <p className="text-2xl font-bold text-foreground">
                {billing.projectCount}
                <span className="text-sm font-normal text-muted"> / {projectLimit}</span>
              </p>
              <p className="text-xs text-muted">
                {billing.plan === "PRO" || billing.devMode ? "Unlimited" : "Free tier: 2 projects"}
              </p>
            </div>
            <div className="rounded-lg bg-surface-2 border border-border p-4 space-y-1">
              <p className="text-xs text-muted">AI Prompts</p>
              <p className="text-2xl font-bold text-foreground">
                {billing.devMode ? "∞" : billing.aiPromptsRemaining}
                {!billing.devMode && billing.plan === "FREE" && (
                  <span className="text-sm font-normal text-muted"> / 3</span>
                )}
              </p>
              {!billing.devMode && billing.plan === "FREE" && resetTime && (
                <p className="text-xs text-muted flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Resets at {resetTime}
                </p>
              )}
              {(billing.devMode || billing.plan === "PRO") && (
                <p className="text-xs text-muted">Unlimited</p>
              )}
            </div>
          </div>
        ) : (
          <div className="h-24 rounded-lg bg-surface-2 border border-border animate-pulse" />
        )}
      </section>

      {/* ── Plan ─────────────────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-surface p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <CreditCard className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Plan</h2>
        </div>
        {billing && (
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-bold px-2.5 py-0.5 rounded-full ${
                    billing.plan === "PRO"
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      : "bg-surface-3 text-muted border border-border"
                  }`}
                >
                  {billing.plan}
                </span>
                {billing.devMode && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    Dev Mode ON
                  </span>
                )}
              </div>
              <p className="text-xs text-muted">
                {billing.plan === "PRO"
                  ? "Unlimited projects, unlimited AI prompts, priority support"
                  : "2 projects, 3 AI prompts per 6h"}
              </p>
            </div>
            {billing.plan === "PRO" ? (
              <button
                onClick={handlePortal}
                disabled={portalLoading}
                className="text-sm px-4 py-2 rounded-lg border border-border text-muted hover:text-foreground hover:border-border-2 transition-all disabled:opacity-50"
              >
                {portalLoading ? "Loading..." : "Manage"}
              </button>
            ) : (
              <button
                onClick={handleUpgrade}
                disabled={checkoutLoading}
                className="text-sm px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium transition-all disabled:opacity-50"
              >
                {checkoutLoading ? "Loading..." : "Upgrade to Pro"}
              </button>
            )}
          </div>
        )}
      </section>

      {/* ── Security ─────────────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-surface p-6 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Security</h2>
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium text-foreground">GitHub OAuth</p>
            <p className="text-xs text-muted">Authentication via GitHub. No password stored.</p>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-green-400">
            <CheckCircle className="h-3.5 w-3.5" />
            Connected
          </span>
        </div>
        <div className="flex items-center justify-between py-2 border-t border-border">
          <div>
            <p className="text-sm font-medium text-foreground">Sign out</p>
            <p className="text-xs text-muted">End your current session</p>
          </div>
          <button
            onClick={logout}
            className="text-sm px-4 py-1.5 rounded-lg border border-border text-muted hover:text-foreground hover:border-border-2 transition-all"
          >
            Sign out
          </button>
        </div>
      </section>

      {/* ── Danger Zone ──────────────────────────────────────── */}
      <section className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider">Danger Zone</h2>
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Delete Account</p>
          <p className="text-xs text-muted mt-1">
            Permanently deletes your account, all projects, GitHub repos, Kubernetes namespaces,
            Jenkins jobs, and all data. This cannot be undone.
          </p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted block mb-1.5">
              Type <span className="font-mono font-bold text-red-400">DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
              className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-red-500/50 font-mono"
            />
          </div>
          {deleteError && (
            <p className="text-xs text-red-400">{deleteError}</p>
          )}
          <button
            onClick={handleDeleteAccount}
            disabled={deleteConfirm !== "DELETE" || deleting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? "Deleting everything..." : "Delete my account"}
          </button>
        </div>
      </section>
    </div>
  );
}
