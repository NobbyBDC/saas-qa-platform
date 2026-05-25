# =============================================================================
# S3 Buckets
# =============================================================================
resource "aws_s3_bucket" "assets" {
  bucket = "${var.app_name}-assets-${data.aws_caller_identity.current.account_id}"

  tags = { Name = "${var.app_name}-assets" }
}

resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id
  rule {
    id     = "expire-old-run-artifacts"
    status = "Enabled"
    filter { prefix = "runs/" }
    expiration { days = 90 }
  }
}

resource "aws_s3_bucket_cors_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id
  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = ["https://${var.domain_name}"]
    max_age_seconds = 3000
  }
}

# ECR Repositories
resource "aws_ecr_repository" "services" {
  for_each = toset(["api-gateway", "figma-service", "codegen-service", "testing-service", "security-service", "reporting-service", "web"])

  name                 = "qa-${each.key}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = { Name = "qa-${each.key}" }
}

resource "aws_ecr_lifecycle_policy" "services" {
  for_each   = aws_ecr_repository.services
  repository = each.value.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 10 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}
