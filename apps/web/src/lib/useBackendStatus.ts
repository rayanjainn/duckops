"use client";

import { useEffect, useState } from "react";

export type BackendStatus = "checking" | "online" | "offline";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4002";
let cached: { status: BackendStatus; at: number } | null = null;

/**
 * Whether the DuckOps API answers its /health check. The marketing pages work
 * either way; when it is offline they point people at running DuckOps
 * themselves instead of at a sign-in that would fail.
 */
export function useBackendStatus(): BackendStatus {
  const [status, setStatus] = useState<BackendStatus>(cached && Date.now() - cached.at < 60_000 ? cached.status : "checking");

  useEffect(() => {
    if (cached && Date.now() - cached.at < 60_000) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    fetch(`${API_URL}/health`, { signal: controller.signal, cache: "no-store" })
      .then((res) => (res.ok ? "online" : "offline"))
      .catch(() => "offline" as const)
      .then((next) => {
        cached = { status: next, at: Date.now() };
        setStatus(next);
      })
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  return status;
}
