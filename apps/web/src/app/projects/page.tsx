"use client";

import Link from "next/link";
import { Plus, Activity, CheckCircle2, AlertCircle, Clock, Bot, Sparkles } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { Header } from "@/components/layout/Header";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { Button } from "@/components/ui/button";
import type { ProjectStatus } from "@duckops/shared-types";

const ACTIVE_STATUSES: ProjectStatus[] = ["INITIALIZING", "SCAFFOLDING", "PROVISIONING", "CONFIGURING", "PIPELINE_READY", "DEPLOYING", "CREATING_REPO"];

export default function ProjectsPage() {
  const { data: projects = [], isLoading } = useProjects();

  const stats = {
    total: projects.length,
    running: projects.filter((p) => p.status === "RUNNING").length,
    active: projects.filter((p) => ACTIVE_STATUSES.includes(p.status)).length,
    failed: projects.filter((p) => p.status === "FAILED").length,
  };

  return (
    <div className="min-h-screen bg-surface">
      <Header
        title="Projects"
        description="All your deployed applications"
        actions={
          <Link href="/projects/new">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </Link>
        }
      />

      <div className="p-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total", value: stats.total, icon: Activity, color: "text-foreground", bg: "bg-surface-2", border: "border-border" },
            { label: "Running", value: stats.running, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/5", border: "border-emerald-500/20" },
            { label: "Provisioning", value: stats.active, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/5", border: "border-amber-500/20" },
            { label: "Failed", value: stats.failed, icon: AlertCircle, color: "text-red-500", bg: "bg-red-500/5", border: "border-red-500/20" },
          ].map(({ label, value, icon: Icon, color, bg, border }) => (
            <div key={label} className={`p-4 rounded-xl border ${bg} ${border} flex items-center gap-4`}>
              <div className={`w-9 h-9 rounded-lg ${bg} border ${border} flex items-center justify-center shrink-0`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-[11px] text-muted">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* AI Builder CTA */}
        {projects.length > 0 && (
          <div className="relative p-5 rounded-xl border border-purple-500/20 bg-purple-500/5 overflow-hidden">
            <div className="absolute right-0 top-0 w-64 h-full bg-gradient-to-l from-purple-500/5 to-transparent pointer-events-none" />
            <div className="flex items-center justify-between relative">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                  <Bot className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">AI Code Builder</p>
                  <p className="text-xs text-muted mt-0.5">Open any project → AI Builder tab to generate code, commit, and auto-deploy</p>
                </div>
              </div>
              <Link href="/projects/new" className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-all shrink-0 ml-4">
                <Sparkles className="h-3.5 w-3.5" />
                New AI Project
              </Link>
            </div>
          </div>
        )}

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-44 rounded-xl" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="py-24 text-center space-y-5">
            <div className="w-14 h-14 rounded-xl bg-surface-3 border border-border flex items-center justify-center mx-auto">
              <Activity className="h-7 w-7 text-muted" />
            </div>
            <div>
              <p className="text-foreground font-semibold text-base">No projects yet</p>
              <p className="text-muted text-sm mt-1">Create your first project — AI-assisted or manual setup</p>
            </div>
            <Link href="/projects/new">
              <Button><Plus className="h-4 w-4" />Create Project</Button>
            </Link>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-muted-2 mb-4">{projects.length} project{projects.length !== 1 ? "s" : ""}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
