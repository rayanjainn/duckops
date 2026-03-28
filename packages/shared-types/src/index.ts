// ─── Enums ──────────────────────────────────────────────────────

export type ProjectStatus =
  | "INITIALIZING"
  | "SCAFFOLDING"
  | "PROVISIONING"
  | "CONFIGURING"
  | "PIPELINE_READY"
  | "DEPLOYING"
  | "RUNNING"
  | "DEGRADED"
  | "STOPPED"
  | "FAILED";

export type PipelineStatus = "CREATING" | "ACTIVE" | "PAUSED" | "FAILED";

export type DeploymentStatus =
  | "PENDING"
  | "BUILDING"
  | "PUSHING"
  | "DEPLOYING"
  | "SUCCESS"
  | "FAILED"
  | "ROLLED_BACK";

export type HealthStatus = "HEALTHY" | "UNHEALTHY" | "TIMEOUT" | "UNKNOWN";

export type Layer = "LANGUAGE" | "FRAMEWORK" | "DATABASE" | "ORM";

export type Role = "ADMIN" | "DEVELOPER";

// ─── Models ─────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateOption {
  id: string;
  layer: Layer;
  name: string;
  displayName: string;
  description?: string;
  icon?: string;
  version: string;
  compatibleWith: Record<string, string[]>;
  isActive: boolean;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  language: string;
  framework: string;
  database: string;
  orm: string;
  status: ProjectStatus;
  statusMessage?: string;
  namespace?: string;
  liveUrl?: string;
  internalPort?: number;
  externalPort?: number;
  githubRepoUrl?: string;
  githubRepoName?: string;
  githubRepoFullName?: string;
  userId: string;
  pipeline?: Pipeline;
  deployments?: Deployment[];
  healthChecks?: HealthCheck[];
  createdAt: string;
  updatedAt: string;
}

export interface Pipeline {
  id: string;
  projectId: string;
  jenkinsJobName: string;
  jenkinsJobUrl?: string;
  gitRepoUrl?: string;
  branch: string;
  status: PipelineStatus;
  lastBuildNumber?: number;
  lastBuildStatus?: string;
  lastBuildAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Deployment {
  id: string;
  projectId: string;
  version: string;
  imageTag: string;
  status: DeploymentStatus;
  triggeredBy: string;
  buildLogs?: string;
  deployLogs?: string;
  startedAt: string;
  completedAt?: string;
}

export interface HealthCheck {
  id: string;
  projectId: string;
  status: HealthStatus;
  responseTime?: number;
  statusCode?: number;
  message?: string;
  checkedAt: string;
}

// ─── API Request/Response types ─────────────────────────────────

export interface CreateProjectInput {
  name: string;
  displayName: string;
  description?: string;
  language: string;
  framework: string;
  database: string;
  orm: string;
}

export interface CreateProjectResponse {
  project: Project;
}

export interface GroupedTemplateOptions {
  LANGUAGE?: TemplateOption[];
  FRAMEWORK?: TemplateOption[];
  DATABASE?: TemplateOption[];
  ORM?: TemplateOption[];
}

// ─── Socket.io event payloads ───────────────────────────────────

export interface ProjectStatusEvent {
  status: ProjectStatus;
  message: string;
}

export interface HealthCheckEvent {
  status: HealthStatus;
  responseTime: number;
  statusCode?: number;
  message?: string;
  checkedAt: string;
}

// ─── API error response ─────────────────────────────────────────

export interface ApiError {
  error: string;
  details?: unknown;
}
