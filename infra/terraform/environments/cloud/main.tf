terraform {
  required_providers {
    oci = {
      source  = "oracle/oci"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.35"
    }
  }
}

provider "oci" {
  tenancy_ocid     = var.tenancy_ocid
  user_ocid        = var.user_ocid
  fingerprint      = var.fingerprint
  private_key_path = var.private_key_path
  region           = var.region
}

provider "kubernetes" {
  config_path    = "~/.kube/config"
  config_context = var.k8s_context
}

variable "tenancy_ocid"     { type = string }
variable "user_ocid"        { type = string }
variable "fingerprint"      { type = string }
variable "private_key_path" { type = string }
variable "region"           { type = string; default = "ap-mumbai-1" }
variable "k8s_context"      { type = string; default = "default" }
variable "project_name"     { type = string }
variable "namespace"        { type = string }
variable "database"         { type = string; default = "postgresql" }

resource "kubernetes_namespace" "project" {
  metadata {
    name   = var.namespace
    labels = { "managed-by" = "duckops", "project-name" = var.project_name }
  }
}

output "namespace" { value = kubernetes_namespace.project.metadata[0].name }
