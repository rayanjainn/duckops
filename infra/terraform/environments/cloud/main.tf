terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.35"
    }
  }
}

# K3s on EC2 — kubeconfig is at ~/.kube/config on the EC2 host.
# Terraform runs on EC2 (called by provisioning-service via SSH or directly when DEPLOY_MODE=cloud).
provider "kubernetes" {
  config_path    = "~/.kube/config"
  config_context = var.k8s_context
}

variable "k8s_context" {
  type    = string
  default = "default"
}

variable "project_name" {
  description = "Name of the project to provision"
  type        = string
}

variable "namespace" {
  description = "Kubernetes namespace — format: {github}-{project} in cloud"
  type        = string
}

variable "database" {
  description = "Database type (postgresql, mysql, none)"
  type        = string
  default     = "postgresql"
}

variable "database_url" {
  description = "Full database connection string (passed from Neon.tech or other provider)"
  type        = string
  default     = ""
  sensitive   = true
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

# ─── ConfigMap (shared config available to all pods in the namespace) ────────
resource "kubernetes_config_map" "project_config" {
  metadata {
    name      = "${var.project_name}-config"
    namespace = kubernetes_namespace.project.metadata[0].name
  }

  data = {
    PROJECT_NAME = var.project_name
    DATABASE     = var.database
    NAMESPACE    = var.namespace
    DATABASE_URL = var.database_url
  }
}

# ─── Outputs ────────────────────────────────────────────────────
output "namespace" {
  value = kubernetes_namespace.project.metadata[0].name
}

output "project_name" {
  value = var.project_name
}
