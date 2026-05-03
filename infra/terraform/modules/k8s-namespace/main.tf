variable "name" { type = string }
variable "labels" {
  type    = map(string)
  default = {}
}

resource "kubernetes_namespace" "this" {
  metadata {
    name   = var.name
    labels = merge({ "managed-by" = "duckops" }, var.labels)
  }
}

output "name" { value = kubernetes_namespace.this.metadata[0].name }
