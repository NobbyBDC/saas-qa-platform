# ───── CloudFront Distribution for Next.js frontend ─────
resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "QA Platform frontend - ${var.environment}"
  default_root_object = "index.html"
  aliases             = var.environment == "production" ? [var.domain_name, "www.${var.domain_name}"] : []
  price_class         = "PriceClass_100"  # US/EU/Asia

  # Origin: ALB (Next.js SSR)
  origin {
    domain_name = var.alb_dns_name
    origin_id   = "alb-frontend"
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
    custom_header {
      name  = "X-CloudFront-Secret"
      value = var.cloudfront_secret
    }
  }

  # Origin: S3 for static assets
  origin {
    domain_name            = aws_s3_bucket.static_assets.bucket_regional_domain_name
    origin_id              = "s3-static"
    origin_access_control_id = aws_cloudfront_origin_access_control.s3.id
  }

  # Default: Next.js SSR
  default_cache_behavior {
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = "alb-frontend"

    forwarded_values {
      query_string = true
      headers      = ["Origin", "Authorization", "Accept", "Accept-Language", "Host"]
      cookies { forward = "all" }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
    compress               = true
  }

  # Static assets (long cache)
  ordered_cache_behavior {
    path_pattern     = "/_next/static/*"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "s3-static"

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 86400
    default_ttl            = 2592000
    max_ttl                = 31536000
    compress               = true
  }

  ordered_cache_behavior {
    path_pattern     = "/images/*"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "s3-static"

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }

    viewer_protocol_policy = "redirect-to-https"
    default_ttl            = 86400
    max_ttl                = 604800
    compress               = true
  }

  # API routes — never cached
  ordered_cache_behavior {
    path_pattern     = "/api/*"
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "alb-frontend"

    forwarded_values {
      query_string = true
      headers      = ["*"]
      cookies { forward = "all" }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = var.environment == "production" ? aws_acm_certificate.frontend[0].arn : null
    ssl_support_method       = var.environment == "production" ? "sni-only" : null
    minimum_protocol_version = "TLSv1.2_2021"
    cloudfront_default_certificate = var.environment != "production"
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/404.html"
    error_caching_min_ttl = 60
  }

  tags = {
    Name = "qa-platform-frontend-${var.environment}"
  }
}

resource "aws_cloudfront_origin_access_control" "s3" {
  name                              = "qa-platform-s3-oac-${var.environment}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ───── S3: Static assets ─────
resource "aws_s3_bucket" "static_assets" {
  bucket = "qa-platform-static-${var.environment}-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_versioning" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "static_assets" {
  bucket                  = aws_s3_bucket.static_assets.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ───── S3: Reports & screenshots ─────
resource "aws_s3_bucket" "reports" {
  bucket = "qa-platform-reports-${var.environment}-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_lifecycle_configuration" "reports" {
  bucket = aws_s3_bucket.reports.id
  rule {
    id     = "expire-old-reports"
    status = "Enabled"
    expiration { days = 365 }
    noncurrent_version_expiration { noncurrent_days = 90 }
  }
}

resource "aws_s3_bucket_cors_configuration" "reports" {
  bucket = aws_s3_bucket.reports.id
  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET"]
    allowed_origins = ["https://${var.domain_name}", "http://localhost:3000"]
    max_age_seconds = 3600
  }
}

data "aws_caller_identity" "current" {}

# ───── ACM Certificate (production only) ─────
resource "aws_acm_certificate" "frontend" {
  count             = var.environment == "production" ? 1 : 0
  domain_name       = var.domain_name
  subject_alternative_names = ["*.${var.domain_name}"]
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

output "cloudfront_domain" {
  value = aws_cloudfront_distribution.frontend.domain_name
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.frontend.id
}

output "reports_bucket" {
  value = aws_s3_bucket.reports.bucket
}
