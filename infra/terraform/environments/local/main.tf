terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.35"
    }
  }
}

provider "kubernetes" {
  config_path    = "~/.kube/config"
  config_context = "k3d-duckops"
}

# ─── Variables ──────────────────────────────────────────────────
variable "project_name" {
  description = "Name of the project to provision"
  type        = string
}

variable "namespace" {
  description = "Kubernetes namespace for the project"
  type        = string
}

variable "database" {
  description = "Database type (postgresql, mysql)"
  type        = string
  default     = "postgresql"
}

# ─── Namespace ──────────────────────────────────────────────────
resource "kubernetes_namespace" "project" {
  metadata {
    name = var.namespace
    labels = {
      "managed-by"   = "duckops"
      "project-name" = var.project_name
    }
  }
}

# ─── ConfigMap (shared config) ───────────────────────────────────
resource "kubernetes_config_map" "project_config" {
  metadata {
    name      = "${var.project_name}-config"
    namespace = kubernetes_namespace.project.metadata[0].name
  }

  data = {
    PROJECT_NAME = var.project_name
    DATABASE     = var.database
    NAMESPACE    = var.namespace
  }
}

# ─── Outputs ────────────────────────────────────────────────────
output "namespace" {
  value = kubernetes_namespace.project.metadata[0].name
}

output "project_name" {
  value = var.project_name
}
