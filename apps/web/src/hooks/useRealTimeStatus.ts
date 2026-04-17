"use client";

import { useEffect, useState } from "react";
import { getSocket } from "@/lib/socket";
import type { ProjectStatusEvent, HealthCheckEvent } from "@duckops/shared-types";

export function useRealTimeStatus(projectId: string | null) {
  const [status, setStatus] = useState<ProjectStatusEvent | null>(null);
  const [health, setHealth] = useState<HealthCheckEvent | null>(null);
  const [subStep, setSubStep] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const socket = getSocket();

    const onStatus = (data: ProjectStatusEvent) => {
      setStatus(data);
      setSubStep(data.subStep ?? null);
    };
    const onHealth = (data: HealthCheckEvent) => setHealth(data);

    socket.on(`project:${projectId}`, onStatus);
    socket.on(`project:${projectId}:health`, onHealth);

    return () => {
      socket.off(`project:${projectId}`, onStatus);
      socket.off(`project:${projectId}:health`, onHealth);
    };
  }, [projectId]);

  return { status, health, subStep };
}
