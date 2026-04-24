"use client";

import { use, useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  ExternalLink,
  RefreshCw,
  ArrowLeft,
  AlertCircle,
  Github,
  X,
  RotateCcw,
  CheckCircle2,
  Circle,
  Clock,
  GitCommit,
  Server,
  Package,
  GitBranch,
  Zap,
  Activity,
  Terminal,
  Globe,
  Database,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Bot,
  Send,
  Loader2,
  FileCode,
  ScrollText,
  Plus,
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
import { AI_BASE, healthApi, pipelineApi } from "@/lib/api";
import type { ProjectStatus } from "@duckops/shared-types";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import ReactFlow, {
  type Node,
  type Edge,
  Background,
  BackgroundVariant,
} from "reactflow";
import "reactflow/dist/style.css";

// ─── Pipeline stages ──────────────────────────────────────────────────────────

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
    subSteps: [
      "Register project in database",
      "Allocate project ID",
      "Set up socket channel",
    ],
  },
  {
    status: "SCAFFOLDING",
    label: "Scaffold",
    icon: Package,
    subSteps: [
      "Render Handlebars templates",
      "Generate app source code",
      "Write Dockerfile",
      "Write K8s manifests",
      "Write Jenkinsfile",
    ],
  },
  {
    status: "CREATING_REPO",
    label: "Repository",
    icon: Github,
    subSteps: [
      "Create GitHub repository",
      "Initialize git locally",
      "Add remote origin",
      "Initial commit",
      "Push to main",
    ],
  },
  {
    status: "PROVISIONING",
    label: "Provision",
    icon: Server,
    subSteps: [
      "Build Docker image",
      "Push image to registry",
      "Run Terraform init",
      "Create K8s namespace",
      "Apply ConfigMap",
    ],
  },
  {
    status: "CONFIGURING",
    label: "Configure",
    icon: Database,
    subSteps: [
      "Run Ansible playbook",
      "Apply Deployment manifest",
      "Apply Service manifest",
      "Configure Traefik ingress",
      "Wait for pod rollout",
    ],
  },
  {
    status: "PIPELINE_READY",
    label: "Pipeline",
    icon: GitBranch,
    subSteps: [
      "Store GitHub credentials in Jenkins",
      "Generate Jenkinsfile pipeline XML",
      "Create Jenkins job",
      "Configure SCM polling",
    ],
  },
  {
    status: "DEPLOYING",
    label: "Deploy",
    icon: Zap,
    subSteps: [
      "Trigger initial build",
      "Run npm install",
      "Run tests",
      "Build Docker image",
      "Push to registry",
      "kubectl set image",
    ],
  },
  {
    status: "RUNNING",
    label: "Running",
    icon: CheckCircle2,
    subSteps: [
      "App live at ingress URL",
      "Health checks every 30s",
      "SCM polling active (1 min)",
    ],
  },
];

const STATUS_ORDER = PIPELINE_STAGES.map((s) => s.status);
function getStageIndex(status: ProjectStatus): number {
  if (status === "RUNNING" || status === "DEGRADED")
    return STATUS_ORDER.length - 1;
  const i = STATUS_ORDER.indexOf(status);
  return i >= 0 ? i : -1;
}

// ─── Pipeline Stepper ────────────────────────────────────────────────────────

