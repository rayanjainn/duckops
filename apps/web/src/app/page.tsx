"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  GitBranch, Server, Zap, Activity,
  ArrowRight, CheckCircle2, Terminal, Sparkles,
  Bot, Code2, ChevronRight, Play,
} from "lucide-react";

// ─── Typewriter ───────────────────────────────────────────────────────────────
const PROMPTS = [
  "Build me a REST API with PostgreSQL and auth",
  "Create a Next.js SaaS with user accounts",
  "Set up a full-stack e-commerce backend",
  "Make a real-time chat server with WebSockets",
];

function TypewriterPrompt() {
  const [idx, setIdx] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const target = PROMPTS[idx];
    let t: ReturnType<typeof setTimeout>;
    if (!deleting && displayed.length < target.length) {
      t = setTimeout(() => setDisplayed(target.slice(0, displayed.length + 1)), 38);
    } else if (!deleting && displayed.length === target.length) {
      t = setTimeout(() => setDeleting(true), 2000);
    } else if (deleting && displayed.length > 0) {
      t = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 18);
    } else {
      setDeleting(false);
      setIdx((i) => (i + 1) % PROMPTS.length);
    }
    return () => clearTimeout(t);
  }, [displayed, deleting, idx]);

  return <span className="text-amber-500 cursor-blink">{displayed || <span className="opacity-0">_</span>}</span>;
}

// ─── Terminal demo ────────────────────────────────────────────────────────────
const TERMINAL_LINES = [
  { delay: 0,    text: "$ duckops create my-api", type: "cmd" },
  { delay: 500,  text: "✓ Scaffolding TypeScript + Express + Prisma", type: "ok" },
  { delay: 1100, text: "✓ Creating GitHub repo: you/my-api", type: "ok" },
  { delay: 1800, text: "✓ Building Docker image → registry:5111", type: "ok" },
  { delay: 2600, text: "✓ Terraform: K8s namespace provisioned", type: "ok" },
  { delay: 3300, text: "✓ Ansible: deployment + Traefik ingress", type: "ok" },
  { delay: 4000, text: "✓ Jenkins pipeline created", type: "ok" },
  { delay: 4600, text: "Live: http://my-api.localhost:8080", type: "live" },
];

