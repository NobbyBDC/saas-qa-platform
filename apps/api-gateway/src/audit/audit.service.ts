import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogInput {
  organizationId: string;
  userId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: object;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput): Promise<void> {
    // Fire-and-forget — audit logs must never block the main request
    this.prisma.auditLog
      .create({
        data: {
          organizationId: input.organizationId,
          userId: input.userId,
          action: input.action,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          metadata: input.metadata ?? {},
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        },
      })
      .catch(() => {
        // Swallow — audit log failures must never surface to the caller
      });
  }

  async query(opts: {
    organizationId: string;
    userId?: string;
    action?: string;
    resourceType?: string;
    resourceId?: string;
    from?: Date;
    to?: Date;
    page?: number;
    limit?: number;
  }) {
    const page = opts.page ?? 1;
    const limit = Math.min(opts.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const where: any = { organizationId: opts.organizationId };
    if (opts.userId) where.userId = opts.userId;
    if (opts.action) where.action = { contains: opts.action };
    if (opts.resourceType) where.resourceType = opts.resourceType;
    if (opts.resourceId) where.resourceId = opts.resourceId;
    if (opts.from || opts.to) {
      where.createdAt = {};
      if (opts.from) where.createdAt.gte = opts.from;
      if (opts.to) where.createdAt.lte = opts.to;
    }

    const [total, logs] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
    ]);

    return {
      data: logs,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async getActionTypes(organizationId: string): Promise<string[]> {
    const results = await this.prisma.auditLog.findMany({
      where: { organizationId },
      distinct: ['action'],
      select: { action: true },
    });
    return results.map(r => r.action);
  }
}
