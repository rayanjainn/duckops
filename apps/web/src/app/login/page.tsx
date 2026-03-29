"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Github, GitBranch, Server, Zap, Activity } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const features = [
  { icon: GitBranch, text: "Automated scaffolding & GitHub repo creation" },
  { icon: Server, text: "Kubernetes deployment via Terraform + Ansible" },
  { icon: Zap, text: "Jenkins CI/CD with SCM polling on every push" },
  { icon: Activity, text: "Real-time health monitoring & status tracking" },
];

export default function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex">
      {/* Left — branding */}
      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 border-r border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center">
            <GitBranch className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-foreground">DuckOps</span>
        </div>

        <div className="space-y-6 max-w-md">
          <h1 className="text-4xl font-bold text-foreground leading-tight">
            Ship projects.<br />
            <span className="gradient-text">Not infrastructure.</span>
          </h1>
          <p className="text-muted-2 leading-relaxed">
            Pick a stack. DuckOps scaffolds, provisions, and deploys your project to Kubernetes — then keeps it running with automated CI/CD and health monitoring.
          </p>

          <div className="space-y-3 pt-2">
            {features.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-surface-3 border border-border-2 flex items-center justify-center shrink-0">
                  <Icon className="h-3.5 w-3.5 text-amber-400" />
                </div>
                <span className="text-sm text-muted-2">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted">DuckOps — Internal Developer Platform</p>
      </div>

      {/* Right — login */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <div className="w-full max-w-sm space-y-8">
          <div className="lg:hidden flex items-center gap-3 justify-center mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center">
              <GitBranch className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-foreground text-lg">DuckOps</span>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground">Sign in</h2>
            <p className="text-muted-2 text-sm mt-1">Use your GitHub account to continue</p>
          </div>

          <div className="space-y-4">
            <a
              href={`${API_URL}/api/auth/github`}
              className="flex items-center justify-center gap-3 w-full bg-white text-slate-900 hover:bg-slate-100 font-semibold py-3 px-4 rounded-xl transition-colors shadow-sm"
            >
              <Github className="h-5 w-5" />
              Continue with GitHub
            </a>

            <p className="text-center text-xs text-muted leading-relaxed">
              By signing in, you allow DuckOps to create private repositories on your behalf.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
