"use client";

import { useEffect, useRef, useState } from "react";
import { pipelineApi, type LiveBuildInfo } from "@/lib/api";
import { getToken } from "@/lib/auth";

export function useLiveBuild(projectId: string | null) {
  const [data, setData] = useState<LiveBuildInfo | null>(null);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const token = getToken();
    // EventSource doesn't support headers — pass token as query param
    const url = `${pipelineApi.liveUrl(projectId)}${token ? `?token=${token}` : ""}`;
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
      // Retry after 5s
      setTimeout(() => {
        if (esRef.current === es) {
          esRef.current = null;
          setConnected(false);
        }
      }, 5000);
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [projectId]);

  return { data, connected };
}
