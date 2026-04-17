"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  ExternalLink, RefreshCw, ArrowLeft, AlertCircle, Github, X,
  RotateCcw, CheckCircle2, Circle, Clock, GitCommit,
  Server, Package, GitBranch, Zap, Activity, Terminal,
  Globe, Database, BarChart3, ChevronDown, ChevronRight,
} from "lucide-react";
import { useProject, useRetryProject } from "@/hooks/useProjects";
import { useRealTimeStatus } from "@/hooks/useRealTimeStatus";
import { useLiveBuild } from "@/hooks/useLiveBuild";
import { useProjectStore } from "@/stores/projectStore";
import { Header } from "@/components/layout/Header";
import { StatusBadge } from "@/components/projects/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, getStatusLabel } from "@/lib/utils";
import type { ProjectStatus } from "@duckops/shared-types";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from "recharts";
import ReactFlow, {
  type Node, type Edge, Background, BackgroundVariant,
} from "reactflow";
import "reactflow/dist/style.css";

// ─── Pipeline stages with sub-steps ──────────────────────────────────────────

const PIPELINE_STAGES: {
  status: ProjectStatus;
  label: string;
  icon: React.ElementType;
  subSteps: string[];
}[] = [
  {
    status: "INITIALIZING",
    label: "Initialize",
    icon: Circle,
    subSteps: ["Register project in database", "Allocate project ID", "Set up socket channel"],
  },
  {
    status: "SCAFFOLDING",
    label: "Scaffold",
    icon: Package,
    subSteps: ["Render Handlebars templates", "Generate app source code", "Write Dockerfile", "Write K8s manifests", "Write Jenkinsfile"],
  },
  {
    status: "PROVISIONING",
    label: "Provision",
    icon: Server,
    subSteps: ["Build Docker image", "Push image to registry", "Run Terraform init", "Create K8s namespace", "Apply ConfigMap"],
  },
  {
    status: "CONFIGURING",
    label: "Configure",
    icon: Database,
    subSteps: ["Run Ansible playbook", "Apply Deployment manifest", "Apply Service manifest", "Configure Traefik ingress", "Wait for pod rollout"],
  },
  {
    status: "PIPELINE_READY",
    label: "Pipeline",
    icon: GitBranch,
    subSteps: ["Store GitHub credentials in Jenkins", "Generate Jenkinsfile pipeline XML", "Create Jenkins job", "Configure SCM polling"],
  },
  {
    status: "DEPLOYING",
    label: "Deploy",
    icon: Zap,
    subSteps: ["Trigger initial build", "Run npm install", "Run tests", "Build Docker image", "Push to registry", "kubectl set image"],
  },
  {
    status: "RUNNING",
    label: "Running",
    icon: CheckCircle2,
    subSteps: ["App live at ingress URL", "Health checks every 30s", "SCM polling active (1 min)"],
  },
];

const STATUS_ORDER = PIPELINE_STAGES.map((s) => s.status);

function getStageIndex(status: ProjectStatus): number {
  if (status === "RUNNING" || status === "DEGRADED") return STATUS_ORDER.length - 1;
  const i = STATUS_ORDER.indexOf(status);
  return i >= 0 ? i : -1;
}

// ─── Pipeline Stepper ────────────────────────────────────────────────────────

