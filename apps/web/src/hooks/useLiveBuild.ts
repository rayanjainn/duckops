"use client";

import { useEffect, useRef, useState } from "react";
import { pipelineApi, type LiveBuildInfo } from "@/lib/api";

export function useLiveBuild(projectId: string | null) {
  const [data, setData] = useState<LiveBuildInfo | null>(null);
  const [connected, setConnected] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const esRef = useRef<EventSource | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!projectId) return;

    // liveUrl() already appends ?token=... — don't add it again
    const url = pipelineApi.liveUrl(projectId);
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setConnected(true);

    es.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data) as LiveBuildInfo;
        setData(parsed);
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
      esRef.current = null;
      // Retry in 5s by bumping retryCount, which re-runs this effect
      retryTimer.current = setTimeout(() => setRetryCount((n) => n + 1), 5000);
    };

    return () => {
      es.close();
      esRef.current = null;
      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
        retryTimer.current = null;
      }
    };
  }, [projectId, retryCount]);

  return { data, connected };
}
