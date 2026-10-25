"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GitBranch, Moon, Sun, Github } from "lucide-react";

export const REPO = "rayanjainn/duckops";

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span
      className="mk-logo inline-flex items-center justify-center rounded-[10px] shrink-0"
      style={{ width: size, height: size }}
    >
      <GitBranch className="text-white" style={{ width: size * 0.5, height: size * 0.5 }} />
    </span>
  );
}

function ThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => setLight(document.documentElement.getAttribute("data-theme") === "light"), []);
  const flip = () => {
    const next = light ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Private mode: the choice lasts for this page view.
    }
    setLight(!light);
  };
  return (
    <button
      type="button"
      onClick={flip}
      aria-label={`Switch to ${light ? "dark" : "light"} theme`}
      className="w-9 h-9 grid place-items-center rounded-lg border border-border text-muted-2 hover:text-foreground transition-colors"
    >
      {light ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  );
}

export function MarketingNav() {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 mk-glass border-b border-border/60">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2.5 font-bold text-foreground">
          <Logo size={30} />
          DuckOps
        </Link>
        <div className="hidden md:flex items-center gap-1 text-sm text-muted-2">
          <Link href="/#pipeline" className="px-3 py-1.5 rounded-lg hover:text-foreground hover:bg-white/5 transition-colors">How it works</Link>
          <Link href="/#stacks" className="px-3 py-1.5 rounded-lg hover:text-foreground hover:bg-white/5 transition-colors">Stacks</Link>
          <Link href="/#architecture" className="px-3 py-1.5 rounded-lg hover:text-foreground hover:bg-white/5 transition-colors">Architecture</Link>
          <Link href="/#ai" className="px-3 py-1.5 rounded-lg hover:text-foreground hover:bg-white/5 transition-colors">AI builder</Link>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <a href={`https://github.com/${REPO}`} aria-label="Source on GitHub" className="hidden sm:grid w-9 h-9 place-items-center rounded-lg border border-border text-muted-2 hover:text-foreground transition-colors">
            <Github className="h-4 w-4" />
          </a>
          <ThemeToggle />
          <Link href="/login" className="mk-btn text-sm px-4 py-2 rounded-lg font-semibold">
            Sign in
          </Link>
        </div>
      </div>
    </nav>
  );
}

export function MarketingFooter() {
  return (
    <footer className="relative border-t border-border mt-10">
      <div className="max-w-6xl mx-auto px-5 py-12 grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr] text-sm">
        <div className="space-y-3">
          <div className="flex items-center gap-2.5 font-bold text-foreground">
            <Logo size={28} /> DuckOps
          </div>
          <p className="text-muted-2 max-w-xs">
            An internal developer platform: pick a stack, get a deployed, monitored, CI/CD-wired app.
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-muted">Product</p>
          <Link href="/#pipeline" className="block text-muted-2 hover:text-foreground">How it works</Link>
          <Link href="/#stacks" className="block text-muted-2 hover:text-foreground">Stacks</Link>
          <Link href="/login" className="block text-muted-2 hover:text-foreground">Sign in</Link>
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-muted">Learn</p>
          <Link href="/#architecture" className="block text-muted-2 hover:text-foreground">Architecture</Link>
          <a href="https://github.com/rayanjainn/duckops#getting-started-local" className="block text-muted-2 hover:text-foreground">Run it yourself</a>
          <a href="https://github.com/rayanjainn/duckops/blob/main/DEPLOYMENT.md" className="block text-muted-2 hover:text-foreground">Deployment guide</a>
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-muted">Source</p>
          <a href={`https://github.com/${REPO}`} className="block text-muted-2 hover:text-foreground">GitHub</a>
          <a href={`https://github.com/${REPO}/blob/main/LICENCE.md`} className="block text-muted-2 hover:text-foreground">Licence</a>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-5 pb-10 text-xs text-muted">
        © 2026 Rayan Jain. DuckOps is source-available under the Rayan Jain Proprietary License.
      </div>
    </footer>
  );
}

/** Slow coloured lights behind the marketing pages. */
export function Aurora() {
  return (
    <div className="mk-aurora" aria-hidden="true">
      <i />
      <i />
      <i />
    </div>
  );
}
