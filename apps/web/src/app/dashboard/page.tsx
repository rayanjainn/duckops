"use client";

import Link from "next/link";
import { FolderPlus, Activity, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { Header } from "@/components/layout/Header";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ProjectStatus } from "@duckops/shared-types";

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
          <div className={`p-3 rounded-full ${color}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: projects = [], isLoading } = useProjects();

  const stats = {
    total: projects.length,
    running: projects.filter((p) => p.status === "RUNNING").length,
    failed: projects.filter((p) => p.status === "FAILED").length,
    deploying: projects.filter((p) =>
      (["INITIALIZING", "SCAFFOLDING", "PROVISIONING", "CONFIGURING", "PIPELINE_READY", "DEPLOYING"] as ProjectStatus[]).includes(p.status),
    ).length,
  };

  const recentProjects = [...projects].slice(0, 6);

  return (
    <div>
      <Header
        title="Dashboard"
        description="Overview of all your projects"
        actions={
          <Link href="/projects/new">
            <Button>
              <FolderPlus className="h-4 w-4" />
              New Project
            </Button>
          </Link>
        }
      />

      <div className="p-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            label="Total Projects"
            value={stats.total}
            icon={Activity}
            color="bg-blue-500"
          />
          <StatCard
            label="Running"
            value={stats.running}
            icon={CheckCircle}
            color="bg-green-500"
          />
          <StatCard
            label="In Progress"
            value={stats.deploying}
            icon={Clock}
            color="bg-yellow-500"
          />
          <StatCard
            label="Failed"
            value={stats.failed}
            icon={AlertCircle}
            color="bg-red-500"
          />
        </div>

        {/* Recent Projects */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Projects</h2>
            <Link
              href="/projects"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              View all
            </Link>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
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
          ) : recentProjects.length === 0 ? (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <p className="text-gray-400 text-lg mb-4">No projects yet</p>
                <Link href="/projects/new">
                  <Button>
                    <FolderPlus className="h-4 w-4" />
                    Create your first project
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {recentProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
