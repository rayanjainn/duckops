"use client";

import Link from "next/link";
import { Plus, Activity, CheckCircle2, AlertCircle, Clock, ArrowRight, TrendingUp } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { Header } from "@/components/layout/Header";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { LiveBuildCard } from "@/components/pipeline/LiveBuildCard";
import type { ProjectStatus } from "@duckops/shared-types";

const ACTIVE_STATUSES: ProjectStatus[] = ["INITIALIZING", "SCAFFOLDING", "PROVISIONING", "CONFIGURING", "PIPELINE_READY", "DEPLOYING"];

// Generate mock activity data for the chart
function generateActivityData() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return days.map((day) => ({
    day,
    deploys: Math.floor(Math.random() * 8) + 1,
    checks: Math.floor(Math.random() * 60) + 20,
  }));
}

const activityData = generateActivityData();

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  sub,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-muted-2 uppercase tracking-wider">{label}</p>
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="h-4 w-4 text-white" />
          </div>
        </div>
        <p className="text-3xl font-bold text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

const PIE_COLORS = ["#22c55e", "#d97706", "#f59e0b", "#ef4444", "#6b7280"];

export default function DashboardPage() {
  const { data: projects = [], isLoading } = useProjects();

  const stats = {
    total: projects.length,
    running: projects.filter((p) => p.status === "RUNNING").length,
    failed: projects.filter((p) => p.status === "FAILED").length,
    active: projects.filter((p) => ACTIVE_STATUSES.includes(p.status)).length,
    degraded: projects.filter((p) => p.status === "DEGRADED").length,
  };

  const pieData = [
    { name: "Running", value: stats.running },
    { name: "Active", value: stats.active },
    { name: "Degraded", value: stats.degraded },
    { name: "Failed", value: stats.failed },
    { name: "Other", value: Math.max(0, stats.total - stats.running - stats.active - stats.degraded - stats.failed) },
  ].filter((d) => d.value > 0);

  const recentProjects = [...projects].slice(0, 6);

  return (
    <div className="min-h-screen bg-surface">
      <Header
        title="Dashboard"
        description="Platform overview and project health"
        actions={
          <Link href="/projects/new">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </Link>
        }
      />

      <div className="p-8 space-y-8">
        {/* Stats row */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="Total Projects" value={stats.total} icon={Activity} color="bg-amber-600" sub="All time" />
          <StatCard label="Running" value={stats.running} icon={CheckCircle2} color="bg-emerald-600" sub="Healthy" />
          <StatCard label="In Progress" value={stats.active} icon={Clock} color="bg-amber-600" sub="Provisioning" />
          <StatCard label="Failed" value={stats.failed} icon={AlertCircle} color="bg-red-600" sub="Needs attention" />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-3 gap-4">
          {/* Activity chart */}
          <Card className="col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Deployment Activity</CardTitle>
                <div className="flex items-center gap-4 text-xs text-muted">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />Deploys</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Health Checks</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={activityData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="deploys" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d97706" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="checks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fill: "#666666", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#666666", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#1a1a1a", border: "1px solid #333333", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#999999" }}
                    itemStyle={{ color: "#ffffff" }}
                  />
                  <Area type="monotone" dataKey="checks" stroke="#22c55e" strokeWidth={1.5} fill="url(#checks)" />
                  <Area type="monotone" dataKey="deploys" stroke="#d97706" strokeWidth={1.5} fill="url(#deploys)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Status breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.total === 0 ? (
                <div className="h-[180px] flex items-center justify-center text-muted text-sm">No projects yet</div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <ResponsiveContainer width="100%" height={130}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" strokeWidth={0}>
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "#1a1a1a", border: "1px solid #333333", borderRadius: 8, fontSize: 12 }}
                        itemStyle={{ color: "#ffffff" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 w-full">
                    {pieData.map((d, i) => (
                      <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        {d.name} ({d.value})
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Live CI/CD Builds */}
        {projects.some((p) => p.pipeline) && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="relative inline-flex shrink-0">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="absolute inset-0 w-2 h-2 rounded-full bg-amber-500 animate-ping opacity-75" />
                </span>
                <h2 className="text-sm font-semibold text-foreground">Live CI/CD</h2>
                <span className="text-xs text-muted">— Jenkins builds in real time</span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {projects
                .filter((p) => p.pipeline)
                .map((p) => (
                  <LiveBuildCard
                    key={p.id}
                    projectId={p.id}
                    projectName={p.displayName}
                    jobName={p.pipeline!.jenkinsJobName}
                    jobUrl={p.pipeline!.jenkinsJobUrl ?? undefined}
                  />
                ))}
            </div>
          </div>
        )}

        {/* Recent Projects */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-2" />
              <h2 className="text-sm font-semibold text-foreground">Recent Projects</h2>
            </div>
            <Link href="/projects" className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300">
              View all
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-surface p-5 space-y-3">
                  <div className="skeleton h-4 w-3/4" />
                  <div className="skeleton h-3 w-1/2" />
                  <div className="skeleton h-3 w-2/3" />
                </div>
              ))}
            </div>
          ) : recentProjects.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center space-y-4">
                <div className="w-12 h-12 rounded-xl bg-surface-3 flex items-center justify-center mx-auto">
                  <Activity className="h-6 w-6 text-muted" />
                </div>
                <div>
                  <p className="text-foreground font-medium">No projects yet</p>
                  <p className="text-muted text-sm mt-1">Create your first project to get started</p>
                </div>
                <Link href="/projects/new">
                  <Button size="sm">
                    <Plus className="h-4 w-4" />
                    Create Project
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
