"use client";

import Link from "next/link";
import { FolderPlus, Search } from "lucide-react";
import { useState } from "react";
import { useProjects } from "@/hooks/useProjects";
import { Header } from "@/components/layout/Header";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function ProjectsPage() {
  const { data: projects = [], isLoading } = useProjects();
  const [search, setSearch] = useState("");

  const filtered = projects.filter(
    (p) =>
      p.displayName.toLowerCase().includes(search.toLowerCase()) ||
      p.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <Header
        title="Projects"
        description={`${projects.length} project${projects.length !== 1 ? "s" : ""}`}
        actions={
          <Link href="/projects/new">
            <Button>
              <FolderPlus className="h-4 w-4" />
              New Project
            </Button>
          </Link>
        }
      />

      <div className="p-8 space-y-6">
        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                    <div className="h-3 bg-gray-200 rounded w-2/3" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              {search ? (
                <p className="text-gray-400">No projects matching "{search}"</p>
              ) : (
                <>
                  <p className="text-gray-400 text-lg mb-4">No projects yet</p>
                  <Link href="/projects/new">
                    <Button>
                      <FolderPlus className="h-4 w-4" />
                      Create your first project
                    </Button>
                  </Link>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {filtered.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
