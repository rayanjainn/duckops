import axios from "axios";
import type {
  CreateProjectInput,
  GroupedTemplateOptions,
  Project,
  Pipeline,
} from "@duckops/shared-types";
import { getToken, clearSession } from "@/lib/auth";

const API_BASE      = process.env.NEXT_PUBLIC_API_URL      || "http://localhost:4002";
const PIPELINE_BASE = process.env.NEXT_PUBLIC_PIPELINE_URL || "http://localhost:4003";
const CATALOG_BASE  = process.env.NEXT_PUBLIC_CATALOG_URL  || "http://localhost:4001";
const HEALTH_BASE   = process.env.NEXT_PUBLIC_HEALTH_URL   || "http://localhost:4004";
export const AI_BASE = process.env.NEXT_PUBLIC_AI_URL      || "http://localhost:4005";

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

const healthAxios = axios.create({ baseURL: HEALTH_BASE });
healthAxios.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const healthApi = {
  getHealth: (projectId: string) =>
    healthAxios.get(`/api/health/${projectId}`).then((r) => r.data),

  getLogs: (projectId: string, lines?: number) =>
    healthAxios
      .get(`/api/logs/${projectId}`, { params: { lines } })
      .then((r) => r.data),
};

export const platformApi = {
  getMetrics: () =>
    healthAxios.get("/api/platform/metrics").then((r) => r.data as {
      services: { name: string; label: string; port: number }[];
      metrics: { name: string; status: string; cpu: number; memoryBytes: number; restarts: number; uptime: number; pid: number }[];
    }),
  getHistory: (serviceName: string) =>
    healthAxios.get(`/api/platform/metrics/history/${serviceName}`).then((r) => r.data as { history: any[] }),
  logsUrl: (serviceName: string) =>
    `${HEALTH_BASE}/api/platform/logs/${serviceName}?token=${getToken()}`,
};

const pipelineAxios = axios.create({ baseURL: PIPELINE_BASE });
pipelineAxios.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const pipelineApi = {
  create: (data: { projectId: string; gitRepoUrl: string; branch?: string }): Promise<Pipeline> =>
    api.post("/api/pipelines", data).then((r) => r.data),

  getByProject: (projectId: string): Promise<Pipeline | null> =>
    pipelineAxios.get(`/api/pipelines/project/${projectId}`).then((r) => r.data),

  triggerBuild: (pipelineId: string) =>
    pipelineAxios.post(`/api/pipelines/${pipelineId}/build`).then((r) => r.data),

  syncDeployments: (projectId: string) =>
    pipelineAxios.post(`/api/pipelines/project/${projectId}/sync-deployments`).then((r) => r.data),

  snapshot: (projectId: string): Promise<LiveBuildInfo | null> =>
    pipelineAxios.get(`/api/pipelines/project/${projectId}/snapshot`).then((r) => r.data).catch(() => null),

  liveUrl: (projectId: string): string =>
    `${PIPELINE_BASE}/api/pipelines/project/${projectId}/live?token=${getToken()}`,
};

export const billingApi = {
  createCheckout: (): Promise<{ url: string }> =>
    api.post("/api/billing/checkout").then((r) => r.data),

  getPortal: (): Promise<{ url: string }> =>
    api.post("/api/billing/portal").then((r) => r.data),

  getStatus: (): Promise<{ plan: string; devMode: boolean; aiPromptsRemaining: number; aiPromptsResetAt: string; projectCount: number }> =>
    api.get("/api/billing/status").then((r) => r.data),

  toggleDevMode: (): Promise<{ devMode: boolean }> =>
    api.post("/api/billing/dev-mode").then((r) => r.data),
};

export const authApi = {
  me: () => api.get("/api/auth/me").then((r) => r.data),
  deleteAccount: () => api.delete("/api/auth/account").then(() => undefined),
};

export interface StackRecommendation {
  language: string;
  framework: string;
  database: string;
  orm: string;
  packageManager: string;
  reasoning: string;
}

const aiAxios = axios.create({ baseURL: AI_BASE });
aiAxios.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const aiApi = {
  recommendStack: (prompt: string): Promise<StackRecommendation> =>
    aiAxios.post(`/api/stack/recommend`, { prompt }).then((r) => r.data),

  getSessions: (projectId: string) =>
    aiAxios.get(`/api/generate/sessions/${projectId}`).then((r) => r.data),

  getMessages: (projectId: string, sessionId: string) =>
    aiAxios.get(`/api/generate/sessions/${projectId}/${sessionId}`).then((r) => r.data),
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
