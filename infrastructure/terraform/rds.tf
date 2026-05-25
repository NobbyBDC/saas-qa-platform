# =============================================================================
# RDS PostgreSQL
# =============================================================================
resource "aws_db_subnet_group" "main" {
  name       = "${var.app_name}-db-subnet-group"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_db_instance" "main" {
  identifier        = "${var.app_name}-postgres"
  engine            = "postgres"
  engine_version    = "16.1"
  instance_class    = var.db_instance_class
  allocated_storage = 20
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"

  skip_final_snapshot     = false
  final_snapshot_identifier = "${var.app_name}-final-snapshot"

  deletion_protection = true
  multi_az            = true

  performance_insights_enabled = true

  tags = { Name = "${var.app_name}-postgres" }
}
