"use client";

import { useEffect } from "react";
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

/** The isometric transfer line, drawn by figures/build.mjs, brought to life by its own script. */
export function PipelineFigure() {
  useEffect(() => {
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
      <div className="mk-fig" dangerouslySetInnerHTML={{ __html: DUCKOPS_LINE_FIGURE }} />
    </>
  );
}