function PipelineStepper({
  current,
  activeSubStep,
}: {
  current: ProjectStatus;
  activeSubStep?: string | null;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const currentIdx = getStageIndex(current);

  if (current === "FAILED") {
    return (
      <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
        <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
        <span className="text-sm text-red-400 font-medium">
          Provisioning failed — check logs and retry
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {PIPELINE_STAGES.map((stage, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        const Icon = stage.icon;
        const isOpen = expanded === i;
        return (
          <div key={stage.status} className="rounded-lg overflow-hidden">
            <button
              onClick={() => setExpanded(isOpen ? null : i)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all ${
                active
                  ? "bg-amber-500/10 border border-amber-500/20"
                  : done
                    ? "bg-emerald-500/5 border border-emerald-500/10"
                    : "border border-transparent hover:bg-surface-3"
              } rounded-lg`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                  done
                    ? "bg-emerald-600"
                    : active
                      ? "bg-amber-500 ring-2 ring-amber-500/30"
                      : "bg-surface-3 border border-border"
                }`}
              >
                {done ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                ) : active ? (
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                ) : (
                  <Icon className="h-3 w-3 text-muted" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${done ? "text-emerald-500" : active ? "text-amber-500" : "text-muted"}`}
                >
                  {stage.label}
                </p>
                {active && (
                  <p className="text-xs text-muted mt-0.5">
                    {activeSubStep || getStatusLabel(current)}...
                  </p>
                )}
              </div>
              {active && (
                <Clock
                  className="h-3.5 w-3.5 text-amber-500 animate-spin"
                  style={{ animationDuration: "3s" }}
                />
              )}
              {(done || !active) &&
                (isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted" />
                ))}
            </button>
            {isOpen && (
              <div className="ml-9 mt-1 mb-2 space-y-1 border-l border-border pl-4">
                {stage.subSteps.map((step, j) => {
                  const isActiveSub =
                    active && activeSubStep
                      ? step.toLowerCase().includes(activeSubStep.toLowerCase())
                      : active && j === 0;
                  return (
                    <div key={j} className="flex items-center gap-2 py-1">
                      <div
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${done ? "bg-emerald-500" : isActiveSub ? "bg-amber-500 animate-pulse" : "bg-border-2"}`}
                      />
                      <span
                        className={`text-xs ${done ? "text-muted" : isActiveSub ? "text-foreground" : "text-muted"}`}
                      >
                        {step}
                      </span>
                      {done && (
                        <CheckCircle2 className="h-3 w-3 text-emerald-500/60 ml-auto" />
                      )}
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

// ─── Live Console ─────────────────────────────────────────────────────────────

function LogConsole({
  lines,
  title,
  loading,
  onRefresh,
}: {
  lines: string[];
  title: string;
  loading?: boolean;
  onRefresh?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div className="terminal-window flex flex-col min-h-[260px] max-h-[460px]">
      <div className="terminal-bar flex-shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="terminal-dot bg-red-500" />
          <div className="terminal-dot bg-yellow-500" />
          <div className="terminal-dot bg-green-500" />
          <span className="ml-2 text-xs text-muted">{title}</span>
          {loading && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse ml-1" />
          )}
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="text-muted hover:text-foreground transition-colors mr-1"
            title="Refresh"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        )}
      </div>
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-4 font-mono text-xs space-y-0.5"
      >
        {lines.length === 0 ? (
          <p className="text-muted italic">
            {loading ? "Loading..." : "No output yet"}
          </p>
        ) : (
          lines.map((line, i) => {
            const isErr = /\berror\b|\bfail\b|\bexception\b/i.test(line);
            const isOk = /\bsuccess\b|\bpassed\b|\bdone\b|\bcomplete\b/i.test(
              line,
            );
            const isWarn = /\bwarn\b|\bwarning\b/i.test(line);
            return (
              <div
                key={i}
                className={`leading-5 whitespace-pre-wrap break-all ${
                  isErr
                    ? "text-red-500"
                    : isOk
                      ? "text-emerald-500"
                      : isWarn
                        ? "text-amber-500"
                        : "text-muted-2"
                }`}
              >
                {line}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Logs Tab ─────────────────────────────────────────────────────────────────

function LogsTab({
  project,
  liveBuild,
}: {
  project: { id: string; status: string };
  liveBuild: import("@/lib/api").LiveBuildInfo | null | undefined;
}) {
  const [activeLog, setActiveLog] = useState<"jenkins" | "pod">("jenkins");
  const [podLines, setPodLines] = useState<string[]>([]);
  const [podLoading, setPodLoading] = useState(false);
  const [podLineCount, setPodLineCount] = useState(500);

  const fetchPodLogs = async (lines = podLineCount) => {
    setPodLoading(true);
    try {
      const data = await healthApi.getLogs(project.id, lines);
      const raw = typeof data.logs === "string" ? data.logs : "";
      const parsed = raw.split("\n").filter(Boolean);
      setPodLines(parsed.length > 0 ? parsed : ["(no output — pod may not have logged anything yet)"]);
    } catch (err: any) {
      const msg = err?.message || "";
      setPodLines([
        msg.includes("403") || msg.includes("Forbidden")
          ? "Access denied — you don't own this project."
          : msg.includes("404") || msg.includes("Not Found")
            ? "Project not found in health service."
            : `Error fetching pod logs: ${msg || "unknown error"}`,
      ]);
    } finally {
      setPodLoading(false);
    }
  };

  const loadAll = () => {
    setPodLineCount(500);
    fetchPodLogs(500);
  };

  useEffect(() => {
    if (activeLog === "pod") fetchPodLogs();
  }, [activeLog]);

  const jenkinsLines = liveBuild?.consoleLines || [];

  return (
    <div className="space-y-4">
      {/* Log type selector */}
      <div className="flex items-center gap-1 p-1 bg-surface-2 border border-border rounded-lg w-fit">
        {(["jenkins", "pod"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveLog(t)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeLog === t
                ? "bg-surface-4 text-foreground shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t === "jenkins" ? "Jenkins Build" : "Pod Logs"}
          </button>
        ))}
        {liveBuild?.building && activeLog === "jenkins" && (
          <span className="text-[10px] text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-md ml-1">
            Building #{liveBuild.number}
          </span>
        )}
        {activeLog === "pod" && (
          <button
            onClick={loadAll}
            disabled={podLoading}
            className="ml-1 px-3 py-1.5 rounded-md text-xs font-medium text-muted hover:text-foreground hover:bg-surface-3 transition-all"
          >
            show all
          </button>
        )}
      </div>

      {/* Jenkins logs */}
      {activeLog === "jenkins" && (
        <div className="space-y-3">
          <LogConsole
            lines={jenkinsLines}
            title="Jenkins Console Output"
            loading={liveBuild?.building}
          />
          {liveBuild?.stages && liveBuild.stages.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Build Stages</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 flex-wrap">
                  {liveBuild.stages.map((stage, i) => (
                    <div key={stage.id} className="flex items-center gap-2">
                      {i > 0 && <ChevronRight className="h-3 w-3 text-muted" />}
                      <div
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border ${
                          stage.status === "SUCCESS"
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
                            : stage.status === "FAILED"
                              ? "bg-red-500/10 border-red-500/20 text-red-500"
                              : stage.status === "IN_PROGRESS"
                                ? "bg-amber-500/10 border-amber-500/20 text-amber-500"
                                : "bg-surface-3 border-border text-muted"
                        }`}
                      >
                        {stage.status === "IN_PROGRESS" && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        )}
                        {stage.status === "SUCCESS" && (
                          <CheckCircle2 className="h-3 w-3" />
                        )}
                        {stage.status === "FAILED" && (
                          <AlertCircle className="h-3 w-3" />
                        )}
                        <span>{stage.name}</span>
                        {stage.durationMillis > 0 && (
                          <span className="opacity-60 font-mono">
                            {(stage.durationMillis / 1000).toFixed(1)}s
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Pod logs */}
      {activeLog === "pod" && (
        <div className="space-y-3">
          <LogConsole
            lines={podLines}
            title={`kubectl logs — ${project.id.slice(0, 8)} (last ${podLineCount} lines)`}
            loading={podLoading}
            onRefresh={() => fetchPodLogs()}
          />
          {podLines.length > 0 && !podLoading && (
            <p className="text-[11px] text-muted px-1">
              {podLines.length} line{podLines.length !== 1 ? "s" : ""} · logs include timestamps ·{" "}
              <button onClick={loadAll} className="text-amber-500 hover:underline">fetch 500 lines</button>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── AI Builder ───────────────────────────────────────────────────────────────

import {
  AiStreamParser,
  parseAiResponse,
  StepType,
  type AiStep,
} from "@/lib/aiStreamParser";
import { aiApi } from "@/lib/api";

function MdContent({ content }: { content: string }) {
  const [Md, setMd] = useState<React.ComponentType<{
    children: string;
    components: Record<string, unknown>;
  }> | null>(null);
  useEffect(() => {
    import("react-markdown").then((m) =>
      setMd(() => m.default as React.ComponentType<{ children: string; components: Record<string, unknown> }>),
    );
  }, []);
  const cleanContent = (content || "")
    .replace(/<duckops_artifact[^>]*>[\s\S]*?<\/duckops_artifact>/g, "")
    .replace(/<duckops_artifact[^>]*>/g, "") // handle unclosed
    .replace(/<\/duckops_artifact>/g, "")
    .replace(/<duckops_action[^>]*>[\s\S]*?<\/duckops_action>/g, "")
    .replace(/<duckops_action[^>]*>/g, "")
    .replace(/<\/duckops_action>/g, "")
    .trim();

  if (!Md) return <span className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">{cleanContent}</span>;
  return (
    <Md components={{
      p: ({ children }: { children?: React.ReactNode }) => <p className="mb-2 last:mb-0 text-[13px] leading-relaxed text-foreground">{children}</p>,
      h1: ({ children }: { children?: React.ReactNode }) => <h1 className="text-sm font-semibold mb-2 mt-3 first:mt-0 text-foreground">{children}</h1>,
      h2: ({ children }: { children?: React.ReactNode }) => <h2 className="text-xs font-semibold mb-1.5 mt-2 first:mt-0 text-foreground">{children}</h2>,
      h3: ({ children }: { children?: React.ReactNode }) => <h3 className="text-xs font-medium mb-1 mt-2 first:mt-0 text-foreground">{children}</h3>,
      ul: ({ children }: { children?: React.ReactNode }) => <ul className="list-disc list-inside space-y-0.5 mb-2 text-[13px]">{children}</ul>,
      ol: ({ children }: { children?: React.ReactNode }) => <ol className="list-decimal list-inside space-y-0.5 mb-2 text-[13px]">{children}</ol>,
      li: ({ children }: { children?: React.ReactNode }) => <li className="text-[13px] leading-relaxed text-foreground">{children}</li>,
      code: ({ children }: { children?: React.ReactNode }) => <code className="bg-surface-3 text-amber-500 px-1 py-0.5 rounded font-mono text-[11px] border border-border">{children}</code>,
      pre: ({ children }: { children?: React.ReactNode }) => <pre className="bg-[#0d1117] border border-[#30363d] text-[#e6edf3] font-mono text-[11px] p-3 rounded-md overflow-x-auto my-2 whitespace-pre leading-relaxed">{children}</pre>,
      strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold text-foreground">{children}</strong>,
      em: ({ children }: { children?: React.ReactNode }) => <em className="italic text-muted">{children}</em>,
      blockquote: ({ children }: { children?: React.ReactNode }) => <blockquote className="border-l-2 border-border pl-3 text-muted italic my-2">{children}</blockquote>,
      a: ({ children, href }: { children?: React.ReactNode; href?: string }) => <a href={href} className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>,
    }}>{cleanContent}</Md>
  );
}

function AiBuilderTab({ project, liveBuild }: {
  project: { id: string; name: string; framework: string; language: string; githubRepoUrl?: string | null; packageManager: string; orm: string };
  liveBuild: any;
}) {
  const { getAiSession, setAiMessages, setAiSessionId, setAiLoading, setAiActiveFile } = useProjectStore();
  const session = getAiSession(project.id);
  const { messages, sessionId, loading, activeFile, fileContent } = session;

  const [input, setInput] = useState("");
  const [sessions, setSessions] = useState<{ id: string; title: string; createdAt: string }[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Accumulated file code during streaming — keyed by file path, survives across renders
  const fileCodeAccum = useRef<Record<string, string>>({});
  const hasRepo = !!project.githubRepoUrl;

  useEffect(() => {
    const load = async () => {
      try {
        const hist = await aiApi.getSessions(project.id);
        setSessions(hist);
        if (hist.length > 0 && !sessionId) {
          const last = hist[0];
          setAiSessionId(project.id, last.id);
          const msgs = await aiApi.getMessages(project.id, last.id);
          setAiMessages(project.id, () => msgs.map((m: any) => ({
            role: m.role, content: m.content,
            steps: m.role === "assistant" ? parseAiResponse(m.content) : undefined,
          })));
        } else if (messages.length === 0) {
          setAiMessages(project.id, () => [{
            role: "assistant", content: "Ready to help!",
            steps: [{ id: 0, title: "Ready", type: StepType.Markup, status: "completed", code: "Ready to help!" }],
          }]);
        }
      } catch { /* silently skip */ }
    };
    load();
  }, [project.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading || !hasRepo) return;
    const userMsg = input.trim();
    setInput("");
    setAiMessages(project.id, (m) => [...m, { role: "user", content: userMsg }, { role: "assistant", content: "", streaming: true, steps: [] }]);
    setAiLoading(project.id, true);

    // Track the file currently being written so onStepUpdate can always stream to the editor
    // (activeFile from closure would be stale — use a local ref instead)
    const streamingFilePath = { current: null as string | null };

    // Use the parser only to drive the editor pane — chat shows raw streamed text
    const existingPaths = new Set(messages.flatMap((m) => m.steps?.map((s) => s.path).filter(Boolean) as string[]));
    fileCodeAccum.current = {}; // reset for this generation

    const parser = new AiStreamParser(1, existingPaths, {
      onStepStarted: (step) => {
        if (step.path) {
          streamingFilePath.current = step.path;
          fileCodeAccum.current[step.path] = "";
          setAiActiveFile(project.id, step.path, "");
        }
        // Sync steps to UI
        setAiMessages(project.id, (m) => {
          const c = [...m];
          const last = { ...c[c.length - 1] };
          last.steps = [...(last.steps || []), step];
          c[c.length - 1] = last;
          return c;
        });
      },
      onStepUpdate: (id, content) => {
        const path = streamingFilePath.current;
        if (path) {
          fileCodeAccum.current[path] = (fileCodeAccum.current[path] || "") + content;
          setAiActiveFile(project.id, path, fileCodeAccum.current[path]);
        }
        // Sync step content to UI
        setAiMessages(project.id, (m) => {
          const c = [...m];
          const last = { ...c[c.length - 1] };
          const steps = [...(last.steps || [])];
          const stepIdx = steps.findIndex((s) => s.id === id);
          if (stepIdx !== -1) {
            steps[stepIdx] = { ...steps[stepIdx], code: (steps[stepIdx].code || "") + content };
            last.steps = steps;
            c[c.length - 1] = last;
          }
          return c;
        });
      },
      onStepCompleted: (id) => {
        setAiMessages(project.id, (m) => {
          const c = [...m];
          const last = { ...c[c.length - 1] };
          const steps = [...(last.steps || [])];
          const stepIdx = steps.findIndex((s) => s.id === id);
          if (stepIdx !== -1) {
            steps[stepIdx] = { ...steps[stepIdx], status: "completed" };
            last.steps = steps;
            c[c.length - 1] = last;
          }
          return c;
        });
        if (streamingFilePath.current) streamingFilePath.current = null;
      },
    });

    try {
      const res = await fetch(`${AI_BASE}/api/generate/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, prompt: userMsg, sessionId }),
      });
      if (!res.ok || !res.body) {
        let errMsg = "Could not reach AI service. Check that the service is running.";
        if (res.status === 403) {
          let body: any = {};
          try { body = await res.json(); } catch {}
          errMsg = body.error || "Free tier limit reached.";
        } else if (res.status === 429) {
          errMsg = "Too many requests. Please wait a moment and try again.";
        }
        throw Object.assign(new Error(errMsg), { status: res.status });
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });

        // SSE events are delimited by \n\n
        const events = sseBuffer.split("\n\n");
        sseBuffer = events.pop() ?? "";

        for (const event of events) {
          if (!event.trim()) continue;
          let evtType = "message";
          let dataStr = "";
          for (const line of event.split("\n")) {
            if (line.startsWith("event: ")) evtType = line.slice(7).trim();
            else if (line.startsWith("data: ")) dataStr = line.slice(6).trim();
          }
          if (!dataStr) continue;
          try {
            const data = JSON.parse(dataStr);
            if (evtType === "chunk" && data.text) {
              // Feed parser (drives editor only)
              parser.parse(data.text);
              // Append raw text to chat — simple, no intermediate state
              fullContent += data.text;
              const snapshot = fullContent;
              setAiMessages(project.id, (m) => {
                const c = [...m];
                c[c.length - 1] = { ...c[c.length - 1], content: snapshot };
                return c;
              });
            } else if (evtType === "files" && data.files) {
              setAiMessages(project.id, (m) => {
                const c = [...m];
                c[c.length - 1] = { ...c[c.length - 1], files: data.files };
                return c;
              });
            } else if (evtType === "done") {
              if (data.sessionId) setAiSessionId(project.id, data.sessionId);
              if (data.filesChanged?.length) {
                setAiMessages(project.id, (m) => {
                  const c = [...m];
                  c[c.length - 1] = { ...c[c.length - 1], files: data.filesChanged };
                  return c;
                });
              }
            } else if (evtType === "error") {
              const isRateLimit = /limit reached|3 AI prompts/i.test(data.message || "");
              const errorText = isRateLimit
                ? `**AI limit reached.** You've used all your free AI prompts for this window.\n\nFree plan: **3 prompts every 6 hours**. Upgrade to Pro for unlimited access.\n\n[Upgrade to Pro →](/billing)`
                : `**Error:** ${data.message}`;
              setAiMessages(project.id, (m) => {
                const c = [...m];
                const last = c[c.length - 1];
                c[c.length - 1] = { ...last, content: (last.content || "") + `\n\n${errorText}`, streaming: false };
                return c;
              });
            }
          } catch { /* malformed JSON chunk, skip */ }
        }
      }
      parser.finalize();
      setAiMessages(project.id, (m) => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], streaming: false }; return c; });
    } catch (err: any) {
      const isRateLimit = err?.status === 403 || /limit reached|3 AI prompts/i.test(err?.message || "");
      const errContent = isRateLimit
        ? `**AI limit reached.** You've used all your free AI prompts for this window.\n\nFree plan: **3 prompts every 6 hours**. Upgrade to Pro for unlimited access.\n\n[Upgrade to Pro →](/billing)`
        : `**Could not reach AI service.** ${err?.message || "An unexpected error occurred. Please try again."}`;
      setAiMessages(project.id, (m) => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], content: errContent, streaming: false }; return c; });
    } finally {
      setAiLoading(project.id, false);
    }
  };

  const switchSession = async (id: string) => {
    setAiSessionId(project.id, id);
    setAiLoading(project.id, true);
    try {
      const msgs = await aiApi.getMessages(project.id, id);
      setAiMessages(project.id, () => msgs.map((m: any) => ({
        role: m.role, content: m.content,
        steps: m.role === "assistant" ? parseAiResponse(m.content) : undefined,
      })));
    } finally { setAiLoading(project.id, false); }
  };

  return (
    <div className="flex h-[720px] rounded-xl border border-border overflow-hidden bg-surface">

      {/* ── Sessions sidebar ── */}
      <div className="hidden lg:flex flex-col w-52 shrink-0 border-r border-border bg-surface-2">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
          <span className="text-[11px] font-medium text-muted">History</span>
          <button
            onClick={() => { setAiSessionId(project.id, ""); setAiMessages(project.id, () => []); setAiActiveFile(project.id, null, ""); }}
            title="New chat"
            className="p-1 rounded-md hover:bg-surface-3 text-muted hover:text-foreground transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-0.5">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-3 opacity-40">
              <ScrollText className="h-5 w-5" />
              <p className="text-[10px] text-muted">No previous sessions</p>
            </div>
          ) : sessions.map((s) => (
            <button key={s.id} onClick={() => switchSession(s.id)}
              className={`w-full text-left px-2.5 py-2 rounded-md text-[11px] truncate transition-colors ${
                sessionId === s.id ? "bg-surface-3 text-foreground" : "text-muted hover:bg-surface-3 hover:text-foreground"
              }`}>
              {s.title || "Untitled"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Chat panel ── */}
      <div className="flex flex-col w-[440px] shrink-0 border-r border-border">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border bg-surface-2 shrink-0">
          <Bot className="h-4 w-4 text-muted shrink-0" />
          <span className="text-[13px] font-medium text-foreground">DuckOps AI</span>
          <span className="text-[10px] text-muted font-mono ml-0.5">· {project.framework}</span>
          {loading && (
            <div className="ml-auto flex items-center gap-1.5 text-[11px] text-muted">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Working</span>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto p-4 space-y-5">
          {!hasRepo && (
            <div className="px-3 py-2 rounded-md bg-surface-2 border border-border text-[12px] text-muted">
              No repository attached. AI builder requires a deployed project.
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-medium ${
                msg.role === "user" ? "bg-foreground text-surface" : "bg-surface-3 border border-border text-muted transition-colors"
                } ${msg.streaming ? "animate-pulse border-amber-500/50" : ""}`}>
                {msg.role === "user" ? "U" : <Bot className="h-3 w-3" />}
              </div>
              <div className={`flex flex-col gap-3 min-w-0 ${msg.role === "user" ? "items-end max-w-[85%]" : "flex-1"}`}>
                {msg.role === "user" ? (
                  <div className="bg-surface-3 border border-border px-3 py-2 rounded-lg text-[13px] text-foreground leading-relaxed">
                    {msg.content}
                  </div>
                ) : (
                  <div className="space-y-3 w-full">
                    {/* Render steps (Markup or File actions) */}
                    {msg.steps && msg.steps.length > 0 ? (
                      msg.steps.map((step, idx) => (
                        <div key={idx} className="animate-in fade-in slide-in-from-top-1 duration-300">
                          {step.type === StepType.Markup ? (
                            <div className="text-foreground leading-relaxed">
                              <MdContent content={step.code || ""} />
                            </div>
                          ) : (
                            <button
                              onClick={() => step.path && setAiActiveFile(project.id, step.path, step.code || "")}
                              className={`group w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                                activeFile === step.path
                                  ? "bg-amber-500/5 border-amber-500/30 ring-1 ring-amber-500/10"
                                  : "bg-surface-2 border-border hover:border-muted-2"
                              }`}
                            >
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                step.status === "completed" ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                              }`}>
                                {step.status === "in-progress" ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : step.type === StepType.RunScript ? (
                                  <Terminal className="h-4 w-4" />
                                ) : (
                                  <FileCode className="h-4 w-4" />
                                )}
                              </div>
                              <div className="flex-1 text-left min-w-0">
                                <p className="text-[12px] font-medium text-foreground truncate">
                                  {step.title}
                                </p>
                                <p className="text-[10px] text-muted truncate">
                                  {step.status === "completed" ? "Completed" : "Applying changes..."}
                                </p>
                              </div>
                              {step.status === "completed" && (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                              )}
                            </button>
                          )}
                        </div>
                      ))
                    ) : msg.streaming ? (
                      <div className="flex items-center gap-1.5 py-2">
                        {[0, 100, 200].map((d) => (
                          <span key={d} className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                        ))}
                      </div>
                    ) : (
                      <div className="text-foreground leading-relaxed">
                        <MdContent content={msg.content || "No response."} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border p-3 bg-surface-2 shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={hasRepo ? "Describe a change..." : "No repository attached"}
              disabled={!hasRepo || loading}
              rows={3}
              className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-[13px] text-foreground placeholder-muted resize-none focus:outline-none focus:border-border-2 disabled:opacity-40 transition-colors leading-relaxed"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading || !hasRepo}
              className="h-[72px] w-9 shrink-0 rounded-lg bg-foreground text-surface flex items-center justify-center disabled:opacity-30 hover:opacity-80 transition-opacity"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Editor pane ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e]">
        {/* Tab bar */}
        <div className="flex items-center h-[35px] bg-[#252526] border-b border-[#1e1e1e] shrink-0 overflow-hidden">
          {activeFile ? (
            <div className="flex items-center gap-2 px-4 h-full bg-[#1e1e1e] border-r border-[#252526] text-[12px] text-[#cccccc] font-mono shrink-0">
              <FileCode className="h-3.5 w-3.5 text-[#519aba] shrink-0" />
              <span className="truncate max-w-[260px]">{activeFile}</span>
              {loading && <span className="w-1.5 h-1.5 rounded-full bg-[#519aba] animate-pulse ml-1 shrink-0" />}
            </div>
          ) : (
            <div className="px-4 h-full flex items-center text-[12px] text-[#6b6b6b] font-mono">
              no file open
            </div>
          )}
        </div>

        {/* Monaco editor */}
        <div className="flex-1 min-h-0">
          <MonacoEditor activeFile={activeFile ?? null} fileContent={fileContent} loading={loading} />
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between px-3 h-[22px] bg-[#0a0a0a] border-t border-white/5 text-[11px] text-[#cccccc] font-mono shrink-0">

          <div className="flex items-center gap-3">
            {activeFile && <span>Ln {(fileContent || "").split("\n").length}</span>}
            <span>UTF-8</span>
          </div>
          <div className="flex items-center gap-3">
            {liveBuild ? (
              <span className={liveBuild.building ? "text-yellow-200" : liveBuild.result === "SUCCESS" ? "text-green-200" : liveBuild.result ? "text-red-200" : "text-white/60"}>
                {liveBuild.building ? `$(loading~spin) build #${liveBuild.number}` : liveBuild.result ? `#${liveBuild.number} ${liveBuild.result.toLowerCase()}` : "idle"}
              </span>
            ) : null}
            <span>main</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MonacoEditor({ activeFile, fileContent, loading }: { activeFile: string | null; fileContent: string; loading: boolean }) {
  const [Editor, setEditor] = useState<React.ComponentType<any> | null>(null);

  useEffect(() => {
    import("@monaco-editor/react").then((m) => setEditor(() => m.default));
  }, []);

  const ext = activeFile?.split(".").pop() ?? "";
  const language =
    ext === "ts" || ext === "tsx" ? "typescript" :
    ext === "js" || ext === "jsx" ? "javascript" :
    ext === "css" ? "css" :
    ext === "json" ? "json" :
    ext === "html" ? "html" :
    ext === "md" ? "markdown" :
    ext === "prisma" ? "prisma" :
    ext === "yaml" || ext === "yml" ? "yaml" :
    ext === "sh" ? "shell" : "plaintext";

  if (!Editor) {
    return (
      <div className="h-full bg-[#1e1e1e] p-5 font-mono text-[12.5px] leading-[1.6] overflow-auto">
        {fileContent ? (
          <pre className="text-[#d4d4d4] whitespace-pre-wrap break-words">{fileContent}</pre>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-[#6b6b6b]">
            <FileCode className="h-8 w-8 text-[#3c3c3c]" />
            <p className="text-[12px]">Select a file from the chat to open it</p>
          </div>
        )}
      </div>
    );
  }

  if (!activeFile || !fileContent) {
    return (
      <div className="h-full bg-[#1e1e1e] flex flex-col items-center justify-center gap-2 text-[#6b6b6b]">
        <FileCode className="h-8 w-8 text-[#3c3c3c]" />
        <p className="text-[12px]">Select a file from the chat to open it</p>
      </div>
    );
  }

  return (
    <Editor
      height="100%"
      language={language}
      value={fileContent}
      theme="vs-dark"
      options={{
        readOnly: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 12.5,
        lineHeight: 20,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
        fontLigatures: true,
        renderLineHighlight: "none",
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
        lineNumbers: "on",
        lineNumbersMinChars: 3,
        padding: { top: 12, bottom: 12 },
        wordWrap: "on",
      }}
    />
  );
}

// ─── Infra diagram ────────────────────────────────────────────────────────────

function NodeBox({
  icon,
  title,
  sub,
  accent,
  accentBg,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  accent: string;
  accentBg: string;
}) {
  return (
    <div className="text-center py-1 px-0.5" style={{ minWidth: 110 }}>
      <div
        className="w-7 h-7 rounded-lg mx-auto mb-1.5 flex items-center justify-center"
        style={{ background: accentBg, color: accent }}
      >
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

function InfraFlowDiagram({
  project,
}: {
  project: {
    name: string;
    namespace?: string | null;
    liveUrl?: string | null;
    database: string;
    status: string;
  };
}) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const nodes: Node[] = [
    {
      id: "github",
      position: { x: 0, y: 80 },
      data: {
        label: (
          <NodeBox
            icon={<Github className="h-4 w-4" />}
            title="GitHub"
            sub="Source repo"
            accent="#e5e7eb"
            accentBg="#1a1a1a"
          />
        ),
        description:
          "Source code repository. DuckOps manages repos, webhooks, and syncs code with Jenkins.",
        type: "Source Control",
      },
      style: nodeStyle("#111", "#2a2a2a"),
    },
    {
      id: "jenkins",
      position: { x: 280, y: 80 },
      data: {
        label: (
          <NodeBox
            icon={<GitBranch className="h-4 w-4" />}
            title="Jenkins"
            sub="CI/CD engine"
            accent="#f59e0b"
            accentBg="#1f1200"
          />
        ),
        description:
          "CI/CD server — polls GitHub, builds Docker images, runs tests, triggers deployments.",
        type: "CI/CD Pipeline",
      },
      style: nodeStyle("#111", "#2a2a2a"),
    },
    {
      id: "registry",
      position: { x: 560, y: 80 },
      data: {
        label: (
          <NodeBox
            icon={<Package className="h-4 w-4" />}
            title="Registry"
            sub="k3d:5111"
            accent="#a78bfa"
            accentBg="#1a1a1a"
          />
        ),
        description:
          "Local Docker registry. Images built by Jenkins are stored here before K8s pulls them.",
        type: "Artifact Registry",
      },
      style: nodeStyle("#111", "#2a2a2a"),
    },
    {
      id: "k8s",
      position: { x: 840, y: 80 },
      data: {
        label: (
          <NodeBox
            icon={<Server className="h-4 w-4" />}
            title="Kubernetes"
            sub={project.namespace || "k3d cluster"}
            accent="#60a5fa"
            accentBg="#1a1a1a"
          />
        ),
        description:
          "Container orchestration. Manages Namespaces, Deployments, Services, Ingress.",
        type: "Orchestration",
      },
      style: nodeStyle("#111", "#2a2a2a"),
    },
    {
      id: "pod",
      position: { x: 700, y: 280 },
      data: {
        label: (
          <NodeBox
            icon={<Activity className="h-4 w-4" />}
            title={project.name}
            sub={`Pod · ${project.status === "RUNNING" ? "Running" : project.status === "DEGRADED" ? "Degraded" : "Pending"}`}
            accent={
              project.status === "RUNNING"
                ? "#60a5fa"
                : project.status === "DEGRADED"
                  ? "#f59e0b"
                  : "#9ca3af"
            }
            accentBg="#1a1a1a"
          />
        ),
        description:
          "Running application container. Monitored by DuckOps health service.",
        type: "Application Container",
      },
      style: nodeStyle("#111", "#2a2a2a"),
    },
    {
      id: "traefik",
      position: { x: 420, y: 280 },
      data: {
        label: (
          <NodeBox
            icon={<Globe className="h-4 w-4" />}
            title="Traefik"
            sub="Ingress :8080"
            accent="#34d399"
            accentBg="#1a1a1a"
          />
        ),
        description:
          "HTTP reverse proxy routing traffic on port 8080 to the correct K8s service.",
        type: "Ingress Controller",
      },
      style: nodeStyle("#111", "#2a2a2a"),
    },
  ];
  const edges: Edge[] = [
    {
      id: "e1",
      source: "github",
      target: "jenkins",
      label: "push",
      style: { stroke: "#d97706", strokeWidth: 1.5 },
      animated: true,
    },
    {
      id: "e2",
      source: "jenkins",
      target: "registry",
      label: "build & push",
      style: { stroke: "#7c3aed", strokeWidth: 1.5 },
      animated: true,
    },
    {
      id: "e3",
      source: "registry",
      target: "k8s",
      label: "pull image",
      style: { stroke: "#3b82f6", strokeWidth: 1.5 },
    },
    {
      id: "e4",
      source: "k8s",
      target: "pod",
      label: "schedule",
      style: { stroke: "#3b82f6", strokeWidth: 1.5 },
      animated: true,
    },
    {
      id: "e5",
      source: "traefik",
      target: "pod",
      label: ":80",
      style: { stroke: "#10b981", strokeWidth: 1.5 },
    },
  ];
  const selectedNodeData = selectedNode
    ? nodes.find((n) => n.id === selectedNode)?.data
    : null;

  return (
    <div className="space-y-3">
      <div className="h-[320px] rounded-xl overflow-hidden bg-surface border border-border relative group">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          onNodeClick={(_, node) => setSelectedNode(node.id)}
          nodesDraggable={false}
          nodesConnectable={false}
          zoomOnScroll={false}
          panOnDrag={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1}
            color="#1a1a1a"
          />
        </ReactFlow>
        {selectedNodeData && (
          <div className="absolute top-4 right-4 w-64 bg-surface-2/95 backdrop-blur-sm border border-border rounded-xl p-4 shadow-xl z-50">
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">
                  {selectedNodeData.type}
                </span>
                <h4 className="text-sm font-bold text-foreground">
                  {selectedNodeData.label.props.title}
                </h4>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedNode(null);
                }}
                className="text-muted hover:text-foreground p-1 rounded-md hover:bg-surface-3 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-muted leading-relaxed">
              {selectedNodeData.description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Health chart ─────────────────────────────────────────────────────────────

function HealthChart({
  checks,
}: {
  checks: { status: string; responseTime?: number | null; checkedAt: string }[];
}) {
  const data = checks
    .slice(0, 20)
    .reverse()
    .map((c, i) => ({ i, ms: c.responseTime || 0, status: c.status }));
  return (
    <ResponsiveContainer width="100%" height={100}>
      <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: -30 }}>
        <XAxis dataKey="i" hide />
        <YAxis
          tick={{ fill: "var(--color-muted)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
            borderRadius: 8,
            fontSize: 11,
          }}
          labelStyle={{ color: "var(--color-muted)" }}
          itemStyle={{ color: "var(--color-foreground)" }}
          formatter={(v) => [`${v}ms`, "Response"]}
        />
        <Bar dataKey="ms" radius={[2, 2, 0, 0]}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={
                d.status === "HEALTHY"
                  ? "#22c55e"
                  : d.status === "TIMEOUT"
                    ? "#f59e0b"
                    : "#ef4444"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: project, isLoading, refetch } = useProject(id);
  const { mutate: retry, isPending: isRetrying } = useRetryProject();
  const { status: liveStatus, subStep: liveSubStep } = useRealTimeStatus(id);
  const { data: liveBuild } = useLiveBuild(id);
  const updateLiveStatus = useProjectStore((s) => s.updateLiveStatus);
  const [activeTab, setActiveTab] = useState<
    "overview" | "pipeline" | "logs" | "ai" | "infra" | "health" | "deployments"
  >("overview");

  useEffect(() => {
    if (liveStatus && project) {
      updateLiveStatus(
        id,
        liveStatus.status as ProjectStatus,
        liveStatus.message,
      );
    }
  }, [id, liveStatus, project, updateLiveStatus]);

  const effectiveStatus =
    (liveStatus?.status as ProjectStatus) || project?.status;
  const effectiveMessage = liveStatus?.message || project?.statusMessage;

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <div className="skeleton h-8 w-64" />
        <div className="skeleton h-4 w-48" />
        <div className="grid grid-cols-3 gap-4 mt-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted">Project not found</p>
        <Link
          href="/projects"
          className="text-amber-500 text-sm mt-2 inline-block"
        >
          Back to projects
        </Link>
      </div>
    );
  }

  const tabs = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "pipeline", label: "Pipeline", icon: GitBranch },
    { id: "logs", label: "Live Logs", icon: Terminal },
    { id: "ai", label: "AI Builder", icon: Bot },
    { id: "infra", label: "Infrastructure", icon: Server },
    { id: "health", label: "Health", icon: BarChart3 },
    { id: "deployments", label: "Deployments", icon: GitCommit },
  ] as const;

  const isFrontend = ["react", "vue", "nextjs"].includes(project.framework);
  const isProvisioning = [
    "INITIALIZING",
    "SCAFFOLDING",
    "CREATING_REPO",
    "PROVISIONING",
    "CONFIGURING",
    "PIPELINE_READY",
    "DEPLOYING",
  ].includes(effectiveStatus || "");

  return (
    <div className="min-h-screen bg-surface">
      <Header
        title={project.displayName}
        description={
          project.description ||
          `${project.language} · ${project.framework}${!isFrontend ? ` · ${project.database}` : ""}`
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => retry(id, { onSuccess: () => refetch() })}
              disabled={isRetrying || isProvisioning}
            >
              <RotateCcw
                className={`h-3.5 w-3.5 ${isRetrying ? "animate-spin" : ""}`}
              />
              {isRetrying ? "Re-running..." : "Re-run Pipeline"}
            </Button>
            {project.webUrl && (
              <a
                href={project.webUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="sm" variant="outline">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open Web
                </Button>
              </a>
            )}
            {project.liveUrl && (
              <a
                href={project.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
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
        <Link
          href="/projects"
          className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground w-fit transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All projects
        </Link>

        {/* Status bar */}
        <div
          data-tour="status-bar"
          className="flex items-center justify-between p-4 rounded-xl border border-border bg-surface-2"
        >
          <StatusBadge
            status={effectiveStatus || project.status}
            message={effectiveMessage}
          />
          <div className="flex items-center gap-6 text-xs text-muted">
            {project.liveUrl && (
              <a
                href={project.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-amber-500 hover:text-amber-400"
              >
                <Globe className="h-3.5 w-3.5" />
                {project.webUrl ? "API" : project.liveUrl}
              </a>
            )}
            {project.webUrl && (
              <a
                href={project.webUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-emerald-500 hover:text-emerald-400"
              >
                <Globe className="h-3.5 w-3.5" />
                Web
              </a>
            )}
            {project.githubRepoUrl && (
              <a
                href={project.githubRepoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:text-foreground"
              >
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
        <div className="flex items-center gap-0.5 border-b border-border overflow-x-auto">
          {tabs.map(({ id: tabId, label, icon: Icon }) => (
            <button
              key={tabId}
              onClick={() => setActiveTab(tabId)}
              data-tour={`tab-${tabId}`}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                activeTab === tabId
                  ? "border-amber-500 text-amber-500"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Overview ── */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Tech Stack</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { label: "Language", value: project.language },
                  { label: "Framework", value: project.framework },
                  ...(!isFrontend
                    ? [
                        { label: "Database", value: project.database },
                        { label: "ORM", value: project.orm },
                      ]
                    : []),
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between py-1 border-b border-border last:border-0"
                  >
                    <span className="text-xs text-muted">{label}</span>
                    <span className="text-xs font-mono text-foreground capitalize">
                      {value}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Repository</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {project.githubRepoUrl ? (
                  <>
                    <a
                      href={project.githubRepoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-3 rounded-lg bg-surface-3 hover:bg-surface-4 transition-colors"
                    >
                      <Github className="h-4 w-4 text-foreground shrink-0" />
                      <span className="text-xs font-mono text-amber-500 truncate">
                        {project.githubRepoFullName}
                      </span>
                    </a>
                    <div className="text-xs text-muted space-y-1">
                      <p className="flex justify-between">
                        <span>Branch</span>
                        <span className="text-foreground font-mono">
                          {project.pipeline?.branch || "main"}
                        </span>
                      </p>
                      <p className="flex justify-between">
                        <span>Visibility</span>
                        <span className="text-foreground capitalize">
                          {project.repoVisibility || "private"}
                        </span>
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted">
                    Repository not yet created
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  {
                    label: "Project ID",
                    value: project.id.slice(0, 16) + "...",
                  },
                  { label: "Slug", value: project.name },
                  { label: "Namespace", value: project.namespace || "—" },
                  {
                    label: "Port",
                    value: project.internalPort?.toString() || "3000",
                  },
                  { label: "Created", value: formatDate(project.createdAt) },
                  { label: "Updated", value: formatDate(project.updatedAt) },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between py-1 border-b border-border last:border-0"
                  >
                    <span className="text-xs text-muted">{label}</span>
                    <span className="text-xs font-mono text-foreground truncate max-w-[140px]">
                      {value}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Pipeline ── */}
        {activeTab === "pipeline" && (
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Provisioning Stages</CardTitle>
              </CardHeader>
              <CardContent>
                <PipelineStepper
                  current={effectiveStatus || project.status}
                  activeSubStep={liveSubStep}
                />
              </CardContent>
            </Card>
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
                          <span className="text-xs text-muted">Job Name</span>
                          <span className="text-xs font-mono text-foreground">
                            {project.pipeline.jenkinsJobName}
                          </span>
                        </div>
                        {project.pipeline.lastBuildNumber && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted">
                              Last Build
                            </span>
                            <span
                              className={`text-xs font-semibold ${project.pipeline.lastBuildStatus === "SUCCESS" ? "text-emerald-400" : "text-red-400"}`}
                            >
                              #{project.pipeline.lastBuildNumber} —{" "}
                              {project.pipeline.lastBuildStatus}
                            </span>
                          </div>
                        )}
                      </div>
                      {liveBuild?.stages && liveBuild.stages.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-muted font-medium">
                              Build Stages
                            </p>
                            {liveBuild.building && (
                              <span className="text-xs text-amber-400 animate-pulse">
                                ● Building
                              </span>
                            )}
                          </div>
                          {liveBuild.stages.map((stage, i) => (
                            <div
                              key={stage.id}
                              className="flex items-center gap-2"
                            >
                              <div
                                className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold shrink-0 ${
                                  stage.status === "SUCCESS"
                                    ? "bg-emerald-600/20 text-emerald-400"
                                    : stage.status === "FAILED"
                                      ? "bg-red-600/20 text-red-400"
                                      : stage.status === "IN_PROGRESS"
                                        ? "bg-amber-600/20 text-amber-400"
                                        : "bg-surface-3 text-muted"
                                }`}
                              >
                                {i + 1}
                              </div>
                              <span className="text-xs text-muted flex-1">
                                {stage.name}
                              </span>
                              <span className="text-xs text-muted-2 font-mono">
                                {stage.durationMillis > 0
                                  ? `${(stage.durationMillis / 1000).toFixed(1)}s`
                                  : ""}
                              </span>
                              {stage.status === "SUCCESS" && (
                                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                              )}
                              {stage.status === "FAILED" && (
                                <AlertCircle className="h-3 w-3 text-red-400" />
                              )}
                              {stage.status === "IN_PROGRESS" && (
                                <Clock
                                  className="h-3 w-3 text-amber-400 animate-spin"
                                  style={{ animationDuration: "3s" }}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {project.pipeline.jenkinsJobUrl && (
                        <a
                          href={project.pipeline.jenkinsJobUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                          >
                            <Terminal className="h-3.5 w-3.5" />
                            Open Jenkins
                          </Button>
                        </a>
                      )}
                    </>
                  ) : (
                    <div className="py-8 text-center">
                      <GitBranch className="h-8 w-8 text-muted-2 mx-auto mb-2" />
                      <p className="text-xs text-muted">
                        Pipeline not yet created
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Trigger Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="flex justify-between text-muted">
                    <span>SCM Polling</span>
                    <span className="text-emerald-400 font-mono">
                      * * * * *
                    </span>
                  </div>
                  <div className="flex justify-between text-muted">
                    <span>Trigger</span>
                    <span className="text-foreground">On git push to main</span>
                  </div>
                  <div className="flex justify-between text-muted">
                    <span>Registry</span>
                    <span className="text-foreground font-mono">
                      k3d-duckops-registry:5111
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ── Logs ── */}
        {activeTab === "logs" && (
          <LogsTab project={project} liveBuild={liveBuild} />
        )}

        {/* ── AI Builder ── */}
        {activeTab === "ai" && (
          <AiBuilderTab
            project={{
              id: project.id,
              name: project.name,
              framework: project.framework,
              language: project.language,
              githubRepoUrl: project.githubRepoUrl,
              packageManager: project.packageManager,
              orm: project.orm,
            }}
            liveBuild={liveBuild}
          />
        )}

        {/* ── Infrastructure ── */}
        {activeTab === "infra" && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">
                  Infrastructure Topology
                </CardTitle>
              </CardHeader>
              <CardContent>
                <InfraFlowDiagram project={project} />
              </CardContent>
            </Card>
            <div className="grid grid-cols-3 gap-4">
              {[
                {
                  title: "Kubernetes",
                  items: [
                    ["Cluster", "k3d-duckops"],
                    ["Namespace", project.namespace || "—"],
                    ["Deployment", project.name],
                    ["Ingress", `${project.name}.localhost`],
                    ["Port", project.internalPort?.toString() || "3000"],
                  ],
                },
                {
                  title: "Docker",
                  items: [
                    ["Image", `${project.name}:latest`],
                    ["Registry", "localhost:5111"],
                    ["K8s Pull", "k3d-duckops-registry:5111"],
                    ["Base", "node:22-alpine"],
                    ["Build", "Multi-stage"],
                  ],
                },
              ].map(({ title, items }) => (
                <Card key={title}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">{title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    {items.map(([label, value]) => (
                      <div
                        key={label}
                        className="flex justify-between border-b border-border pb-1 last:border-0"
                      >
                        <span className="text-muted">{label}</span>
                        <span className="text-foreground font-mono truncate max-w-[120px]">
                          {value}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Access</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  {project.liveUrl ? (
                    <div className="space-y-2">
                      <a
                        href={project.liveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-600/10 border border-emerald-500/20 hover:bg-emerald-600/15 transition-colors"
                      >
                        <Globe className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span className="text-emerald-400 font-mono truncate text-xs">
                          {project.liveUrl}
                        </span>
                      </a>
                      {project.webUrl && (
                        <a
                          href={project.webUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-600/10 border border-blue-500/20 hover:bg-blue-600/15 transition-colors"
                        >
                          <Globe className="h-4 w-4 text-blue-400 shrink-0" />
                          <span className="text-blue-400 font-mono truncate text-xs">
                            {project.webUrl}
                          </span>
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted">Not yet accessible</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ── Health ── */}
        {activeTab === "health" && (
          <div className="space-y-4">
            {project.healthChecks && project.healthChecks.length > 0 ? (
              <>
                <div className="grid grid-cols-4 gap-4">
                  {[
                    {
                      label: "Total Checks",
                      value: project.healthChecks.length,
                      color: "text-foreground",
                    },
                    {
                      label: "Healthy",
                      value: project.healthChecks.filter(
                        (c) => c.status === "HEALTHY",
                      ).length,
                      color: "text-emerald-400",
                    },
                    {
                      label: "Timeouts",
                      value: project.healthChecks.filter(
                        (c) => c.status === "TIMEOUT",
                      ).length,
                      color: "text-amber-400",
                    },
                    {
                      label: "Failed",
                      value: project.healthChecks.filter(
                        (c) => c.status === "UNHEALTHY",
                      ).length,
                      color: "text-red-400",
                    },
                  ].map(({ label, value, color }) => (
                    <Card key={label}>
                      <CardContent className="p-4 text-center">
                        <p className="text-xs text-muted">{label}</p>
                        <p className={`text-2xl font-bold mt-1 ${color}`}>
                          {value}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">
                      Response Time (last 20 checks)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <HealthChart checks={project.healthChecks} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">
                      Recent Health Checks
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {project.healthChecks.slice(0, 15).map((check) => (
                        <div
                          key={check.id}
                          className="flex items-center justify-between py-2 border-b border-border last:border-0"
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${check.status === "HEALTHY" ? "bg-emerald-500" : check.status === "TIMEOUT" ? "bg-amber-500" : "bg-red-500"}`}
                            />
                            <span className="text-xs text-foreground capitalize">
                              {check.status.toLowerCase()}
                            </span>
                            {check.message && (
                              <span className="text-xs text-muted">
                                — {check.message}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted">
                            {check.responseTime && (
                              <span className="font-mono">
                                {check.responseTime}ms
                              </span>
                            )}
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
                  <Activity className="h-10 w-10 text-muted-2 mx-auto mb-3" />
                  <p className="text-muted font-medium">No health checks yet</p>
                  <p className="text-xs text-muted-2 mt-1">
                    Health checks run every 30 seconds once running
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── Deployments ── */}
        {activeTab === "deployments" && (
          <DeploymentsTab project={project} />
        )}
      </div>
    </div>
  );
}

function DeploymentsTab({ project }: { project: any }) {
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (project.id) {
      setSyncing(true);
      pipelineApi.syncDeployments(project.id)
        .catch(() => {})
        .finally(() => setSyncing(false));
    }
  }, [project.id]);

  return (
    <div className="space-y-4">
      {syncing && (
        <div className="flex items-center gap-2 text-xs text-muted">
          <Loader2 className="h-3 w-3 animate-spin" />
          Syncing deployment history from Jenkins...
        </div>
      )}
            {/* Pipeline summary card */}
            {project.pipeline && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  {
                    label: "Jenkins Job",
                    value: project.pipeline.jenkinsJobName,
                    mono: true,
                  },
                  {
                    label: "Branch",
                    value: project.pipeline.branch || "main",
                    mono: true,
                  },
                  {
                    label: "Last Build",
                    value: project.pipeline.lastBuildNumber
                      ? `#${project.pipeline.lastBuildNumber}`
                      : "—",
                    mono: true,
                  },
                  {
                    label: "Last Result",
                    value: project.pipeline.lastBuildStatus || "—",
                    mono: false,
                    color:
                      project.pipeline.lastBuildStatus === "SUCCESS"
                        ? "text-emerald-600"
                        : project.pipeline.lastBuildStatus === "FAILURE"
                          ? "text-red-500"
                          : "text-muted",
                  },
                ].map(({ label, value, mono, color }) => (
                  <div
                    key={label}
                    className="p-3 rounded-xl border border-border bg-surface-2"
                  >
                    <p className="text-[10px] text-muted uppercase tracking-wider mb-1">
                      {label}
                    </p>
                    <p
                      className={`text-sm font-semibold ${color || "text-foreground"} ${mono ? "font-mono" : ""}`}
                    >
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Jenkins link */}
            {project.pipeline?.jenkinsJobUrl && (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface-2">
                <GitBranch className="h-4 w-4 text-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted">Jenkins pipeline</p>
                  <p className="text-sm font-mono text-foreground truncate">
                    {project.pipeline.jenkinsJobUrl}
                  </p>
                </div>
                <a
                  href={project.pipeline.jenkinsJobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open
                  </Button>
                </a>
              </div>
            )}

            {/* Deployment records from DB */}
            {project.deployments && project.deployments.length > 0 ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Deployment Records</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {project.deployments.map((dep: any, i: number) => (
                      <div
                        key={dep.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-surface-3 border border-border"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              dep.status === "SUCCESS"
                                ? "bg-emerald-500"
                                : dep.status === "FAILED"
                                  ? "bg-red-500"
                                  : "bg-amber-500"
                            }`}
                          />
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-xs font-medium px-2 py-0.5 rounded-md border ${
                                  dep.status === "SUCCESS"
                                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
                                    : dep.status === "FAILED"
                                      ? "bg-red-500/10 border-red-500/20 text-red-500"
                                      : "bg-amber-500/10 border-amber-500/20 text-amber-500"
                                }`}
                              >
                                {dep.status}
                              </span>
                              {dep.imageTag && (
                                <span className="text-xs font-mono text-muted">
                                  {dep.imageTag}
                                </span>
                              )}
                              {i === 0 && (
                                <span className="text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded-md">
                                  latest
                                </span>
                              )}
                            </div>
                            {dep.commitSha && (
                              <p className="text-[10px] font-mono text-muted mt-0.5">
                                {dep.commitSha.slice(0, 8)}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-muted shrink-0">
                          {formatDate(dep.startedAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-14 text-center">
                  <GitCommit className="h-8 w-8 text-muted mx-auto mb-3" />
                  <p className="text-foreground text-sm font-medium">
                    No deployment records
                  </p>
                  <p className="text-xs text-muted mt-1">
                    Records are created after each Jenkins pipeline run
                  </p>
                  {project.pipeline?.jenkinsJobUrl && (
                    <a
                      href={project.pipeline.jenkinsJobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-4 text-xs text-amber-500 hover:text-amber-400 transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View pipeline in Jenkins
                    </a>
                  )}
                </CardContent>
              </Card>
            )}
    </div>
  );
}
