variable "aws_region" {
  description = "AWS region to deploy to"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment (prod, staging)"
  type        = string
  default     = "prod"
}

variable "app_name" {
  description = "Application name"
  type        = string
  default     = "qa-platform"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "qaplatform"
}

variable "db_username" {
  description = "PostgreSQL master username"
  type        = string
  default     = "qaplatform"
  sensitive   = true
}

variable "db_password" {
  description = "PostgreSQL master password"
  type        = string
  sensitive   = true
}

variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "ecs_task_cpu" {
  description = "ECS task CPU units"
  type        = number
  default     = 512
}

variable "ecs_task_memory" {
  description = "ECS task memory (MB)"
  type        = number
  default     = 1024
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "your-domain.com"
}

variable "certificate_arn" {
  description = "ACM certificate ARN for HTTPS"
  type        = string
  default     = ""
}

variable "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  type        = string
  default     = ""
}

variable "cloudfront_secret" {
  description = "Secret header value for ALB origin protection"
  type        = string
  sensitive   = true
  default     = "change-me-in-production"
}

variable "grafana_password" {
  description = "Grafana admin password"
  type        = string
  sensitive   = true
  default     = "change-me-in-production"
}

variable "eks_public_access_cidrs" {
  description = "CIDRs allowed to access the EKS public API endpoint"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "db_multi_az" {
  description = "Enable RDS Multi-AZ"
  type        = bool
  default     = false
}
