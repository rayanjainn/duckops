"use client";

import Link from "next/link";
import { Plus, Search, Activity } from "lucide-react";
import { useState } from "react";
import { useProjects } from "@/hooks/useProjects";
import { Header } from "@/components/layout/Header";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import type { ProjectStatus } from "@duckops/shared-types";

const STATUS_FILTERS: { label: string; value: ProjectStatus | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Running", value: "RUNNING" },
  { label: "Deploying", value: "DEPLOYING" },
  { label: "Failed", value: "FAILED" },
  { label: "Degraded", value: "DEGRADED" },
];

export default function ProjectsPage() {
  const { data: projects = [], isLoading } = useProjects();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "ALL">("ALL");

  const filtered = projects.filter((p) => {
    const matchesSearch =
      p.displayName.toLowerCase().includes(search.toLowerCase()) ||
      p.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-surface">
      <Header
        title="Projects"
        description={`${projects.length} project${projects.length !== 1 ? "s" : ""} total`}
        actions={
          <Link href="/projects/new">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </Link>
        }
      />

      <div className="p-8 space-y-6">
        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
            <Input
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-8 text-xs"
            />
          </div>
          <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  statusFilter === f.value
                    ? "bg-surface-4 text-foreground"
                    : "text-muted-2 hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-surface p-5 space-y-3">
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-3 w-1/2" />
                <div className="skeleton h-3 w-2/3" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-surface-3 flex items-center justify-center mx-auto">
                <Activity className="h-6 w-6 text-muted" />
              </div>
              {search || statusFilter !== "ALL" ? (
                <div>
                  <p className="text-foreground font-medium">No results</p>
                  <p className="text-muted text-sm mt-1">Try adjusting your search or filters</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="text-foreground font-medium">No projects yet</p>
                    <p className="text-muted text-sm mt-1">Create your first project to get started</p>
                  </div>
                  <Link href="/projects/new">
                    <Button size="sm">
                      <Plus className="h-4 w-4" />
                      Create Project
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
