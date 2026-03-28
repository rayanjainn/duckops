variable "name"      { type = string }
variable "namespace" { type = string }
variable "image"     { type = string }
variable "port"      { type = number; default = 3000 }
variable "replicas"  { type = number; default = 1 }
variable "env"       { type = map(string); default = {} }

resource "kubernetes_deployment" "this" {
  metadata {
    name      = var.name
    namespace = var.namespace
    labels    = { app = var.name }
  }
  spec {
    replicas = var.replicas
    selector { match_labels = { app = var.name } }
    template {
      metadata { labels = { app = var.name } }
      spec {
        container {
          name  = var.name
          image = var.image
          port { container_port = var.port }
          dynamic "env" {
            for_each = var.env
            content {
              name  = env.key
              value = env.value
            }
          }
          readiness_probe {
            http_get { path = "/health"; port = var.port }
            initial_delay_seconds = 5
            period_seconds        = 10
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "this" {
  metadata { name = var.name; namespace = var.namespace }
  spec {
    selector = { app = var.name }
    port { port = 80; target_port = var.port }
    type = "ClusterIP"
  }
}
