"use client";

import { use } from "react";
import Link from "next/link";
import { ExternalLink, RefreshCw, ArrowLeft, AlertCircle, Github, RotateCcw } from "lucide-react";
import { useProject, useRetryProject } from "@/hooks/useProjects";
import { useRealTimeStatus } from "@/hooks/useRealTimeStatus";
import { useProjectStore } from "@/stores/projectStore";
import { Header } from "@/components/layout/Header";
import { StatusBadge } from "@/components/projects/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, getStatusColor, getStatusLabel } from "@/lib/utils";
import type { ProjectStatus } from "@duckops/shared-types";

const STATUS_STEPS: { status: ProjectStatus; label: string }[] = [
  { status: "INITIALIZING", label: "Initialize" },
  { status: "SCAFFOLDING", label: "Scaffold" },
  { status: "PROVISIONING", label: "Provision" },
  { status: "CONFIGURING", label: "Configure" },
  { status: "PIPELINE_READY", label: "Pipeline" },
  { status: "DEPLOYING", label: "Deploy" },
  { status: "RUNNING", label: "Running" },
];

const STATUS_ORDER = STATUS_STEPS.map((s) => s.status);

function ProgressStepper({ current }: { current: ProjectStatus }) {
  const idx = STATUS_ORDER.indexOf(current);
  if (current === "FAILED") {
    return (
      <div className="flex items-center gap-2 text-red-600">
        <AlertCircle className="h-4 w-4" />
        <span className="text-sm font-medium">Provisioning failed</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {STATUS_STEPS.map((step, i) => (
        <div key={step.status} className="flex items-center">
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
              i < idx
                ? "text-green-700 bg-green-50"
                : i === idx
                  ? "text-blue-700 bg-blue-100 font-semibold"
                  : "text-gray-400"
            }`}
          >
            {i < idx ? "✓" : i === idx ? "●" : "○"} {step.label}
          </div>
          {i < STATUS_STEPS.length - 1 && (
            <div
              className={`h-px w-4 ${i < idx ? "bg-green-400" : "bg-gray-200"}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: project, isLoading, refetch } = useProject(id);
  const { mutate: retry, isPending: isRetrying } = useRetryProject();
  const { status: liveStatus } = useRealTimeStatus(id);
  const updateLiveStatus = useProjectStore((s) => s.updateLiveStatus);

  // Apply live status update from socket
  if (liveStatus && project) {
    updateLiveStatus(id, liveStatus.status as ProjectStatus, liveStatus.message);
  }

  const effectiveStatus = (liveStatus?.status as ProjectStatus) || project?.status;
  const effectiveMessage = liveStatus?.message || project?.statusMessage;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Project not found</p>
        <Link href="/projects" className="text-blue-600 text-sm mt-2 inline-block">
          Back to projects
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Header
        title={project.displayName}
        description={project.description || `${project.language} · ${project.framework} · ${project.database} · ${project.orm}`}
        actions={
          <div className="flex items-center gap-2">
            {(effectiveStatus === "FAILED" || project.status === "FAILED") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => retry(id, { onSuccess: () => refetch() })}
                disabled={isRetrying}
              >
                <RotateCcw className={`h-3.5 w-3.5 ${isRetrying ? "animate-spin" : ""}`} />
                {isRetrying ? "Retrying..." : "Retry"}
              </Button>
            )}
            {project.liveUrl && (
              <a href={project.liveUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open App
                </Button>
              </a>
            )}
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        }
      />

      <div className="p-8 space-y-6">
        {/* Back */}
        <Link
          href="/projects"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to projects
        </Link>

        {/* Status & Progress */}
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <StatusBadge
              status={effectiveStatus || project.status}
              message={effectiveMessage}
            />
            <ProgressStepper current={effectiveStatus || project.status} />
          </CardContent>
        </Card>

        {/* Tech Stack */}
        <Card>
          <CardHeader>
            <CardTitle>Tech Stack</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "Language", value: project.language },
                { label: "Framework", value: project.framework },
                { label: "Database", value: project.database },
                { label: "ORM", value: project.orm },
              ].map(({ label, value }) => (
                <div key={label} className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">{label}</p>
                  <p className="font-medium capitalize">{value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* GitHub Repository */}
        {project.githubRepoUrl && (
          <Card>
            <CardHeader>
              <CardTitle>GitHub Repository</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Repository</span>
                <a
                  href={project.githubRepoUrl}
                  className="flex items-center gap-1.5 text-blue-600 hover:underline font-mono text-xs"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="h-3.5 w-3.5" />
                  {project.githubRepoFullName}
                </a>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Infrastructure */}
        {(project.liveUrl || project.namespace) && (
          <Card>
            <CardHeader>
              <CardTitle>Infrastructure</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {project.namespace && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">K8s Namespace</span>
                  <span className="font-mono">{project.namespace}</span>
                </div>
              )}
              {project.liveUrl && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Live URL</span>
                  <a
                    href={project.liveUrl}
                    className="text-blue-600 hover:underline font-mono text-xs"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {project.liveUrl}
                  </a>
                </div>
              )}
              {project.internalPort && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Internal Port</span>
                  <span className="font-mono">{project.internalPort}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Pipeline */}
        {project.pipeline && (
          <Card>
            <CardHeader>
              <CardTitle>CI/CD Pipeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Job Name</span>
                <span className="font-mono">{project.pipeline.jenkinsJobName}</span>
              </div>
              {project.pipeline.jenkinsJobUrl && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Jenkins URL</span>
                  <a
                    href={project.pipeline.jenkinsJobUrl}
                    className="text-blue-600 hover:underline text-xs"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open in Jenkins
                  </a>
                </div>
              )}
              {project.pipeline.lastBuildNumber && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Last Build</span>
                  <span
                    className={
                      project.pipeline.lastBuildStatus === "SUCCESS"
                        ? "text-green-600"
                        : "text-red-600"
                    }
                  >
                    #{project.pipeline.lastBuildNumber} —{" "}
                    {project.pipeline.lastBuildStatus}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Health History */}
        {project.healthChecks && project.healthChecks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Health Checks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {project.healthChecks.slice(0, 10).map((check) => (
                  <div
                    key={check.id}
                    className="flex items-center justify-between text-sm py-1 border-b border-gray-100 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          check.status === "HEALTHY"
                            ? "bg-green-500"
                            : check.status === "TIMEOUT"
                              ? "bg-yellow-500"
                              : "bg-red-500"
                        }`}
                      />
                      <span className="capitalize">{check.status.toLowerCase()}</span>
                      {check.message && (
                        <span className="text-gray-400">— {check.message}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-gray-400 text-xs">
                      {check.responseTime && <span>{check.responseTime}ms</span>}
                      <span>{formatDate(check.checkedAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Deployments */}
        {project.deployments && project.deployments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Deployments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {project.deployments.slice(0, 5).map((dep) => (
                  <div
                    key={dep.id}
                    className="flex items-center justify-between text-sm py-1 border-b border-gray-100 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded ${
                          dep.status === "SUCCESS"
                            ? "bg-green-100 text-green-700"
                            : dep.status === "FAILED"
                              ? "bg-red-100 text-red-700"
                              : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {dep.status}
                      </span>
                      <span className="font-mono text-xs">{dep.imageTag}</span>
                    </div>
                    <span className="text-gray-400 text-xs">
                      {formatDate(dep.startedAt)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Metadata */}
        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Project ID</span>
              <span className="font-mono text-xs">{project.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Created</span>
              <span>{formatDate(project.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Updated</span>
              <span>{formatDate(project.updatedAt)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
