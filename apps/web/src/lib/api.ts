import axios from "axios";
import type {
  CreateProjectInput,
  GroupedTemplateOptions,
  Project,
  Pipeline,
} from "@duckops/shared-types";
import { getToken, clearSession } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4002";
const PIPELINE_BASE = process.env.NEXT_PUBLIC_PIPELINE_URL || "http://localhost:4003";
const CATALOG_BASE = process.env.NEXT_PUBLIC_CATALOG_URL || "http://localhost:4001";

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle errors globally — redirect to login on 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearSession();
      window.location.href = "/login";
    }
    const message =
      error.response?.data?.error || error.message || "Unknown error";
    return Promise.reject(new Error(message));
  },
);

const catalogApi = axios.create({ baseURL: CATALOG_BASE });

export const templateApi = {
  getAll: (): Promise<GroupedTemplateOptions> =>
    catalogApi.get("/api/templates").then((r) => r.data),

  getCompatible: (params: Record<string, string>): Promise<GroupedTemplateOptions> =>
    catalogApi.get("/api/templates/compatible", { params }).then((r) => r.data),
};

export const projectApi = {
  create: (data: CreateProjectInput): Promise<Project> =>
    api.post("/api/projects", data).then((r) => r.data),

  getAll: (): Promise<Project[]> =>
    api.get("/api/projects").then((r) => r.data),

  getById: (id: string): Promise<Project> =>
    api.get(`/api/projects/${id}`).then((r) => r.data),

  delete: (id: string): Promise<void> =>
    api.delete(`/api/projects/${id}`).then(() => undefined),

  retry: (id: string): Promise<Project> =>
    api.post(`/api/projects/${id}/retry`).then((r) => r.data),
};

export const healthApi = {
  getHealth: (projectId: string) =>
    api.get(`/api/health/${projectId}`).then((r) => r.data),

  getLogs: (projectId: string, lines?: number) =>
    api
      .get(`/api/logs/${projectId}`, { params: { lines } })
      .then((r) => r.data),
};

export const pipelineApi = {
  create: (data: { projectId: string; gitRepoUrl: string; branch?: string }): Promise<Pipeline> =>
    api.post("/api/pipelines", data).then((r) => r.data),

  getByProject: (projectId: string): Promise<Pipeline | null> =>
    api.get(`/api/pipelines/project/${projectId}`).then((r) => r.data),

  triggerBuild: (pipelineId: string) =>
    api.post(`/api/pipelines/${pipelineId}/build`).then((r) => r.data),

  snapshot: (projectId: string): Promise<LiveBuildInfo | null> =>
    axios.get(`${PIPELINE_BASE}/api/pipelines/project/${projectId}/snapshot`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    }).then((r) => r.data),

  liveUrl: (projectId: string): string =>
    `${PIPELINE_BASE}/api/pipelines/project/${projectId}/live`,
};

export interface BuildStage {
  id: string;
  name: string;
  status: "IN_PROGRESS" | "SUCCESS" | "FAILED" | "NOT_EXECUTED" | "PAUSED";
  durationMillis: number;
}

export interface LiveBuildInfo {
  building: boolean;
  number: number | null;
  result: string | null;
  url: string | null;
  stages: BuildStage[];
  consoleLines: string[];
  estimatedDurationMs: number;
  durationMs: number;
  error?: string;
}
