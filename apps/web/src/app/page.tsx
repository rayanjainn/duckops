"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight, Bot, Boxes, CheckCircle2, Code2, Container, GitBranch, HeartPulse,
  Loader2, Rocket, Server, Sparkles, Terminal, Workflow,
} from "lucide-react";
import { MarketingFooter, MarketingNav } from "@/components/marketing/Chrome";
import { PipelineFigure } from "@/components/marketing/Figure";
import { Reveal } from "@/components/marketing/Reveal";
import { useBackendStatus } from "@/lib/useBackendStatus";

// ─── A timer that steps through a loop while mounted ─────────────────────────
function useLoop(length: number, ms: number | ((step: number) => number)) {
  const still = useReducedMotion();
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (still) {
      setStep(length - 1);
      return;
    }
    const wait = typeof ms === "function" ? ms(step) : ms;
    const t = setTimeout(() => setStep((s) => (s + 1) % length), wait);
    return () => clearTimeout(t);
  }, [step, length, ms, still]);
  return step;
}

// ─── Hero: the wizard plays itself ───────────────────────────────────────────
const CHOICES = [
  { label: "Language", options: ["TypeScript", "JavaScript"], pick: 0 },
  { label: "Framework", options: ["Express 5", "Fastify 5", "Next.js 15"], pick: 0 },
  { label: "Database", options: ["PostgreSQL", "None"], pick: 0 },
  { label: "ORM", options: ["Prisma", "Drizzle", "Raw SQL"], pick: 0 },
];
const STAGES = [
  { name: "Initializing", detail: "project saved, job queued" },
  { name: "Scaffolding", detail: "code rendered from templates" },
  { name: "Creating repo", detail: "pushed to GitHub" },
  { name: "Provisioning", detail: "image built, namespace by Terraform" },
  { name: "Configuring", detail: "Ansible deploys to Kubernetes" },
  { name: "Pipeline ready", detail: "Jenkins job created" },
  { name: "Deploying", detail: "first build running" },
  { name: "Running", detail: "/health every 30 s" },
];
// 0-3 choose, 4 press create, 5-12 stages, 13 live, 14 hold
const WIZARD_STEPS = 16;

