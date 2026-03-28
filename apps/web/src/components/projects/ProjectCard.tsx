"use client";

import Link from "next/link";
import { ExternalLink, Trash2 } from "lucide-react";
import type { Project } from "@duckops/shared-types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./StatusBadge";
import { formatDate } from "@/lib/utils";
import { useDeleteProject } from "@/hooks/useProjects";

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const deleteMutation = useDeleteProject();

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={`/projects/${project.id}`}>
              <CardTitle className="text-base hover:text-blue-600 transition-colors truncate">
                {project.displayName}
              </CardTitle>
            </Link>
            <CardDescription className="text-xs mt-0.5 font-mono">
              {project.name}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-gray-400 hover:text-red-500 h-7 w-7"
            onClick={() => {
              if (confirm(`Delete ${project.displayName}?`)) {
                deleteMutation.mutate(project.id);
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <StatusBadge status={project.status} message={project.statusMessage} />

        <div className="flex flex-wrap gap-1.5">
          {[project.language, project.framework, project.database, project.orm].map(
            (tag) => (
              <span
                key={tag}
                className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded"
              >
                {tag}
              </span>
            ),
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-gray-400">{formatDate(project.createdAt)}</span>
          {project.liveUrl && (
            <a
              href={project.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
            >
              <ExternalLink className="h-3 w-3" />
              Open App
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
