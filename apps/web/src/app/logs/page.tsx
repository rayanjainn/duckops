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

export interface ParsedLogLine {
  raw: string;
  time?: string;
  service?: string;
  level: "error" | "warn" | "info" | "debug" | "http";
  method?: string;
  path?: string;
  status?: number;
  duration?: string;
  message: string;
}

const LOG_COLORS: Record<string, string> = {
  error:  "text-red-400 font-bold bg-red-500/5",
  warn:   "text-amber-400 bg-amber-500/5",
  info:   "text-sky-400",
  http:   "text-emerald-400 font-mono",
  debug:  "text-slate-500 italic",
};

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
  service, metric, active, onClick,
}: {
  service: ServiceMeta;
  metric: Metric | undefined;
  active: boolean;
  onClick: () => void;
}) {
  const color = SERVICE_COLORS[service.name] ?? "#f59e0b";
  const isOnline = metric?.status === "online";

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 rounded-lg border transition-all duration-200 group relative overflow-hidden",
        active
          ? "border-amber-500/50 bg-amber-500/5 ring-1 ring-amber-500/20"
          : "border-border bg-surface-2/40 hover:border-border-2 hover:bg-surface-3/60",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div 
            className="w-1.5 h-1.5 rounded-full" 
            style={{ 
              background: isOnline ? color : "#ef4444",
              boxShadow: isOnline ? `0 0 8px ${color}` : "none"
            }} 
          />
          <span className="text-xs font-medium text-foreground group-hover:text-amber-400 transition-colors">
            {service.label}
          </span>
        </div>
        {metric && (
          <span className="text-[10px] font-mono text-muted-2">
            {metric.cpu.toFixed(0)}%
          </span>
        )}
      </div>
      {active && (
        <div 
          className="absolute left-0 top-0 bottom-0 w-1" 
          style={{ background: color }}
        />
      )}
    </button>
  );
}

// ── Service Monitoring (Main Area) ───────────────────────────────────────────

function ServiceMonitoring({ 
  service, 
  metric, 
  history, 
  color 
}: { 
  service: ServiceMeta; 
  metric: Metric | undefined; 
  history: any[];
  color: string;
}) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Metrics Grid */}
      <div className="grid grid-cols-4 gap-4 p-4 shrink-0 bg-surface-2/20 border-b border-border">
        <div className="p-3 rounded-xl bg-surface-3/30 border border-border/50">
          <p className="text-[10px] uppercase tracking-wider text-muted font-bold mb-1">CPU Usage</p>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-mono font-bold text-foreground">{metric?.cpu.toFixed(1) ?? "0.0"}%</span>
            <Activity className="h-4 w-4 text-emerald-400 mb-1" />
          </div>
        </div>
        <div className="p-3 rounded-xl bg-surface-3/30 border border-border/50">
          <p className="text-[10px] uppercase tracking-wider text-muted font-bold mb-1">Memory (RSS)</p>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-mono font-bold text-foreground">{metric ? fmtBytes(metric.memoryBytes) : "0 MB"}</span>
            <MemoryStick className="h-4 w-4 text-purple-400 mb-1" />
          </div>
        </div>
        <div className="p-3 rounded-xl bg-surface-3/30 border border-border/50">
          <p className="text-[10px] uppercase tracking-wider text-muted font-bold mb-1">Restarts</p>
          <div className="flex items-end gap-2">
            <span className={cn("text-2xl font-mono font-bold", metric && metric.restarts > 5 ? "text-amber-400" : "text-foreground")}>
              {metric?.restarts ?? "0"}
            </span>
            <RefreshCw className={cn("h-4 w-4 mb-1", metric && metric.restarts > 5 ? "text-amber-400" : "text-slate-500")} />
          </div>
        </div>
        <div className="p-3 rounded-xl bg-surface-3/30 border border-border/50">
          <p className="text-[10px] uppercase tracking-wider text-muted font-bold mb-1">Uptime</p>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-mono font-bold text-foreground">{metric?.uptime ? fmtUptime(metric.uptime) : "—"}</span>
            <Play className="h-4 w-4 text-sky-400 mb-1" />
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="h-64 p-4 shrink-0 bg-surface/50 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted" />
            Performance History (Last 20m)
          </h3>
          <div className="flex items-center gap-4 text-[10px] font-medium uppercase tracking-tighter">
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ background: color }} /> CPU %</div>
          </div>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history}>
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip 
                contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", color: "#f8fafc", fontSize: "11px" }}
                itemStyle={{ color: color }}
              />
              <Area 
                type="monotone" 
                dataKey="cpu" 
                stroke={color} 
                fill="url(#chartGrad)" 
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Logs Section */}
      <div className="flex-1 overflow-hidden">
        <LogPanel serviceName={service.name} color={color} />
      </div>
    </div>
  );
}