function WizardDemo() {
  const step = useLoop(WIZARD_STEPS, (s) => (s < 4 ? 1100 : s === 4 ? 900 : s < 13 ? 750 : 2600));
  const chosen = Math.min(step, 4);
  const stage = step - 5;
  const building = step >= 5;
  return (
    <div className="mk-card p-5 md:p-6 w-full max-w-[520px] mx-auto relative overflow-hidden shadow-2xl shadow-black/40">
      <div className="flex items-center gap-2 mb-5">
        <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-auto text-[11px] font-mono text-muted">app.raycode.tech/projects/new</span>
      </div>
      <AnimatePresence mode="wait">
        {!building ? (
          <motion.div key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.4 }} className="space-y-3.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">New project</p>
              <span className="font-mono text-xs text-muted">my-api</span>
            </div>
            {CHOICES.map((c, i) => (
              <div key={c.label} className="space-y-1.5">
                <p className="text-[11px] uppercase tracking-widest text-muted">{c.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {c.options.map((o, j) => {
                    const on = i < chosen && j === c.pick;
                    return (
                      <motion.span
                        key={o}
                        animate={on ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                        transition={{ duration: 0.4 }}
                        className={`px-3 py-1.5 rounded-lg text-xs border transition-colors duration-300 ${on ? "border-amber-500/60 bg-amber-500/15 text-amber-500 font-semibold" : "border-border text-muted-2"}`}
                      >
                        {o}
                      </motion.span>
                    );
                  })}
                </div>
              </div>
            ))}
            <motion.div
              animate={step === 4 ? { scale: [1, 0.96, 1] } : { scale: 1 }}
              transition={{ duration: 0.35 }}
              className={`mt-2 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold ${chosen === 4 ? "mk-btn" : "bg-surface-3 text-muted"}`}
            >
              <Rocket className="h-4 w-4" /> Create project
            </motion.div>
          </motion.div>
        ) : (
          <motion.div key="stages" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} className="space-y-1.5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-foreground">my-api</p>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${stage >= 8 ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-500"}`}>
                {stage >= 8 ? "RUNNING" : STAGES[Math.min(stage, 7)]?.name.toUpperCase()}
              </span>
            </div>
            {STAGES.map((s, i) => {
              const done = i < stage || stage >= 8;
              const now = i === stage && stage < 8;
              return (
                <motion.div key={s.name} initial={false} animate={{ opacity: done || now ? 1 : 0.35 }} className="flex items-center gap-3 text-xs py-1">
                  {done ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" /> : now ? <Loader2 className="h-4 w-4 text-amber-500 animate-spin shrink-0" /> : <span className="h-4 w-4 rounded-full border border-border shrink-0" />}
                  <span className="text-foreground font-medium w-28 shrink-0">{s.name}</span>
                  <span className="text-muted truncate">{s.detail}</span>
                </motion.div>
              );
            })}
            <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden mt-3">
              <motion.div className="h-full rounded-full bg-[var(--mk-amber)]" animate={{ width: `${Math.min(100, (Math.max(stage, 0) / 8) * 100)}%` }} transition={{ duration: 0.6 }} />
            </div>
            <AnimatePresence>
              {stage >= 8 && (
                <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pt-3 text-xs font-mono text-emerald-400">
                  ● live at https://my-api-you-duckops.raycode.tech
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── The provisioning log streams on a loop ──────────────────────────────────
const LOG = [
  { t: "$ create project my-api · typescript · express · prisma", k: "cmd" },
  { t: "[queue]      BullMQ job accepted", k: "dim" },
  { t: "[scaffold]   app, Dockerfile, manifests and Jenkinsfile rendered", k: "ok" },
  { t: "[github]     created you/my-api and pushed the first commit", k: "ok" },
  { t: "[docker]     built image → registry:5111/my-api", k: "ok" },
  { t: "[terraform]  namespace my-api ready", k: "ok" },
  { t: "[ansible]    Deployment, Service and Ingress applied", k: "ok" },
  { t: "[jenkins]    pipeline created, build #1 started", k: "ok" },
  { t: "[health]     GET /health → 200 OK", k: "live" },
];

function LiveLog() {
  const step = useLoop(LOG.length + 3, (s) => (s >= LOG.length ? 1600 : 700));
  const shown = Math.min(step, LOG.length);
  return (
    <div className="mk-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border text-xs text-muted font-mono">
        <Terminal className="h-3.5 w-3.5" /> provisioning · live over Socket.io
      </div>
      <div className="p-4 font-mono text-[12.5px] leading-6 min-h-[260px]">
        {LOG.slice(0, shown).map((line, i) => (
          <motion.p key={`${line.t}-${i}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}
            className={line.k === "cmd" ? "text-foreground" : line.k === "dim" ? "text-muted" : line.k === "live" ? "text-emerald-400" : "text-muted-2"}>
            {line.t}
          </motion.p>
        ))}
        {shown < LOG.length && <span className="mk-caret" />}
      </div>
    </div>
  );
}

// ─── Stacks ──────────────────────────────────────────────────────────────────
const STACKS = [
  { name: "Express 5", kind: "Backend", meta: "TypeScript or JavaScript · Prisma, Drizzle or raw SQL", icon: Server },
  { name: "Fastify 5", kind: "Backend", meta: "TypeScript or JavaScript · Prisma, Drizzle or raw SQL", icon: Server },
  { name: "React 18", kind: "Frontend", meta: "Vite build served by nginx", icon: Code2 },
  { name: "Vue 3", kind: "Frontend", meta: "Vite build served by nginx", icon: Code2 },
  { name: "Next.js 15", kind: "Frontend", meta: "Node standalone server", icon: Code2 },
  { name: "Turbo", kind: "Full-stack", meta: "Next.js 15 + Express 5 API + Prisma in one repo", icon: Boxes },
];
const SHIPS = [
  { icon: Container, title: "Dockerfile", body: "A production image, built and pushed to the cluster registry." },
  { icon: Workflow, title: "Jenkinsfile", body: "Build, push and rolling update on every commit, with live logs." },
  { icon: Server, title: "Kubernetes manifests", body: "Deployment, Service and Ingress, applied by Ansible." },
  { icon: HeartPulse, title: "Health checks", body: "/health is pinged every 30 seconds and shown on the dashboard." },
];
const MARQUEE = ["TypeScript", "Next.js", "Express", "Fastify", "React", "Vue", "Prisma", "Drizzle", "PostgreSQL", "Kubernetes", "Terraform", "Ansible", "Jenkins", "BullMQ", "Redis", "Socket.io", "Docker"];

// ─── Architecture: requests flow through the gateway ─────────────────────────
const SERVICES = [
  { name: "Catalog", port: 4001, y: 40 },
  { name: "Provisioning", port: 4002, y: 100 },
  { name: "Pipeline", port: 4003, y: 160 },
  { name: "Health", port: 4004, y: 220 },
  { name: "AI", port: 4005, y: 280 },
];
const INFRA = [
  { name: "GitHub API", y: 70 },
  { name: "Terraform + Ansible", y: 150 },
  { name: "Jenkins", y: 230 },
];

function Architecture() {
  return (
    <svg viewBox="0 0 900 320" className="w-full h-auto" role="img" aria-label="The Next.js frontend talks to an Nginx gateway, which routes to five services. The provisioning service drives GitHub, Terraform with Ansible, and Jenkins, which deploy into the Kubernetes cluster.">
            {SERVICES.map((s) => (
        <path key={s.name} d={`M260 160 C 310 160, 300 ${s.y}, 360 ${s.y}`} fill="none" stroke="#f59e0b" strokeOpacity=".55" strokeWidth="1.6" className="mk-flowline" />
      ))}
      <path d="M150 160 L 200 160" fill="none" stroke="#f59e0b" strokeOpacity=".7" strokeWidth="1.6" className="mk-flowline" />
      {INFRA.map((n) => (
        <path key={n.name} d={`M520 100 C 580 100, 580 ${n.y}, 640 ${n.y}`} fill="none" stroke="#737373" strokeOpacity=".7" strokeWidth="1.4" className="mk-flowline" />
      ))}
      {INFRA.map((n) => (
        <path key={`${n.name}-k8s`} d={`M800 ${n.y} C 830 ${n.y}, 820 160, 850 160`} fill="none" stroke="#737373" strokeOpacity=".5" strokeWidth="1.4" className="mk-flowline" />
      ))}
      <g>
        <rect x="20" y="130" width="130" height="60" rx="14" fill="var(--color-surface-2)" stroke="var(--color-border-2)" />
        <text x="85" y="157" textAnchor="middle" className="fill-foreground" fontSize="14" fontWeight="600">Next.js app</text>
        <text x="85" y="176" textAnchor="middle" fill="#a8a29e" fontSize="11">wizard · dashboard</text>
      </g>
      <g>
        <rect x="200" y="125" width="60" height="70" rx="14" fill="var(--color-surface-2)" stroke="#f59e0b" />
        <text x="230" y="157" textAnchor="middle" className="fill-foreground" fontSize="12" fontWeight="700">Nginx</text>
        <text x="230" y="174" textAnchor="middle" fill="#a8a29e" fontSize="10">:4000</text>
      </g>
      {SERVICES.map((s, i) => (
        <motion.g key={s.name} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 * i, duration: 0.6 }}>
          <rect x="360" y={s.y - 22} width="160" height="44" rx="12" fill="var(--color-surface-2)" stroke={s.name === "Provisioning" ? "#f59e0b" : "var(--color-border-2)"} />
          <text x="378" y={s.y + 5} className="fill-foreground" fontSize="13" fontWeight="600">{s.name}</text>
          <text x="505" y={s.y + 5} textAnchor="end" fill="#a8a29e" fontSize="11" fontFamily="monospace">:{s.port}</text>
        </motion.g>
      ))}
      {INFRA.map((n, i) => (
        <motion.g key={n.name} initial={{ opacity: 0, x: 10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 + 0.1 * i, duration: 0.6 }}>
          <rect x="640" y={n.y - 22} width="160" height="44" rx="12" fill="var(--color-surface-2)" stroke="var(--color-border-2)" />
          <text x="720" y={n.y + 5} textAnchor="middle" className="fill-foreground" fontSize="13" fontWeight="600">{n.name}</text>
        </motion.g>
      ))}
      <g>
        <circle cx="868" cy="160" r="24" fill="var(--color-surface-2)" stroke="var(--color-border-2)" />
        <text x="868" y="164" textAnchor="middle" fill="#a8a29e" fontSize="11" fontWeight="700">k8s</text>
      </g>
    </svg>
  );
}

// ─── AI builder conversation, looping ────────────────────────────────────────
function AiDemo() {
  const step = useLoop(6, (s) => (s === 5 ? 2600 : 1300));
  const items = [
    <div key="u" className="self-end max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm mk-btn">Add JWT auth and a /users endpoint</div>,
    <div key="w" className="text-xs font-mono text-muted flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-[var(--mk-amber)]" /> writing src/middleware/auth.ts</div>,
    <div key="w2" className="text-xs font-mono text-muted flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-[var(--mk-amber)]" /> writing src/routes/users.ts</div>,
    <div key="b" className="max-w-[90%] rounded-2xl rounded-bl-md px-4 py-2.5 text-sm border border-[var(--mk-line-2)] bg-surface text-foreground">Done. I added the middleware, the route and a JWT helper, and committed them.</div>,
    <div key="j" className="text-xs font-mono text-emerald-400 flex items-center gap-2"><GitBranch className="h-3.5 w-3.5" /> committed · Jenkins build #2 running</div>,
  ];
  return (
    <div className="mk-card p-5 flex flex-col gap-3 min-h-[300px]">
      <div className="flex items-center gap-2 pb-3 border-b border-border text-sm font-semibold text-foreground">
        <span className="w-7 h-7 mk-icon"><Bot className="h-4 w-4" /></span>
        AI builder
        <span className="ml-auto text-[11px] font-normal text-muted">streams as it writes</span>
      </div>
      <AnimatePresence>
        {items.slice(0, Math.min(step + 1, items.length)).map((el) => (
          <motion.div key={el.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="flex flex-col">
            {el}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
const SELF_HOST = "https://github.com/rayanjainn/duckops#getting-started-local";
export default function LandingPage() {
  const backend = useBackendStatus();
  const offline = backend === "offline";
  const primaryHref = offline ? SELF_HOST : "/login";
  const primaryLabel = offline ? "Run it yourself" : "Start building";

  return (
    <div className="mk-page bg-surface text-foreground">
      <MarketingNav />

      {/* Hero */}
      <section className="pt-32 md:pt-40 pb-20 px-5">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.05fr_1fr] gap-14 items-center">
          <div>
            <Reveal>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mk-glass text-xs font-semibold text-muted-2">
                <span className={`mk-dot ${offline ? "off" : ""}`} />
                {backend === "online" ? "Platform online" : offline ? "Hosted platform paused · runs on your own machine" : "Internal developer platform"}
              </span>
            </Reveal>
            <Reveal delay={0.08}>
              <h1 className="mt-6 text-5xl md:text-[64px] font-bold tracking-tight leading-[1.03]">
                Pick a stack.<br />
                <span className="mk-grad">Get a live app.</span>
              </h1>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mt-6 text-lg text-muted-2 max-w-xl leading-relaxed">
                DuckOps scaffolds the code, creates the GitHub repo, deploys it to Kubernetes, wires a Jenkins pipeline and starts health checks. Every stage streams live to your dashboard. No YAML to write, no glue to maintain.
              </p>
            </Reveal>
            <Reveal delay={0.24}>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={primaryHref} className="mk-btn inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm">
                  <Rocket className="h-4 w-4" /> {primaryLabel}
                </Link>
                <Link href="#pipeline" className="mk-ghost inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm">
                  How it works <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              {offline && (
                <p className="mt-4 text-xs text-muted max-w-md">
                  The hosted servers are switched off at the moment, so sign-in is paused. Everything on this page still works, and you can run the whole platform locally.
                </p>
              )}
            </Reveal>
          </div>
          <Reveal from="right" delay={0.2} className="mk-float">
            <WizardDemo />
          </Reveal>
        </div>
      </section>

      <div className="mk-marquee border-y border-[var(--mk-line)] py-4" aria-hidden="true">
        <div className="mk-marquee-track">
          {[...MARQUEE, ...MARQUEE].map((m, i) => (
            <span key={`${m}-${i}`} className="inline-flex items-center gap-10 mk-mono text-sm text-muted whitespace-nowrap">
              {m}
              <span className="text-[var(--mk-line-2)]">/</span>
            </span>
          ))}
        </div>
      </div>

      {/* Pipeline */}
      <section id="pipeline" className="py-28 px-5 scroll-mt-20">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center max-w-2xl mx-auto mb-14">
            <span className="mk-eyebrow">How it works</span>
            <h2 className="mt-4 text-4xl md:text-5xl font-bold tracking-tight">Eight stations. One project.</h2>
            <p className="mt-4 text-muted-2 text-lg">Think of DuckOps as a transfer line. Your project rides it from station to station, and each one does a real job before the lamp turns green.</p>
          </Reveal>
          <Reveal from="zoom">
            <PipelineFigure />
          </Reveal>
          <div className="mt-14 grid md:grid-cols-[1fr_1.1fr] gap-8 items-center">
            <Reveal from="left">
              <div className="grid sm:grid-cols-2 gap-3">
                {STAGES.map((s, i) => (
                  <div key={s.name} className="mk-card p-4">
                    <div className="flex items-center gap-2">
                      <span className="mk-mono text-[11px] text-muted w-5">0{i + 1}</span>
                      <span className="font-semibold text-sm">{s.name}</span>
                    </div>
                    <p className="mt-2 text-xs text-muted-2">{s.detail}</p>
                  </div>
                ))}
              </div>
            </Reveal>
            <Reveal from="right">
              <LiveLog />
            </Reveal>
          </div>
        </div>
      </section>

      {/* Stacks */}
      <section id="stacks" className="py-28 px-5 border-t border-[var(--mk-line)] scroll-mt-20">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center max-w-2xl mx-auto mb-14">
            <span className="mk-eyebrow">Stacks</span>
            <h2 className="mt-4 text-4xl md:text-5xl font-bold tracking-tight">Production-ready from the first commit.</h2>
            <p className="mt-4 text-muted-2 text-lg">Choose a framework, a language and an ORM. Every template ships with a landing page that shows the API status and its routes.</p>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {STACKS.map((s, i) => (
              <Reveal key={s.name} delay={i * 0.07}>
                <div className="mk-card p-6 h-full">
                  <div className="flex items-center justify-between">
                    <span className="w-10 h-10 mk-icon"><s.icon className="h-[18px] w-[18px]" /></span>
                    <span className="mk-mono text-[11px] text-muted">{s.kind.toLowerCase()}</span>
                  </div>
                  <h3 className="mt-5 text-xl font-bold">{s.name}</h3>
                  <p className="mt-2 text-sm text-muted-2">{s.meta}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SHIPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.08}>
                <div className="p-5 rounded-2xl border border-[var(--mk-line)] h-full">
                  <s.icon className="h-5 w-5 text-muted-2" />
                  <p className="mt-3 font-semibold">{s.title}</p>
                  <p className="mt-1 text-sm text-muted-2">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* AI builder */}
      <section id="ai" className="py-28 px-5 border-t border-[var(--mk-line)] scroll-mt-20">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-14 items-center">
          <Reveal from="left">
            <span className="mk-eyebrow">AI builder</span>
            <h2 className="mt-4 text-4xl md:text-5xl font-bold tracking-tight">Describe a change. Watch it ship.</h2>
            <p className="mt-4 text-muted-2 text-lg">Ask for a feature in plain words. The AI service writes the code into your repo, streaming as it goes, and the commit goes through the same Jenkins pipeline as yours. Give it a first prompt when you create a project and it runs once the app is live.</p>
          </Reveal>
          <Reveal from="right">
            <AiDemo />
          </Reveal>
        </div>
      </section>

      {/* Architecture */}
      <section id="architecture" className="py-28 px-5 border-t border-[var(--mk-line)] scroll-mt-20">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center max-w-2xl mx-auto mb-12">
            <span className="mk-eyebrow">Architecture</span>
            <h2 className="mt-4 text-4xl md:text-5xl font-bold tracking-tight">Five small services, one gateway.</h2>
            <p className="mt-4 text-muted-2 text-lg">A TypeScript monorepo. The provisioning service runs a BullMQ queue that survives restarts and retries on failure, and drives GitHub, Terraform, Ansible and Jenkins.</p>
          </Reveal>
          <Reveal from="zoom">
            <div className="mk-card p-4 md:p-8">
              <Architecture />
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="py-28 px-5 border-t border-[var(--mk-line)]">
        <Reveal from="zoom">
          <div className="max-w-4xl mx-auto mk-card p-10 md:p-14 text-center relative overflow-hidden">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              Deploy in minutes.<br />
              <span className="mk-grad">Not days.</span>
            </h2>
            <p className="mt-5 text-muted-2">
              {offline ? "Run DuckOps on your own machine with one setup script." : "Sign in with GitHub and get your first project running on Kubernetes."}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href={primaryHref} className="mk-btn inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-sm">
                <Rocket className="h-4 w-4" /> {primaryLabel}
              </Link>
              <a href="https://github.com/rayanjainn/duckops" className="mk-ghost inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm">
                Source on GitHub <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </Reveal>
      </section>

      <MarketingFooter />
    </div>
  );
}
