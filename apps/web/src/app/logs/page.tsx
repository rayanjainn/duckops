"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { platformApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  AreaChart, Area, ResponsiveContainer, Tooltip,
} from "recharts";
import {
  Activity, Cpu, MemoryStick, RefreshCw, Circle,
  AlertTriangle, Terminal, Search, X, ChevronDown, Pause, Play,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ServiceMeta { name: string; label: string; port: number }
interface Metric {
  name: string; status: string; cpu: number;
  memoryBytes: number; restarts: number; uptime: number; pid: number;
}
interface MetricSnapshot extends Metric { ts: number }

const SERVICE_COLORS: Record<string, string> = {
  "duckops-provisioning": "#f59e0b",
  "duckops-pipeline":     "#8b5cf6",
  "duckops-health":       "#10b981",
  "duckops-ai":           "#3b82f6",
  "duckops-catalog":      "#f43f5e",
};

const LOG_COLORS: Record<string, string> = {
  error:  "text-red-400",
  warn:   "text-amber-400",
  info:   "text-sky-400",
  debug:  "text-slate-400",
};

function classifyLine(line: string): string {
  const l = line.toLowerCase();
  if (l.includes("error") || l.includes("err ") || l.includes("failed")) return "error";
  if (l.includes("warn")) return "warn";
  if (l.includes("info")) return "info";
  return "debug";
}

function fmtBytes(b: number) {
  if (b > 1024 * 1024 * 1024) return (b / 1024 / 1024 / 1024).toFixed(1) + " GB";
  if (b > 1024 * 1024) return (b / 1024 / 1024).toFixed(0) + " MB";
  return (b / 1024).toFixed(0) + " KB";
}

function fmtUptime(ms: number) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d`;
}

// ── Metric Card ───────────────────────────────────────────────────────────────

function MetricCard({
  service, metric, history, active, onClick,
}: {
  service: ServiceMeta;
  metric: Metric | undefined;
  history: MetricSnapshot[];
  active: boolean;
  onClick: () => void;
}) {
  const color = SERVICE_COLORS[service.name] ?? "#f59e0b";
  const isOnline = metric?.status === "online";
  const cpuData = history.map((h, i) => ({ i, cpu: h.cpu }));
  const memMB = metric ? metric.memoryBytes / 1024 / 1024 : 0;
  const memPct = Math.min(100, (memMB / 512) * 100);

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-4 rounded-xl border transition-all duration-200",
        active
          ? "border-amber-500/50 bg-amber-500/5 shadow-lg shadow-amber-900/10"
          : "border-border bg-surface-3/30 hover:border-border-2 hover:bg-surface-3/60",
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0 relative"
            style={{ background: isOnline ? color : "#ef4444" }}
          >
            {isOnline && (
              <span
                className="absolute inset-0 rounded-full animate-ping opacity-40"
                style={{ background: color }}
              />
            )}
          </span>
          <span className="text-sm font-semibold text-foreground">{service.label}</span>
        </div>
        <span className={cn(
          "text-[10px] px-1.5 py-0.5 rounded-full font-medium border",
          isOnline ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-red-400 bg-red-500/10 border-red-500/20",
        )}>
          {metric?.status ?? "—"}
        </span>
      </div>

      {/* CPU sparkline */}
      <div className="h-10 mb-3">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={cpuData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${service.name}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="cpu"
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#grad-${service.name})`}
              dot={false}
              isAnimationActive={false}
            />
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.[0] ? (
                  <div className="text-[10px] bg-surface border border-border px-2 py-1 rounded">
                    CPU: {(payload[0].value as number).toFixed(1)}%
                  </div>
                ) : null
              }
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <p className="text-muted mb-0.5 flex items-center gap-1"><Cpu className="h-2.5 w-2.5" /> CPU</p>
          <p className="font-mono font-semibold text-foreground">{metric?.cpu.toFixed(1) ?? "—"}%</p>
        </div>
        <div>
          <p className="text-muted mb-0.5 flex items-center gap-1"><MemoryStick className="h-2.5 w-2.5" /> MEM</p>
          <p className="font-mono font-semibold text-foreground">{metric ? fmtBytes(metric.memoryBytes) : "—"}</p>
        </div>
        <div>
          <p className="text-muted mb-0.5 flex items-center gap-1"><RefreshCw className="h-2.5 w-2.5" /> RST</p>
          <p className={cn("font-mono font-semibold", metric && metric.restarts > 5 ? "text-amber-400" : "text-foreground")}>
            {metric?.restarts ?? "—"}
          </p>
        </div>
      </div>

      {/* Memory bar */}
      <div className="mt-3">
        <div className="h-1 bg-surface-4 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${memPct}%`, background: color }}
          />
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-muted">
          <span>{metric ? fmtBytes(metric.memoryBytes) : "0 MB"}</span>
          <span className="text-muted-2">{metric?.uptime ? fmtUptime(metric.uptime) : "—"} up</span>
        </div>
      </div>

      {metric && metric.restarts > 5 && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-400">
          <AlertTriangle className="h-3 w-3" />
          High restart count
        </div>
      )}
    </button>
  );
}

