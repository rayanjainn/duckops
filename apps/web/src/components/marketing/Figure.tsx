"use client";

import { memo, useEffect, useRef } from "react";
import { DUCKOPS_LINE_FIGURE } from "./figureMarkup";

declare global {
  interface Window {
    isoMount?: Record<string, () => void>;
  }
}

function load(src: string): Promise<void> {
  const existing = document.querySelector<HTMLScriptElement>(`script[data-src="${src}"]`);
  if (existing) return existing.dataset.ready ? Promise.resolve() : new Promise((r) => existing.addEventListener("load", () => r()));
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = src;
    s.dataset.src = src;
    s.addEventListener("load", () => {
      s.dataset.ready = "1";
      resolve();
    });
    document.body.appendChild(s);
  });
}

/**
 * The isometric transfer line, drawn by figures/build.mjs and brought to life
 * by its own script. React owns only the empty host: the markup is inserted
 * once here, so a re-render of the page can never swap out the running figure.
 */
export const PipelineFigure = memo(function PipelineFigure() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    if (!el.firstElementChild) el.innerHTML = DUCKOPS_LINE_FIGURE;
    let cancelled = false;
    load("/figures/iso-kit.js")
      .then(() => load("/figures/duckops-line.js"))
      .then(() => {
        if (!cancelled) window.isoMount?.["duckops-line"]?.();
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <>
      <link rel="stylesheet" href="/figures/iso.css" />
      <link rel="stylesheet" href="/figures/duckops-line.css" />
      <div ref={host} className="mk-fig" style={{ minHeight: 320 }} />
    </>
  );
});