// ── Log Panel ─────────────────────────────────────────────────────────────────

function LogPanel({ serviceName, color }: { serviceName: string; color: string }) {
  const [lines, setLines] = useState<ParsedLogLine[]>([]);
  const [filter, setFilter] = useState("");
  const [paused, setPaused] = useState(false);
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const pendingRef = useRef<ParsedLogLine[]>([]);

  pausedRef.current = paused;

  useEffect(() => {
    setLines([]);
    setConnected(false);
    const url = platformApi.logsUrl(serviceName);
    const es = new EventSource(url);

    es.onopen = () => setConnected(true);
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as { type: string; lines: ParsedLogLine[] };
        if (pausedRef.current) {
          pendingRef.current.push(...msg.lines);
          return;
        }
        setLines((prev) => {
          const next = [...prev, ...msg.lines];
          return next.slice(-2000);
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
    ? lines.filter((l) => l.raw.toLowerCase().includes(filter.toLowerCase()))
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
          filtered.map((line, i) => (
            <div key={i} className={cn(
              "group flex gap-3 px-2 py-0.5 hover:bg-white/5 transition-colors border-l-2",
              LOG_COLORS[line.level] ?? "text-slate-300",
              line.level === "error" ? "border-red-500/50" : "border-transparent"
            )}>
              <span className="shrink-0 text-slate-500 w-16 opacity-50 select-none">{line.time}</span>
              <div className="flex-1 whitespace-pre-wrap break-all">
                {line.method && (
                  <span className="mr-2 font-bold px-1 bg-white/10 rounded text-[9px] uppercase">{line.method}</span>
                )}
                {line.message}
                {line.status && (
                  <span className={cn("ml-2 font-bold", line.status >= 400 ? "text-red-400" : "text-emerald-400")}>
                    {line.status}
                  </span>
                )}
              </div>
            </div>
          ))
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

  const [services, setServices] = useState<ServiceMeta[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [activeHistory, setActiveHistory] = useState<any[]>([]);
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
      } catch { /* ignore */ }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, [activeService]);

  // Fetch history for active service
  useEffect(() => {
    if (!activeService) return;
    let cancelled = false;
    const fetchHist = async () => {
      try {
        const { history } = await platformApi.getHistory(activeService);
        if (!cancelled) setActiveHistory(history);
      } catch { /* ignore */ }
    };
    fetchHist();
    const id = setInterval(fetchHist, 10000); // refresh history every 10s
    return () => { cancelled = true; clearInterval(id); };
  }, [activeService]);

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
        <div className="w-60 shrink-0 border-r border-border overflow-y-auto p-4 space-y-3 bg-surface-2/20">
          <div className="px-2 mb-4">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted">Platform Nodes</h2>
          </div>
          {services.length === 0
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 rounded-lg skeleton" />
              ))
            : services.map((svc) => (
                <MetricCard
                  key={svc.name}
                  service={svc}
                  metric={metrics.find((m) => m.name === svc.name)}
                  active={activeService === svc.name}
                  onClick={() => setActiveService(svc.name)}
                />
              ))}
        </div>

        {/* Right: Monitoring Section */}
        <div className="flex-1 flex flex-col overflow-hidden bg-surface">
          {activeService && activeMeta ? (
            <ServiceMonitoring 
              key={activeService}
              service={activeMeta}
              metric={metrics.find(m => m.name === activeService)}
              history={activeHistory}
              color={activeColor}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted text-sm gap-2">
              <ChevronDown className="h-4 w-4" />
              Select a service from the sidebar
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
