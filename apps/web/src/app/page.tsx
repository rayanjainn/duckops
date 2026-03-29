import Link from "next/link";
import {
  GitBranch, Server, Zap, Activity, Package,
  ArrowRight, CheckCircle2, Terminal, Shield,
} from "lucide-react";

const PIPELINE_STEPS = [
  { label: "Initialize", desc: "Project registered, socket channel opened" },
  { label: "Scaffold", desc: "App code, Dockerfile, K8s manifests generated" },
  { label: "Repository", desc: "GitHub repo created, code pushed" },
  { label: "Provision", desc: "Docker image built, Terraform runs K8s namespace" },
  { label: "Configure", desc: "Ansible deploys to cluster, ingress created" },
  { label: "Pipeline", desc: "Jenkins job created with SCM polling" },
  { label: "Running", desc: "App live, health checks every 30s" },
];

const STACK_ROWS = [
  { label: "Backend", items: [{ name: "Express 5", sub: "Node.js" }, { name: "Fastify 5", sub: "Node.js" }] },
  { label: "Frontend", items: [{ name: "React 18", sub: "Vite" }, { name: "Vue 3", sub: "Vite" }, { name: "Next.js 15", sub: "App Router" }] },
  { label: "Database", items: [{ name: "PostgreSQL 16", sub: "Relational" }, { name: "MySQL 8.4", sub: "Relational" }] },
  { label: "ORM", items: [{ name: "Prisma 6", sub: "TypeScript" }, { name: "Drizzle", sub: "Lightweight" }, { name: "Raw SQL", sub: "pg driver" }] },
];

const FEATURES = [
  { icon: GitBranch, title: "Automated Scaffolding", desc: "Generates production-ready code, Dockerfiles, K8s manifests, and a Jenkinsfile from battle-tested Handlebars templates." },
  { icon: Server, title: "Kubernetes Provisioning", desc: "Terraform creates namespaces and ConfigMaps. Ansible deploys manifests and wires Traefik ingress automatically." },
  { icon: Zap, title: "Jenkins CI/CD", desc: "A pipeline job is created for every project. SCM polling triggers builds on every push — checkout, test, build, push, deploy." },
  { icon: Activity, title: "Health Monitoring", desc: "The health service pings every project's /health endpoint every 30 seconds and surfaces degradation in real time." },
  { icon: Package, title: "Container Registry", desc: "Images are built and pushed to a local k3d registry. Kubernetes pulls from it directly — no external registry needed." },
  { icon: Shield, title: "GitHub OAuth", desc: "GitHub OAuth authentication gates every action. Tokens are stored in Jenkins' credential store so pipelines can clone privately." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface text-foreground">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/80 bg-surface/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-600 flex items-center justify-center">
              <GitBranch className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-bold text-foreground">DuckOps</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-muted-2 hover:text-white transition-colors">Sign in</Link>
            <Link href="/login" className="text-sm bg-amber-600 hover:bg-amber-500 text-white px-4 py-1.5 rounded-lg font-medium transition-colors">Get started</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Internal Developer Platform
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-foreground leading-tight">
            From stack selection<br />to <span className="gradient-text">production</span> in minutes
          </h1>
          <p className="text-lg text-muted-2 max-w-2xl mx-auto leading-relaxed">
            DuckOps is a self-hosted IDP that scaffolds your project, pushes it to GitHub, provisions a Kubernetes namespace, deploys the container, and wires up a full Jenkins CI/CD pipeline — all from a single form.
          </p>
          <div className="flex items-center justify-center gap-4 pt-2">
            <Link href="/login" className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-amber-900/30">
              Create a project <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/dashboard" className="flex items-center gap-2 border border-border-2 hover:border-muted text-muted-2 hover:text-white px-6 py-3 rounded-xl font-semibold text-sm transition-colors">
              View dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* Pipeline */}
      <section className="py-20 px-6 border-y border-border">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-foreground">7 stages. Fully automated.</h2>
            <p className="text-muted-2 text-sm mt-2">Every project goes through the same verified provisioning pipeline</p>
          </div>
          <div className="flex flex-wrap items-start justify-center gap-2">
            {PIPELINE_STEPS.map((step, i) => (
              <div key={step.label} className="flex items-start gap-2">
                <div className="flex flex-col items-center gap-2 w-28 text-center">
                  <div className="w-8 h-8 rounded-full bg-surface-3 border border-border-2 flex items-center justify-center text-xs font-bold text-muted-2">{i + 1}</div>
                  <p className="text-xs font-semibold text-foreground">{step.label}</p>
                  <p className="text-xs text-muted leading-relaxed">{step.desc}</p>
                </div>
                {i < PIPELINE_STEPS.length - 1 && <ArrowRight className="h-4 w-4 text-muted mt-2 shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-foreground">Everything included</h2>
            <p className="text-muted-2 text-sm mt-2">No plugins to configure. No YAML to write. No glue code.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-5 rounded-xl border border-border bg-surface hover:border-border-2 transition-all">
                <div className="w-9 h-9 rounded-lg bg-amber-600/10 border border-amber-500/20 flex items-center justify-center mb-3">
                  <Icon className="h-4 w-4 text-amber-400" />
                </div>
                <h3 className="font-semibold text-foreground text-sm mb-1.5">{title}</h3>
                <p className="text-xs text-muted leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stacks */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-foreground">Supported stacks</h2>
            <p className="text-muted-2 text-sm mt-2">More being added regularly</p>
          </div>
          <div className="space-y-4">
            {STACK_ROWS.map(({ label, items }) => (
              <div key={label} className="flex items-center gap-4">
                <div className="w-20 text-xs font-semibold text-muted shrink-0 text-right">{label}</div>
                <div className="flex flex-wrap gap-2">
                  {items.map(({ name, sub }) => (
                    <div key={name} className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span className="text-xs font-medium text-foreground">{name}</span>
                      <span className="text-xs text-muted">{sub}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech used */}
      <section className="py-20 px-6 border-t border-border bg-surface/30">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-2xl font-bold text-foreground">Built with</h2>
          <div className="flex flex-wrap justify-center gap-3 text-xs font-medium">
            {["Next.js 15","Express 5","TypeScript 5.7","Prisma 6","PostgreSQL 16","Turborepo","pnpm workspaces","k3d","Terraform","Ansible","Jenkins","Docker","Tailwind CSS 4","Socket.io","Recharts","React Flow"].map((tech) => (
              <span key={tech} className="px-3 py-1.5 bg-surface-3 border border-border-2 rounded-lg text-muted-2">{tech}</span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <h2 className="text-3xl font-bold text-foreground">Ready to deploy your next project?</h2>
          <p className="text-muted-2">Sign in with GitHub and have your first project running on Kubernetes in under a minute.</p>
          <Link href="/login" className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white px-8 py-3 rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-amber-900/30">
            <Terminal className="h-4 w-4" /> Get started
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-xs text-muted">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-amber-600/20 flex items-center justify-center">
              <GitBranch className="h-3 w-3 text-amber-500" />
            </div>
            <span>DuckOps</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="hover:text-muted-2 transition-colors">Dashboard</Link>
            <Link href="/templates" className="hover:text-muted-2 transition-colors">Templates</Link>
            <Link href="/projects" className="hover:text-muted-2 transition-colors">Projects</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
