# =============================================================================
# ElastiCache Redis
# =============================================================================
resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.app_name}-redis-subnet-group"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "${var.app_name}-redis"
  description          = "QA Platform Redis cluster"

  node_type            = var.redis_node_type
  num_cache_clusters   = 2
  port                 = 6379

  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [aws_security_group.redis.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = var.db_password  # Reuse for simplicity

  automatic_failover_enabled = true
  multi_az_enabled           = true

  snapshot_retention_limit = 7
  snapshot_window          = "02:00-03:00"

  tags = { Name = "${var.app_name}-redis" }
}