function PipelineStepper({ current, activeSubStep }: { current: ProjectStatus; activeSubStep?: string | null }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const currentIdx = getStageIndex(current);
  const isFailed = current === "FAILED";

  if (isFailed) {
    return (
      <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
        <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
        <span className="text-sm text-red-400 font-medium">Provisioning failed — check logs and retry</span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {PIPELINE_STAGES.map((stage, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        const pending = i > currentIdx;
        const Icon = stage.icon;
        const isOpen = expanded === i;

        return (
          <div key={stage.status} className="rounded-lg overflow-hidden">
            <button
              onClick={() => setExpanded(isOpen ? null : i)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all ${
                active
                  ? "bg-amber-600/10 border border-amber-500/20"
                  : done
                  ? "bg-emerald-500/5 border border-emerald-500/10"
                  : "border border-transparent hover:bg-surface-3/50"
              } rounded-lg`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                done ? "bg-emerald-600" : active ? "bg-amber-600 ring-2 ring-amber-500/30" : "bg-surface-3 border border-border-2"
              }`}>
                {done ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                ) : active ? (
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                ) : (
                  <Icon className="h-3 w-3 text-muted" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${done ? "text-emerald-400" : active ? "text-amber-300" : "text-muted"}`}>
                  {stage.label}
                </p>
                {active && (
                  <p className="text-xs text-muted mt-0.5">
                    {activeSubStep || getStatusLabel(current)}...
                  </p>
                )}
              </div>

              {active && <Clock className="h-3.5 w-3.5 text-amber-400 animate-spin" style={{ animationDuration: "3s" }} />}
              {(done || pending) && (
                isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted" /> : <ChevronRight className="h-3.5 w-3.5 text-muted" />
              )}
            </button>

            {isOpen && (
              <div className="ml-9 mt-1 mb-2 space-y-1 border-l border-border pl-4">
                {stage.subSteps.map((step, j) => {
                  const isActiveSubStep = active && activeSubStep
                    ? step.toLowerCase().includes(activeSubStep.toLowerCase()) || activeSubStep.toLowerCase().includes(step.toLowerCase())
                    : active && j === 0;
                  return (
                    <div key={j} className="flex items-center gap-2 py-1">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        done ? "bg-emerald-500" : isActiveSubStep ? "bg-amber-500 animate-pulse" : "bg-surface-3"
                      }`} />
                      <span className={`text-xs ${done ? "text-muted-2" : isActiveSubStep ? "text-foreground" : "text-muted"}`}>
                        {step}
                      </span>
                      {done && <CheckCircle2 className="h-3 w-3 text-emerald-500/60 ml-auto" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Infrastructure Flow Diagram ─────────────────────────────────────────────

function InfraFlowDiagram({ project }: { project: { name: string; namespace?: string | null; liveUrl?: string | null; database: string; status: string } }) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const nodes: Node[] = [
    {
      id: "github",
      position: { x: 0, y: 80 },
      data: {
        label: <NodeBox icon={<Github className="h-4 w-4" />} title="GitHub" sub="Source repo" accent="#e5e7eb" accentBg="var(--color-surface-4)" />,
        description: "The source code repository on GitHub. DuckOps uses a dedicated organization and personal access tokens to manage repositories, configure webhooks, and sync your source code with Jenkins.",
        type: "Source Control"
      },
      style: nodeStyle("var(--color-surface-2)", "var(--color-border)"),
    },
    {
      id: "jenkins",
      position: { x: 280, y: 80 },
      data: {
        label: <NodeBox icon={<GitBranch className="h-4 w-4" />} title="Jenkins" sub="CI/CD engine" accent="#f59e0b" accentBg="var(--color-accent-muted)" />,
        description: "Continuous Integration and Deployment server. Jenkins automatically polls GitHub for changes, builds Docker images, runs automated tests, and triggers deployments to the Kubernetes cluster.",
        type: "CI/CD Pipeline"
      },
      style: nodeStyle("var(--color-surface-2)", "var(--color-border)"),
    },
    {
      id: "registry",
      position: { x: 560, y: 80 },
      data: {
        label: <NodeBox icon={<Package className="h-4 w-4" />} title="Registry" sub="k3d:5111" accent="#a78bfa" accentBg="var(--color-surface-4)" />,
        description: "A local Docker container registry. Images built by Jenkins are securely stored here before being pulled by the Kubernetes nodes during deployment stages.",
        type: "Artifact Registry"
      },
      style: nodeStyle("var(--color-surface-2)", "var(--color-border)"),
    },
    {
      id: "k8s",
      position: { x: 840, y: 80 },
      data: {
        label: <NodeBox icon={<Server className="h-4 w-4" />} title="Kubernetes" sub={project.namespace || "k3d cluster"} accent="#60a5fa" accentBg="var(--color-surface-4)" />,
        description: "The container orchestration platform. DuckOps manages resources like Namespaces, Deployments, Services, and Ingress to ensure your application is highly available and scalable.",
        type: "Orchestration"
      },
      style: nodeStyle("var(--color-surface-2)", "var(--color-border)"),
    },
    {
      id: "pod",
      position: { x: 700, y: 280 },
      data: {
        label: <NodeBox icon={<Activity className="h-4 w-4" />} title={project.name} sub={`Pod · ${project.status === "RUNNING" ? "Running" : project.status === "DEGRADED" ? "Degraded" : project.status === "STOPPED" ? "Stopped" : "Pending"}`} accent={project.status === "RUNNING" ? "#60a5fa" : project.status === "DEGRADED" ? "#f59e0b" : "#9ca3af"} accentBg="var(--color-surface-4)" />,
        description: "The actual running instance of your application container. Each pod is scheduled by Kubernetes and monitored by the DuckOps health service for real-time status updates.",
        type: "Application Container"
      },
      style: nodeStyle("var(--color-surface-2)", "var(--color-border)"),
    },
    {
      id: "traefik",
      position: { x: 420, y: 280 },
      data: {
        label: <NodeBox icon={<Globe className="h-4 w-4" />} title="Traefik" sub="Ingress :8080" accent="#34d399" accentBg="var(--color-surface-4)" />,
        description: "The modern HTTP reverse proxy and load balancer. Traefik handles incoming traffic on port 8080 and routes it to the correct service inside the cluster based on hostnames.",
        type: "Ingress Controller"
      },
      style: nodeStyle("var(--color-surface-2)", "var(--color-border)"),
    },
  ];

  const edges: Edge[] = [
    { id: "e1", source: "github", target: "jenkins", label: "push", style: { stroke: "#d97706", strokeWidth: 1.5 }, animated: true },
    { id: "e2", source: "jenkins", target: "registry", label: "build & push", style: { stroke: "#7c3aed", strokeWidth: 1.5 }, animated: true },
    { id: "e3", source: "registry", target: "k8s", label: "pull image", style: { stroke: "#3b82f6", strokeWidth: 1.5 } },
    { id: "e4", source: "k8s", target: "pod", label: "schedule", style: { stroke: "#3b82f6", strokeWidth: 1.5 }, animated: true },
    { id: "e5", source: "traefik", target: "pod", label: ":80", style: { stroke: "#10b981", strokeWidth: 1.5 } },
  ];

  const selectedNodeData = selectedNode ? nodes.find(n => n.id === selectedNode)?.data : null;

  return (
    <div className="space-y-3">
      <div className="h-[340px] rounded-xl overflow-hidden bg-surface border border-border relative group">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          onNodeClick={(_, node) => setSelectedNode(node.id)}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={true}
          zoomOnScroll={false}
          panOnDrag={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--color-border)" />
        </ReactFlow>

        {/* Info Panel Overlay */}
        {selectedNodeData && (
          <div className="absolute top-4 right-4 w-64 bg-surface-2/95 backdrop-blur-sm border border-border rounded-xl p-4 shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">{selectedNodeData.type}</span>
                <h4 className="text-sm font-bold text-foreground">{selectedNodeData.label.props.title}</h4>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedNode(null); }}
                className="text-muted hover:text-foreground p-1 rounded-md hover:bg-surface-3 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-muted-2 leading-relaxed">
              {selectedNodeData.description}
            </p>
          </div>
        )}

        {/* Hint */}
        {!selectedNode && (
          <div className="absolute bottom-3 left-3 px-2 py-1 bg-surface-3/50 backdrop-blur-sm border border-border rounded-md pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
            <p className="text-[10px] text-muted-2">Click a node to see details</p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 px-1">
        {[
          { color: "#d97706", label: "SCM push trigger" },
          { color: "#7c3aed", label: "Image build & push" },
          { color: "#3b82f6", label: "Kubernetes deploy" },
          { color: "#10b981", label: "Traefik ingress" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-muted">
            <span className="w-5 h-px inline-block" style={{ background: color }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

function NodeBox({ icon, title, sub, accent, accentBg }: { icon: React.ReactNode; title: string; sub: string; accent: string; accentBg: string }) {
  return (
    <div className="text-center py-1 px-0.5" style={{ minWidth: 110 }}>
      <div className="w-7 h-7 rounded-lg mx-auto mb-1.5 flex items-center justify-center" style={{ background: accentBg, color: accent }}>
        {icon}
      </div>
      <p className="text-xs font-semibold text-foreground">{title}</p>
      <p className="text-[10px] mt-0.5 text-muted">{sub}</p>
    </div>
  );
}

function nodeStyle(bg: string, border: string) {
  return {
    background: bg,
    border: `1px solid ${border}`,
    borderRadius: 10,
    padding: "8px 6px",
  };
}

// ─── Health chart ────────────────────────────────────────────────────────────

function HealthChart({ checks }: { checks: { status: string; responseTime?: number | null; checkedAt: string }[] }) {
  const data = checks
    .slice(0, 20)
    .reverse()
    .map((c, i) => ({
      i,
      ms: c.responseTime || 0,
      status: c.status,
    }));

  return (
    <ResponsiveContainer width="100%" height={100}>
      <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: -30 }}>
        <XAxis dataKey="i" hide />
        <YAxis tick={{ fill: "#666", fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, fontSize: 11 }}
          labelStyle={{ color: "#999" }}
          itemStyle={{ color: "#fff" }}
          formatter={(v) => [`${v}ms`, "Response"]}
        />
        <Bar dataKey="ms" radius={[2, 2, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.status === "HEALTHY" ? "#22c55e" : d.status === "TIMEOUT" ? "#f59e0b" : "#ef4444"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: project, isLoading, refetch } = useProject(id);
  const { mutate: retry, isPending: isRetrying } = useRetryProject();
  const { status: liveStatus, subStep: liveSubStep } = useRealTimeStatus(id);
  const { data: liveBuild } = useLiveBuild(id);
  const updateLiveStatus = useProjectStore((s) => s.updateLiveStatus);
  const [activeTab, setActiveTab] = useState<"overview" | "pipeline" | "infra" | "health" | "deployments">("overview");

  if (liveStatus && project) {
    updateLiveStatus(id, liveStatus.status as ProjectStatus, liveStatus.message);
  }

  const effectiveStatus = (liveStatus?.status as ProjectStatus) || project?.status;
  const effectiveMessage = liveStatus?.message || project?.statusMessage;

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <div className="skeleton h-8 w-64" />
        <div className="skeleton h-4 w-48" />
        <div className="grid grid-cols-3 gap-4 mt-8">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-32 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-2">Project not found</p>
        <Link href="/projects" className="text-amber-400 text-sm mt-2 inline-block">Back to projects</Link>
      </div>
    );
  }

  const tabs = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "pipeline", label: "Pipeline", icon: GitBranch },
    { id: "infra", label: "Infrastructure", icon: Server },
    { id: "health", label: "Health", icon: BarChart3 },
    { id: "deployments", label: "Deployments", icon: GitCommit },
  ] as const;

  const isFrontend = ["react", "vue", "nextjs"].includes(project.framework);

  return (
    <div className="min-h-screen bg-surface">
      <Header
        title={project.displayName}
        description={project.description || `${project.language} · ${project.framework}${!isFrontend ? ` · ${project.database}` : ""}`}
        actions={
          <div className="flex items-center gap-2">
            {(() => {
              const isProvisioning = ["INITIALIZING","SCAFFOLDING","CREATING_REPO","PROVISIONING","CONFIGURING","PIPELINE_READY","DEPLOYING"].includes(effectiveStatus || "");
              return (
                <Button variant="outline" size="sm" onClick={() => retry(id, { onSuccess: () => refetch() })} disabled={isRetrying || isProvisioning}>
                  <RotateCcw className={`h-3.5 w-3.5 ${isRetrying ? "animate-spin" : ""}`} />
                  {isRetrying ? "Re-running..." : "Re-run Pipeline"}
                </Button>
              );
            })()}
            {project.webUrl && (
              <a href={project.webUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open Web
                </Button>
              </a>
            )}
            {project.liveUrl && (
              <a href={project.liveUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm">
                  <ExternalLink className="h-3.5 w-3.5" />
                  {project.webUrl ? "Open API" : "Open App"}
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
        <Link href="/projects" className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground w-fit">
          <ArrowLeft className="h-3.5 w-3.5" />
          All projects
        </Link>

        {/* Status bar */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-surface">
          <StatusBadge status={effectiveStatus || project.status} message={effectiveMessage} />
          <div className="flex items-center gap-6 text-xs text-muted">
            {project.liveUrl && (
              <a href={project.liveUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300">
                <Globe className="h-3.5 w-3.5" />
                {project.webUrl ? "API" : project.liveUrl}
              </a>
            )}
            {project.webUrl && (
              <a href={project.webUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300">
                <Globe className="h-3.5 w-3.5" />
                Web
              </a>
            )}
            {project.githubRepoUrl && (
              <a href={project.githubRepoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-foreground">
                <Github className="h-3.5 w-3.5" />
                {project.githubRepoFullName}
              </a>
            )}
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {formatDate(project.createdAt)}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border">
          {tabs.map(({ id: tabId, label, icon: Icon }) => (
            <button
              key={tabId}
              onClick={() => setActiveTab(tabId)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tabId
                  ? "border-amber-500 text-amber-400"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-3 gap-4">
            {/* Tech stack */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Tech Stack</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { label: "Language", value: project.language },
                  { label: "Framework", value: project.framework },
                  ...(!isFrontend ? [
                    { label: "Database", value: project.database },
                    { label: "ORM", value: project.orm },
                  ] : []),
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between py-1 border-b border-border last:border-0">
                    <span className="text-xs text-muted">{label}</span>
                    <span className="text-xs font-mono text-foreground capitalize">{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Repository */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Repository</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {project.githubRepoUrl ? (
                  <>
                    <a href={project.githubRepoUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 p-3 rounded-lg bg-surface-3 hover:bg-surface-3 transition-colors">
                      <Github className="h-4 w-4 text-white shrink-0" />
                      <span className="text-xs font-mono text-amber-400 truncate">{project.githubRepoFullName}</span>
                    </a>
                    <div className="text-xs text-muted space-y-1">
                      <p className="flex justify-between"><span>Branch</span><span className="text-foreground font-mono">{project.pipeline?.branch || "main"}</span></p>
                      <p className="flex justify-between"><span>Visibility</span><span className="text-foreground capitalize">{project.repoVisibility || "private"}</span></p>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted">Repository not yet created</p>
                )}
              </CardContent>
            </Card>

            {/* Metadata */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { label: "Project ID", value: project.id.slice(0, 16) + "..." },
                  { label: "Slug", value: project.name },
                  { label: "Namespace", value: project.namespace || "—" },
                  { label: "Port", value: project.internalPort?.toString() || "3000" },
                  { label: "Created", value: formatDate(project.createdAt) },
                  { label: "Updated", value: formatDate(project.updatedAt) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between py-1 border-b border-border last:border-0">
                    <span className="text-xs text-muted">{label}</span>
                    <span className="text-xs font-mono text-foreground truncate max-w-[140px]">{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "pipeline" && (
          <div className="grid grid-cols-2 gap-6">
            {/* Stage stepper */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Provisioning Stages</CardTitle>
              </CardHeader>
              <CardContent>
                <PipelineStepper current={effectiveStatus || project.status} activeSubStep={liveSubStep} />
              </CardContent>
            </Card>

            {/* Jenkins CI/CD */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">CI/CD Pipeline</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {project.pipeline ? (
                    <>
                      <div className="p-3 bg-surface-3 rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-2">Job Name</span>
                          <span className="text-xs font-mono text-foreground">{project.pipeline.jenkinsJobName}</span>
                        </div>
                        {project.pipeline.lastBuildNumber && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-2">Last Build</span>
                            <span className={`text-xs font-semibold ${project.pipeline.lastBuildStatus === "SUCCESS" ? "text-emerald-400" : "text-red-400"}`}>
                              #{project.pipeline.lastBuildNumber} — {project.pipeline.lastBuildStatus}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Real stage data from Jenkins wfapi — falls back to nothing if no build yet */}
                      {liveBuild?.stages && liveBuild.stages.length > 0 ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-muted font-medium">Build Stages</p>
                            {liveBuild.building && (
                              <span className="text-xs text-amber-400 animate-pulse">● Running</span>
                            )}
                          </div>
                          {liveBuild.stages.map((stage, i) => (
                            <div key={stage.id} className="flex items-center gap-2">
                              <div className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold shrink-0 ${
                                stage.status === "SUCCESS" ? "bg-emerald-600/20 text-emerald-400" :
                                stage.status === "FAILED" ? "bg-red-600/20 text-red-400" :
                                stage.status === "IN_PROGRESS" ? "bg-amber-600/20 text-amber-400" :
                                "bg-surface-3 text-muted"
                              }`}>{i + 1}</div>
                              <span className="text-xs text-muted-2 flex-1">{stage.name}</span>
                              <span className="text-xs text-muted font-mono">
                                {stage.durationMillis > 0 ? `${(stage.durationMillis / 1000).toFixed(1)}s` : ""}
                              </span>
                              {stage.status === "SUCCESS" && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                              {stage.status === "FAILED" && <AlertCircle className="h-3 w-3 text-red-400" />}
                              {stage.status === "IN_PROGRESS" && <Clock className="h-3 w-3 text-amber-400 animate-spin" style={{ animationDuration: "3s" }} />}
                            </div>
                          ))}
                        </div>
                      ) : project.pipeline?.lastBuildNumber ? (
                        <p className="text-xs text-muted">Stage data unavailable — check Jenkins directly</p>
                      ) : null}

                      {project.pipeline.jenkinsJobUrl && (
                        <a href={project.pipeline.jenkinsJobUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm" className="w-full">
                            <Terminal className="h-3.5 w-3.5" />
                            Open Jenkins
                          </Button>
                        </a>
                      )}
                    </>
                  ) : (
                    <div className="py-8 text-center">
                      <GitBranch className="h-8 w-8 text-muted mx-auto mb-2" />
                      <p className="text-xs text-muted">Pipeline not yet created</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Trigger Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="flex justify-between text-muted-2">
                    <span>SCM Polling</span>
                    <span className="text-emerald-400 font-mono">* * * * *</span>
                  </div>
                  <div className="flex justify-between text-muted-2">
                    <span>Trigger</span>
                    <span className="text-foreground">On git push to main</span>
                  </div>
                  <div className="flex justify-between text-muted-2">
                    <span>Registry</span>
                    <span className="text-foreground font-mono">k3d-duckops-registry:5111</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === "infra" && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Infrastructure Topology</CardTitle>
              </CardHeader>
              <CardContent>
                <InfraFlowDiagram project={project} />
              </CardContent>
            </Card>

            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Kubernetes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  {[
                    { label: "Cluster", value: "k3d-duckops" },
                    { label: "Namespace", value: project.namespace || "—" },
                    { label: "Deployment", value: project.name },
                    { label: "Service", value: project.name },
                    { label: "Ingress", value: `${project.name}.localhost` },
                    { label: "Port", value: project.internalPort?.toString() || "3000" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between border-b border-border pb-1 last:border-0">
                      <span className="text-muted">{label}</span>
                      <span className="text-foreground font-mono">{value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Docker</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  {[
                    { label: "Image", value: `${project.name}:latest` },
                    { label: "Registry", value: "localhost:5111" },
                    { label: "K8s Pull", value: "k3d-duckops-registry:5111" },
                    { label: "Base", value: "node:22-alpine" },
                    { label: "Build", value: "Multi-stage" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between border-b border-border pb-1 last:border-0">
                      <span className="text-muted">{label}</span>
                      <span className="text-foreground font-mono truncate max-w-[120px]">{value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Access</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  {project.liveUrl ? (
                    <div className="space-y-2">
                      <a href={project.liveUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-600/10 border border-emerald-500/20 hover:bg-emerald-600/15 transition-colors">
                        <Globe className="h-4 w-4 text-emerald-400 shrink-0" />
                        <div className="min-w-0">
                          {project.webUrl && <p className="text-[10px] text-muted uppercase tracking-wide mb-0.5">API</p>}
                          <span className="text-emerald-400 font-mono truncate text-xs">{project.liveUrl}</span>
                        </div>
                      </a>
                      {project.webUrl && (
                        <a href={project.webUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-600/10 border border-blue-500/20 hover:bg-blue-600/15 transition-colors">
                          <Globe className="h-4 w-4 text-blue-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[10px] text-muted uppercase tracking-wide mb-0.5">Web</p>
                            <span className="text-blue-400 font-mono truncate text-xs">{project.webUrl}</span>
                          </div>
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted">Not yet accessible</p>
                  )}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-muted-2">
                      <span>Ingress</span>
                      <span className="text-foreground">Traefik</span>
                    </div>
                    <div className="flex justify-between text-muted-2">
                      <span>Gateway Port</span>
                      <span className="text-foreground font-mono">:8080</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === "health" && (
          <div className="space-y-4">
            {project.healthChecks && project.healthChecks.length > 0 ? (
              <>
                {/* Summary */}
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label: "Total Checks", value: project.healthChecks.length, color: "text-foreground" },
                    { label: "Healthy", value: project.healthChecks.filter(c => c.status === "HEALTHY").length, color: "text-emerald-400" },
                    { label: "Timeouts", value: project.healthChecks.filter(c => c.status === "TIMEOUT").length, color: "text-amber-400" },
                    { label: "Failed", value: project.healthChecks.filter(c => c.status === "UNHEALTHY").length, color: "text-red-400" },
                  ].map(({ label, value, color }) => (
                    <Card key={label}>
                      <CardContent className="p-4 text-center">
                        <p className="text-xs text-muted">{label}</p>
                        <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Response Time (last 20 checks)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <HealthChart checks={project.healthChecks} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Recent Health Checks</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {project.healthChecks.slice(0, 15).map((check) => (
                        <div key={check.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                          <div className="flex items-center gap-2.5">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${
                              check.status === "HEALTHY" ? "bg-emerald-500" : check.status === "TIMEOUT" ? "bg-amber-500" : "bg-red-500"
                            }`} />
                            <span className="text-xs text-foreground capitalize">{check.status.toLowerCase()}</span>
                            {check.message && <span className="text-xs text-muted">— {check.message}</span>}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted">
                            {check.responseTime && <span className="font-mono">{check.responseTime}ms</span>}
                            <span>{formatDate(check.checkedAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-16 text-center">
                  <Activity className="h-10 w-10 text-muted mx-auto mb-3" />
                  <p className="text-muted-2 font-medium">No health checks yet</p>
                  <p className="text-xs text-muted mt-1">Health checks run every 30 seconds once the project is running</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activeTab === "deployments" && (
          <div className="space-y-4">
            {project.deployments && project.deployments.length > 0 ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Deployment History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {project.deployments.map((dep, i) => (
                      <div key={dep.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-3 border border-border-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${
                            dep.status === "SUCCESS" ? "bg-emerald-500" : dep.status === "FAILED" ? "bg-red-500" : "bg-amber-500"
                          }`} />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                                dep.status === "SUCCESS" ? "bg-emerald-500/10 text-emerald-400" :
                                dep.status === "FAILED" ? "bg-red-500/10 text-red-400" :
                                "bg-amber-500/10 text-amber-400"
                              }`}>{dep.status}</span>
                              {dep.imageTag && <span className="text-xs font-mono text-muted-2">{dep.imageTag}</span>}
                              {i === 0 && <span className="text-xs bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded">latest</span>}
                            </div>
                          </div>
                        </div>
                        <span className="text-xs text-muted">{formatDate(dep.startedAt)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-16 text-center">
                  <GitCommit className="h-10 w-10 text-muted mx-auto mb-3" />
                  <p className="text-muted-2 font-medium">No deployments yet</p>
                  <p className="text-xs text-muted mt-1">Deployments appear after the Jenkins pipeline runs</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
