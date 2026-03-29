"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2, XCircle, Clock, Loader2,
  Terminal, ChevronDown, ChevronUp, ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLiveBuild } from "@/hooks/useLiveBuild";
import { cn } from "@/lib/utils";
import type { BuildStage } from "@/lib/api";
import Link from "next/link";

const STAGE_ICON: Record<BuildStage["status"], React.ElementType> = {
  IN_PROGRESS: Loader2,
  SUCCESS: CheckCircle2,
  FAILED: XCircle,
  NOT_EXECUTED: Clock,
  PAUSED: Clock,
};

const STAGE_COLOR: Record<BuildStage["status"], string> = {
  IN_PROGRESS: "text-amber-400",
  SUCCESS: "text-emerald-400",
  FAILED: "text-red-400",
  NOT_EXECUTED: "text-muted",
  PAUSED: "text-amber-400",
};

const STAGE_BG: Record<BuildStage["status"], string> = {
  IN_PROGRESS: "bg-amber-500/10 border-amber-500/30",
  SUCCESS: "bg-emerald-500/10 border-emerald-500/20",
  FAILED: "bg-red-500/10 border-red-500/20",
  NOT_EXECUTED: "bg-surface-3 border-border",
  PAUSED: "bg-amber-500/10 border-amber-500/20",
};

function StageRow({ stage }: { stage: BuildStage }) {
  const Icon = STAGE_ICON[stage.status];
  return (
    <div className={cn("flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs", STAGE_BG[stage.status])}>
      <Icon className={cn("h-3.5 w-3.5 shrink-0", STAGE_COLOR[stage.status], stage.status === "IN_PROGRESS" && "animate-spin")} />
      <span className={cn("flex-1 font-medium", STAGE_COLOR[stage.status])}>{stage.name}</span>
      {stage.durationMillis > 0 && (
        <span className="text-muted font-mono">{(stage.durationMillis / 1000).toFixed(1)}s</span>
      )}
    </div>
  );
}

interface LiveBuildCardProps {
  projectId: string;
  projectName: string;
  jobName?: string;
  jobUrl?: string;
}

export function LiveBuildCard({ projectId, projectName, jobName, jobUrl }: LiveBuildCardProps) {
  const { data, connected } = useLiveBuild(projectId);
  const [showConsole, setShowConsole] = useState(false);
  const consoleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showConsole && consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [data?.consoleLines, showConsole]);

  const isBuilding = data?.building ?? false;
  const result = data?.result;
  const buildNum = data?.number;

  const progress =
    data && data.estimatedDurationMs > 0 && isBuilding
      ? Math.min(95, Math.round((data.durationMs / data.estimatedDurationMs) * 100))
      : null;

  const statusLabel = isBuilding
    ? "Running"
    : result === "SUCCESS" ? "Passed"
    : result === "FAILURE" || result === "FAILED" ? "Failed"
    : result === "ABORTED" ? "Aborted"
    : result ?? "Idle";

  const resultColor = isBuilding
    ? "text-amber-400"
    : result === "SUCCESS" ? "text-emerald-400"
    : result === "FAILURE" || result === "FAILED" ? "text-red-400"
    : "text-muted-2";

  if (!data && !connected) {
    return (
      <Card className="opacity-60">
        <CardContent className="p-4 flex items-center gap-3 text-xs text-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
          Connecting to Jenkins for <span className="font-mono text-white ml-1">{projectName}</span>…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      "transition-all duration-300",
      isBuilding && "border-amber-500/40 shadow-lg shadow-amber-900/10",
      result === "SUCCESS" && !isBuilding && "border-emerald-500/30",
      (result === "FAILURE" || result === "FAILED") && !isBuilding && "border-red-500/30",
    )}>
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="relative inline-flex shrink-0">
              <span className={cn(
                "w-2 h-2 rounded-full",
                isBuilding ? "bg-amber-500"
                  : result === "SUCCESS" ? "bg-emerald-500"
                  : result ? "bg-red-500"
                  : "bg-muted"
              )} />
              {isBuilding && (
                <span className="absolute inset-0 w-2 h-2 rounded-full bg-amber-500 animate-ping opacity-75" />
              )}
            </span>
            <Link href={`/projects/${projectId}`}>
              <CardTitle className="text-sm hover:text-amber-400 transition-colors truncate">
                {projectName}
              </CardTitle>
            </Link>
            {buildNum && (
              <span className="text-xs text-muted font-mono shrink-0">#{buildNum}</span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={cn("text-xs font-semibold", resultColor)}>{statusLabel}</span>
            {jobUrl && (
              <a href={jobUrl} target="_blank" rel="noopener noreferrer"
                className="text-muted hover:text-amber-400 transition-colors">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>

        {progress !== null && (
          <div className="mt-2.5 h-1 bg-surface-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-1.5">
        {data?.stages && data.stages.length > 0 ? (
          data.stages.map((stage) => <StageRow key={stage.id} stage={stage} />)
        ) : (
          <p className="text-xs text-muted italic px-1">
            {isBuilding ? "Waiting for stage data…" : jobName ? `Job: ${jobName}` : "No build data yet"}
          </p>
        )}

        {data?.consoleLines && data.consoleLines.length > 0 && (
          <div className="pt-1">
            <button
              onClick={() => setShowConsole((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors"
            >
              <Terminal className="h-3 w-3" />
              Console output
              {showConsole
                ? <ChevronUp className="h-3 w-3" />
                : <ChevronDown className="h-3 w-3" />}
            </button>
            {showConsole && (
              <div
                ref={consoleRef}
                className="mt-2 bg-black border border-border rounded-lg p-3 max-h-48 overflow-y-auto"
              >
                <pre className="text-[10px] leading-relaxed text-emerald-400 font-mono whitespace-pre-wrap break-all">
                  {data.consoleLines.join("\n")}
                </pre>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
