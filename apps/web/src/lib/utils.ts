import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ProjectStatus } from "@duckops/shared-types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function getStatusColor(status: ProjectStatus): string {
  const colors: Record<ProjectStatus, string> = {
    INITIALIZING: "bg-gray-500",
    SCAFFOLDING: "bg-blue-500",
    PROVISIONING: "bg-purple-500",
    CONFIGURING: "bg-indigo-500",
    CREATING_REPO: "bg-orange-500",
    PIPELINE_READY: "bg-cyan-500",
    DEPLOYING: "bg-yellow-500",
    RUNNING: "bg-green-500",
    DEGRADED: "bg-orange-500",
    STOPPED: "bg-gray-400",
    FAILED: "bg-red-500",
  };
  return colors[status] || "bg-gray-500";
}

export function getStatusLabel(status: ProjectStatus): string {
  return status
    .split("_")
    .map((w) => w[0] + w.slice(1).toLowerCase())
    .join(" ");
}

export function isActiveStatus(status: ProjectStatus): boolean {
  return ["INITIALIZING", "SCAFFOLDING", "PROVISIONING", "CONFIGURING", "CREATING_REPO", "PIPELINE_READY", "DEPLOYING"].includes(status);
}