// ── Log Panel ─────────────────────────────────────────────────────────────────

function LogPanel({ serviceName, color }: { serviceName: string; color: string }) {
  const [lines, setLines] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [paused, setPaused] = useState(false);
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const pendingRef = useRef<string[]>([]);

  pausedRef.current = paused;

  useEffect(() => {
    setLines([]);
    setConnected(false);
    const url = platformApi.logsUrl(serviceName);
    const es = new EventSource(url);

    es.onopen = () => setConnected(true);
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as { type: string; lines: string[] };
        if (pausedRef.current) {
          pendingRef.current.push(...msg.lines);
          return;
        }
        setLines((prev) => {
          const next = [...prev, ...msg.lines];
          return next.slice(-2000); // cap at 2000 lines
        });
      } catch { /* ignore */ }
    };
    es.onerror = () => setConnected(false);

    return () => es.close();
  }, [serviceName]);

  // Auto-scroll when not paused
  useEffect(() => {
    if (!paused) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [lines, paused]);

  const resume = useCallback(() => {
    setPaused(false);
    setLines((prev) => {
      const next = [...prev, ...pendingRef.current].slice(-2000);
      pendingRef.current = [];
      return next;
    });
  }, []);

  const filtered = filter
    ? lines.filter((l) => l.toLowerCase().includes(filter.toLowerCase()))
    : lines;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface shrink-0">
        <Circle
          className={cn("h-2 w-2 shrink-0", connected ? "text-emerald-400 fill-emerald-400" : "text-red-400 fill-red-400")}
        />
        <span className="text-xs text-muted">{connected ? "streaming" : "disconnected"}</span>
        <span className="text-xs font-mono text-muted-2 ml-1">{lines.length} lines</span>
        <div className="flex-1" />
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted pointer-events-none" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter…"
            className="pl-6 pr-2 py-1 text-xs bg-surface-3 border border-border rounded-md w-40 focus:outline-none focus:border-amber-500/50 placeholder:text-muted-2"
          />
          {filter && (
            <button onClick={() => setFilter("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <button
          onClick={() => paused ? resume() : setPaused(true)}
          className={cn(
            "flex items-center gap-1.5 text-xs px-2 py-1 rounded border transition-all",
            paused
              ? "border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
              : "border-border text-muted hover:text-foreground hover:border-border-2",
          )}
        >
          {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
          {paused ? `Resume (${pendingRef.current.length})` : "Pause"}
        </button>
        <button
          onClick={() => setLines([])}
          className="text-xs px-2 py-1 rounded border border-border text-muted hover:text-foreground hover:border-border-2 transition-all"
        >
          Clear
        </button>
      </div>

      {/* Log output */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed p-3 space-y-0.5 bg-[#0a0a0f]"
      >
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted text-xs gap-2">
            <Terminal className="h-4 w-4" />
            {connected ? "Waiting for log output…" : "Connecting…"}
          </div>
        ) : (
          filtered.map((line, i) => {
            const cls = classifyLine(line);
            return (
              <div key={i} className={cn("whitespace-pre-wrap break-all", LOG_COLORS[cls] ?? "text-slate-300")}>
                {line}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {paused && (
        <div className="flex items-center justify-between px-3 py-2 bg-amber-500/10 border-t border-amber-500/20 shrink-0">
          <span className="text-xs text-amber-400 flex items-center gap-1.5">
            <Pause className="h-3 w-3" /> Paused — {pendingRef.current.length} new lines buffered
          </span>
          <button onClick={resume} className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
            <Play className="h-3 w-3" /> Resume
          </button>
        </div>
      )}
    </div>
  );
}

// ── System Overview Bar ───────────────────────────────────────────────────────

function OverviewBar({ metrics }: { metrics: Metric[] }) {
  const online = metrics.filter((m) => m.status === "online").length;
  const totalMem = metrics.reduce((s, m) => s + m.memoryBytes, 0);
  const avgCpu = metrics.length ? metrics.reduce((s, m) => s + m.cpu, 0) / metrics.length : 0;
  const highRestarts = metrics.filter((m) => m.restarts > 5);

  return (
    <div className="flex items-center gap-6 px-6 py-3 bg-surface-3/40 border-b border-border text-xs">
      <div className="flex items-center gap-2">
        <Activity className="h-3.5 w-3.5 text-emerald-400" />
        <span className="text-muted">Services</span>
        <span className="font-semibold text-foreground">{online}/{metrics.length} online</span>
      </div>
      <div className="h-3 w-px bg-border" />
      <div className="flex items-center gap-2">
        <Cpu className="h-3.5 w-3.5 text-amber-400" />
        <span className="text-muted">Avg CPU</span>
        <span className="font-mono font-semibold text-foreground">{avgCpu.toFixed(1)}%</span>
      </div>
      <div className="h-3 w-px bg-border" />
      <div className="flex items-center gap-2">
        <MemoryStick className="h-3.5 w-3.5 text-purple-400" />
        <span className="text-muted">Total Mem</span>
        <span className="font-mono font-semibold text-foreground">{fmtBytes(totalMem)}</span>
      </div>
      {highRestarts.length > 0 && (
        <>
          <div className="h-3 w-px bg-border" />
          <div className="flex items-center gap-1.5 text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>{highRestarts.map((m) => m.name.replace("duckops-", "")).join(", ")} restarting frequently</span>
          </div>
        </>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LogsPage() {
  const [services, setServices] = useState<ServiceMeta[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [history, setHistory] = useState<Record<string, MetricSnapshot[]>>({});
  const [activeService, setActiveService] = useState<string>("");

  // Poll metrics every 3s
  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const data = await platformApi.getMetrics();
        if (cancelled) return;
        setServices(data.services);
        setMetrics(data.metrics);
        if (!activeService && data.services.length > 0) {
          setActiveService(data.services[0].name);
        }
        const now = Date.now();
        setHistory((prev) => {
          const next = { ...prev };
          for (const m of data.metrics) {
            const snap: MetricSnapshot = { ...m, ts: now };
            next[m.name] = [...(prev[m.name] ?? []), snap].slice(-40);
          }
          return next;
        });
      } catch { /* ignore */ }
    };

    poll();
    const id = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeColor = activeService ? (SERVICE_COLORS[activeService] ?? "#f59e0b") : "#f59e0b";
  const activeMeta = services.find((s) => s.name === activeService);

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Header
        title="Platform Logs"
        description="Real-time PM2 logs and metrics for all backend services"
        actions={
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
            Live
          </div>
        }
      />

      {metrics.length > 0 && <OverviewBar metrics={metrics} />}

      <div className="flex flex-1 overflow-hidden">
        {/* Left: service cards */}
        <div className="w-64 shrink-0 border-r border-border overflow-y-auto p-3 space-y-2">
          {services.length === 0
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-36 rounded-xl skeleton" />
              ))
            : services.map((svc) => (
                <MetricCard
                  key={svc.name}
                  service={svc}
                  metric={metrics.find((m) => m.name === svc.name)}
                  history={history[svc.name] ?? []}
                  active={activeService === svc.name}
                  onClick={() => setActiveService(svc.name)}
                />
              ))}
        </div>

        {/* Right: log panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="flex items-center gap-0 border-b border-border bg-surface shrink-0 overflow-x-auto">
            {services.map((svc) => {
              const color = SERVICE_COLORS[svc.name] ?? "#f59e0b";
              const isActive = activeService === svc.name;
              const m = metrics.find((x) => x.name === svc.name);
              return (
                <button
                  key={svc.name}
                  onClick={() => setActiveService(svc.name)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-all whitespace-nowrap shrink-0",
                    isActive
                      ? "border-b-2 text-foreground"
                      : "border-transparent text-muted hover:text-foreground hover:bg-surface-3/40",
                  )}
                  style={isActive ? { borderBottomColor: color } : {}}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: m?.status === "online" ? color : "#ef4444" }}
                  />
                  {svc.label}
                  {m && (
                    <span className="font-mono text-[10px] text-muted-2">{m.cpu.toFixed(0)}%</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active log */}
          <div className="flex-1 overflow-hidden">
            {activeService ? (
              <LogPanel key={activeService} serviceName={activeService} color={activeColor} />
            ) : (
              <div className="flex items-center justify-center h-full text-muted text-sm gap-2">
                <ChevronDown className="h-4 w-4" />
                Select a service
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
