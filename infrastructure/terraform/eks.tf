terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.27"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.13"
    }
  }
  backend "s3" {
    bucket         = "qa-platform-terraform-state"
    key            = "eks/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "qa-platform-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project     = "qa-platform"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# ───── EKS Cluster ─────
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = "qa-platform-${var.environment}"
  cluster_version = "1.30"

  vpc_id                   = module.vpc.vpc_id
  subnet_ids               = module.vpc.private_subnets
  cluster_endpoint_public_access  = true
  cluster_endpoint_private_access = true
  cluster_endpoint_public_access_cidrs = var.eks_public_access_cidrs

  # Encryption
  cluster_encryption_config = {
    resources        = ["secrets"]
    provider_key_arn = aws_kms_key.eks.arn
  }

  # Logging
  cluster_enabled_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]

  # Node groups
  eks_managed_node_groups = {
    system = {
      name            = "system"
      instance_types  = ["t3.medium"]
      min_size        = 2
      max_size        = 4
      desired_size    = 2
      disk_size       = 50
      labels          = { role = "system" }
      taints          = []
    }

    api_workers = {
      name            = "api-workers"
      instance_types  = ["c6i.xlarge", "c6a.xlarge"]
      capacity_type   = "ON_DEMAND"
      min_size        = 2
      max_size        = 20
      desired_size    = 3
      disk_size       = 100
      labels          = { role = "api" }
    }

    test_runners = {
      name            = "test-runners"
      instance_types  = ["m6i.2xlarge", "m6a.2xlarge"]
      capacity_type   = "SPOT"
      min_size        = 0
      max_size        = 50
      desired_size    = 2
      disk_size       = 200
      labels          = { role = "test-runner" }
      taints = [{
        key    = "dedicated"
        value  = "test-runner"
        effect = "NO_SCHEDULE"
      }]
    }
  }

  # Add-ons
  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
    }
    aws-ebs-csi-driver = {
      most_recent = true
    }
  }
}

# ───── KMS ─────
resource "aws_kms_key" "eks" {
  description             = "EKS cluster encryption key"
  deletion_window_in_days = 7
  enable_key_rotation     = true
}

# ───── IRSA: Load Balancer Controller ─────
module "lb_controller_irsa" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.39"

  role_name                              = "qa-platform-${var.environment}-lb-controller"
  attach_load_balancer_controller_policy = true

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:aws-load-balancer-controller"]
    }
  }
}

# ───── Helm: AWS Load Balancer Controller ─────
resource "helm_release" "aws_lb_controller" {
  depends_on = [module.eks]
  name       = "aws-load-balancer-controller"
  repository = "https://aws.github.io/eks-charts"
  chart      = "aws-load-balancer-controller"
  namespace  = "kube-system"
  version    = "1.7.2"

  set { name  = "clusterName"; value = module.eks.cluster_name }
  set { name  = "serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"; value = module.lb_controller_irsa.iam_role_arn }
}

# ───── Helm: KEDA (queue-based autoscaling) ─────
resource "helm_release" "keda" {
  depends_on = [module.eks]
  name       = "keda"
  repository = "https://kedacore.github.io/charts"
  chart      = "keda"
  namespace  = "keda"
  create_namespace = true
  version    = "2.14.0"
}

# ───── Helm: Prometheus + Grafana ─────
resource "helm_release" "prometheus_stack" {
  depends_on       = [module.eks]
  name             = "kube-prometheus-stack"
  repository       = "https://prometheus-community.github.io/helm-charts"
  chart            = "kube-prometheus-stack"
  namespace        = "monitoring"
  create_namespace = true
  version          = "58.4.0"

  values = [
    <<-EOT
    grafana:
      adminPassword: "${var.grafana_password}"
      ingress:
        enabled: true
        annotations:
          kubernetes.io/ingress.class: alb
        hosts:
          - grafana.${var.domain_name}
    prometheus:
      prometheusSpec:
        retention: 30d
        storageSpec:
          volumeClaimTemplate:
            spec:
              storageClassName: gp3
              resources:
                requests:
                  storage: 50Gi
    EOT
  ]
}

# ───── Cluster Autoscaler ─────
module "cluster_autoscaler_irsa" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.39"

  role_name                        = "qa-platform-${var.environment}-cluster-autoscaler"
  attach_cluster_autoscaler_policy = true
  cluster_autoscaler_cluster_names = [module.eks.cluster_name]

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:cluster-autoscaler"]
    }
  }
}

output "cluster_name" {
  value = module.eks.cluster_name
}

output "cluster_endpoint" {
  value     = module.eks.cluster_endpoint
  sensitive = true
}

output "configure_kubectl" {
  value = "aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_name}"
}
