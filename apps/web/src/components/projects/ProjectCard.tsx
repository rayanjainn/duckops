"use client";

import Link from "next/link";
import { ExternalLink, Trash2, GitBranch, Clock, Globe, ChevronRight } from "lucide-react";
import type { Project } from "@duckops/shared-types";
import { StatusBadge } from "./StatusBadge";
import { formatDate } from "@/lib/utils";
import { useDeleteProject } from "@/hooks/useProjects";
import { cn } from "@/lib/utils";
import { DeleteProjectDialog } from "./DeleteProjectDialog";
import { useState } from "react";

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const deleteMutation = useDeleteProject();
  const tags = [project.language, project.framework, project.database !== "none" && project.database].filter(Boolean) as string[];

  return (
    <>
      <DeleteProjectDialog
        project={project}
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => {
          deleteMutation.mutate(project.id, {
            onSuccess: () => setIsDeleteDialogOpen(false)
          });
        }}
      />
      
      <div className={cn(
        "group relative p-5 rounded-xl border border-border bg-surface-2 transition-all duration-200 hover:border-border-2 hover:shadow-lg card-hover",
      )}>
        {/* Status accent line */}
        <div className={cn(
          "absolute top-0 left-6 right-6 h-px",
          project.status === "RUNNING" ? "bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" :
          project.status === "DEGRADED" ? "bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" :
          project.status === "FAILED" ? "bg-gradient-to-r from-transparent via-red-500/40 to-transparent" :
          "bg-transparent"
        )} />

        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <Link href={`/projects/${project.id}`}>
                <p className="font-semibold text-foreground hover:text-accent transition-colors truncate text-sm leading-tight">
                  {project.displayName}
                </p>
              </Link>
              <p className="text-[11px] text-muted font-mono mt-0.5">{project.name}</p>
            </div>
            <button
              className="shrink-0 opacity-0 group-hover:opacity-100 text-muted hover:text-red-500 h-7 w-7 flex items-center justify-center rounded-lg hover:bg-red-500/10 transition-all"
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>


        {/* Status */}
        <StatusBadge status={project.status} message={project.statusMessage} size="sm" />

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="inline-block bg-surface-3 border border-border text-muted-2 text-[10px] px-2 py-0.5 rounded-md font-mono capitalize">
              {tag}
            </span>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-1.5 text-[11px] text-muted">
            <Clock className="h-3 w-3" />
            <span>{formatDate(project.createdAt)}</span>
          </div>
          <div className="flex items-center gap-2">
            {project.liveUrl && (
              <a href={project.liveUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] text-amber-500 hover:text-amber-400 transition-colors">
                <Globe className="h-3 w-3" />Open
              </a>
            )}
            <Link href={`/projects/${project.id}`} className="flex items-center gap-0.5 text-[11px] text-muted hover:text-foreground transition-colors">
              Details <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  </>
  );
}



