"use client";

import Link from "next/link";
import { ExternalLink, Trash2, GitBranch } from "lucide-react";
import type { Project } from "@duckops/shared-types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./StatusBadge";
import { formatDate } from "@/lib/utils";
import { useDeleteProject } from "@/hooks/useProjects";

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const deleteMutation = useDeleteProject();
  const tags = [project.language, project.framework, project.database !== "none" && project.database, project.orm !== "none" && project.orm].filter(Boolean) as string[];

  return (
    <Card className="hover:border-border-2 transition-all group">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={`/projects/${project.id}`}>
              <p className="font-semibold text-foreground hover:text-amber-400 transition-colors truncate text-sm leading-tight">
                {project.displayName}
              </p>
            </Link>
            <p className="text-xs text-muted font-mono mt-0.5">{project.name}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 h-7 w-7"
            onClick={() => {
              if (confirm(`Delete ${project.displayName}?`)) {
                deleteMutation.mutate(project.id);
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        <StatusBadge status={project.status} message={project.statusMessage} size="sm" />

        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="inline-block bg-surface-3 text-muted-2 text-xs px-2 py-0.5 rounded-md font-mono">
              {tag}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-border">
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <GitBranch className="h-3 w-3" />
            <span>{formatDate(project.createdAt)}</span>
          </div>
          {project.liveUrl && (
            <a
              href={project.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
            >
              <ExternalLink className="h-3 w-3" />
              Open
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