function TerminalDemo() {
  const [visible, setVisible] = useState(0);
  useEffect(() => {
    TERMINAL_LINES.forEach((line, i) => {
      setTimeout(() => setVisible(i + 1), line.delay + 200);
    });
  }, []);

  return (
    <div className="terminal-window w-full max-w-md">
      <div className="terminal-bar">
        <div className="terminal-dot bg-red-500" />
        <div className="terminal-dot bg-yellow-500" />
        <div className="terminal-dot bg-green-500" />
        <span className="ml-3 text-xs text-muted">duckops — terminal</span>
      </div>
      <div className="p-5 font-mono text-sm space-y-1.5 min-h-[220px]">
        {TERMINAL_LINES.slice(0, visible).map((line, i) => (
          <div key={i} className={
            line.type === "cmd" ? "text-foreground" :
            line.type === "live" ? "text-amber-500 font-semibold" :
            "text-emerald-500"
          }>
            {line.text}
          </div>
        ))}
        {visible < TERMINAL_LINES.length && <div className="text-muted cursor-blink">&nbsp;</div>}
      </div>
    </div>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const PIPELINE_STEPS = [
  { n: "1", label: "Scaffold" },
  { n: "2", label: "GitHub" },
  { n: "3", label: "Docker" },
  { n: "4", label: "Terraform" },
  { n: "5", label: "Ansible" },
  { n: "6", label: "Jenkins" },
  { n: "7", label: "Running" },
];

const FEATURES = [
  { icon: Bot, title: "AI Stack Selection", desc: "Describe what you want. DuckOps recommends the right stack and generates production-ready code.", color: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
  { icon: GitBranch, title: "Auto Scaffolding", desc: "Handlebars templates generate Dockerfiles, K8s manifests, and Jenkinsfile instantly — zero config.", color: "text-purple-500 bg-purple-500/10 border-purple-500/20" },
  { icon: Server, title: "K8s Provisioning", desc: "Terraform creates namespaces. Ansible deploys manifests and wires Traefik ingress automatically.", color: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
  { icon: Zap, title: "Jenkins CI/CD", desc: "Every project gets a pipeline. Commits auto-trigger test → build → push → deploy.", color: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20" },
  { icon: Activity, title: "Health Monitoring", desc: "The health service pings your /health endpoint every 30s. Degradation surfaces in real time.", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
  { icon: Code2, title: "AI Continuation", desc: "Deployed? Give a new prompt. AI clones the repo, edits code, commits, pushes. Jenkins fires.", color: "text-pink-500 bg-pink-500/10 border-pink-500/20" },
];

const STACKS = ["Express 5", "Fastify 5", "React 19", "Vue 3", "Next.js 15", "Turbo Monorepo", "PostgreSQL", "MySQL", "Prisma 6", "Drizzle ORM"];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface text-foreground overflow-x-hidden">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-surface/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-600 flex items-center justify-center">
              <GitBranch className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-bold text-foreground text-sm">DuckOps</span>
            <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded ml-1">BETA</span>
          </div>
          <div className="hidden md:flex items-center gap-7 text-sm text-muted">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#stacks" className="hover:text-foreground transition-colors">Stacks</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-muted hover:text-foreground transition-colors">Sign in</Link>
            <Link href="/login" className="text-sm bg-amber-600 hover:bg-amber-500 text-white px-4 py-1.5 rounded-lg font-medium transition-all">
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-36 pb-24 px-6">
        <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none overflow-hidden">
          <div className="absolute top-24 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-amber-600/8 rounded-full blur-3xl" />
        </div>

        <div className="max-w-4xl mx-auto relative text-center space-y-8">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-amber-500 bg-amber-500/10 border border-amber-500/20 px-3.5 py-1.5 rounded-full animate-fade-in">
            <Sparkles className="h-3 w-3" />
            AI-Powered Internal Developer Platform
          </div>

          <h1 className="text-5xl md:text-[68px] font-bold tracking-tight leading-[1.05] animate-slide-up text-foreground">
            Ship faster.<br />
            <span className="gradient-text">Think less.</span>
          </h1>

          <p className="text-lg text-muted max-w-xl mx-auto leading-relaxed animate-slide-up animate-slide-up-1">
            One prompt. DuckOps scaffolds your app, pushes to GitHub,
            provisions Kubernetes, deploys, and wires up Jenkins CI/CD — automatically.
          </p>

          {/* Typewriter box */}
          <div className="max-w-lg mx-auto animate-slide-up animate-slide-up-2">
            <div className="relative p-px rounded-2xl" style={{ background: "linear-gradient(135deg, rgba(217,119,6,0.5), rgba(217,119,6,0.1), rgba(217,119,6,0.5))" }}>
              <div className="bg-surface-2 rounded-[15px] px-5 py-4 text-left">
                <p className="text-[11px] text-muted mb-2 font-mono">// describe your project</p>
                <p className="font-mono text-sm min-h-[20px]"><TypewriterPrompt /></p>
              </div>
            </div>
            <Link href="/login" className="mt-3 flex items-center justify-center gap-2 w-full bg-amber-600 hover:bg-amber-500 text-white py-3.5 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-amber-900/30 hover:shadow-amber-900/50">
              <Play className="h-4 w-4 fill-current" />
              Start building
            </Link>
          </div>
        </div>

        {/* Terminal */}
        <div className="mt-20 flex justify-center animate-slide-up animate-slide-up-3">
          <div className="animate-float">
            <TerminalDemo />
          </div>
        </div>
      </section>

      {/* Pipeline */}
      <section className="py-20 px-6 border-y border-border">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-10">
            <div>
              <p className="text-xs text-amber-500 font-semibold uppercase tracking-widest mb-1">The Pipeline</p>
              <h2 className="text-2xl font-bold text-foreground">7 stages. Fully automated.</h2>
            </div>
            <Link href="/login" className="hidden md:flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors">
              Get started <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="relative flex items-center gap-0">
            {PIPELINE_STEPS.map((step, i) => (
              <div key={step.label} className="flex-1 flex flex-col items-center gap-2">
                <div className="flex items-center w-full">
                  <div className="flex-1 h-px bg-border" style={{ visibility: i === 0 ? "hidden" : "visible" }} />
                  <div className="w-10 h-10 rounded-xl bg-surface-3 border border-border flex items-center justify-center group hover:bg-amber-500/10 hover:border-amber-500/30 transition-all cursor-default shrink-0">
                    <span className="text-xs font-bold text-muted group-hover:text-amber-500">{step.n}</span>
                  </div>
                  <div className="flex-1 h-px bg-border" style={{ visibility: i === PIPELINE_STEPS.length - 1 ? "hidden" : "visible" }} />
                </div>
                <p className="text-[10px] font-medium text-muted text-center">{step.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs text-amber-500 font-semibold uppercase tracking-widest mb-3">Everything included</p>
            <h2 className="text-3xl font-bold text-foreground">No plugins. No YAML. No glue.</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {FEATURES.map(({ icon: Icon, title, desc, color }) => (
              <div key={title} className="p-5 rounded-xl border border-border bg-surface-2 hover:bg-surface-3 hover:border-border-2 transition-all">
                <div className={`w-9 h-9 rounded-lg border flex items-center justify-center mb-4 ${color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="font-semibold text-foreground text-sm mb-1.5">{title}</h3>
                <p className="text-xs text-muted leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Builder spotlight */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 rounded-full">
              <Bot className="h-3.5 w-3.5" />
              AI Builder
            </div>
            <h2 className="text-3xl font-bold leading-tight text-foreground">
              Describe it.<br />
              <span className="gradient-text">We build it.</span>
            </h2>
            <p className="text-muted text-sm leading-relaxed">
              DuckOps AI picks your stack from natural language, writes production code,
              commits to GitHub, and fires your CI/CD pipeline — all in one shot.
            </p>
            <ul className="space-y-2.5">
              {[
                "Smart stack detection: frontend, backend, or monorepo",
                "Qwen3 for production-quality code",
                "Auto error-fix pass before every commit",
                "Continue building on any deployed project",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-muted">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/login" className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all">
              Try AI Builder <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* AI chat mockup */}
          <div className="terminal-window animate-float-delay">
            <div className="terminal-bar">
              <div className="terminal-dot bg-red-500" />
              <div className="terminal-dot bg-yellow-500" />
              <div className="terminal-dot bg-green-500" />
              <div className="flex items-center gap-2 ml-3">
                <Bot className="h-3.5 w-3.5 text-purple-400" />
                <span className="text-xs text-muted">DuckOps AI</span>
              </div>
            </div>
            <div className="p-5 space-y-4 font-mono text-xs">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-surface-3 border border-border flex items-center justify-center shrink-0 text-[10px] text-muted">U</div>
                <div className="bg-surface-3 border border-border rounded-xl rounded-tl-sm px-3 py-2 text-foreground">
                  Add JWT auth and a /users endpoint
                </div>
              </div>
              <div className="flex gap-3 flex-row-reverse">
                <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center shrink-0">
                  <Bot className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="bg-purple-600/10 border border-purple-500/20 rounded-xl rounded-tr-sm px-3 py-2 space-y-1.5 max-w-[80%]">
                  <p className="text-purple-400 font-semibold">Writing 4 files...</p>
                  <p className="text-amber-500">src/middleware/auth.ts</p>
                  <p className="text-amber-500">src/routes/users.ts</p>
                  <p className="text-amber-500">src/lib/jwt.ts</p>
                  <div className="mt-2 pt-2 border-t border-purple-500/10 text-emerald-500">
                    Committed · Jenkins building...
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stacks */}
      <section id="stacks" className="py-24 px-6 border-t border-border">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs text-amber-500 font-semibold uppercase tracking-widest mb-3">Supported Stacks</p>
          <h2 className="text-2xl font-bold text-foreground mb-10">Every stack, production-ready.</h2>
          <div className="flex flex-wrap justify-center gap-2">
            {STACKS.map((s) => (
              <div key={s} className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 border border-border rounded-lg hover:border-amber-500/30 hover:bg-amber-500/5 transition-all group">
                <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                <span className="text-xs text-muted group-hover:text-foreground transition-colors">{s}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-xl mx-auto text-center space-y-6">
          <h2 className="text-4xl font-bold text-foreground">
            Deploy in minutes.<br />
            <span className="gradient-text">Not days.</span>
          </h2>
          <p className="text-muted text-sm">Sign in with GitHub. First project running on K8s in under 5 minutes.</p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/login" className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white px-7 py-3.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-amber-900/30">
              <Terminal className="h-4 w-4" />
              Start building free
            </Link>
            <Link href="/projects" className="inline-flex items-center gap-2 border border-border hover:border-border-2 text-muted hover:text-foreground px-5 py-3.5 rounded-xl font-semibold text-sm transition-all">
              Dashboard <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-amber-600/20 flex items-center justify-center">
              <GitBranch className="h-3 w-3 text-amber-500" />
            </div>
            <span className="font-semibold text-muted-2">DuckOps</span>
            <span>— Internal Developer Platform</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/projects" className="hover:text-foreground transition-colors">Projects</Link>
            <Link href="/projects/new" className="hover:text-foreground transition-colors">New project</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
