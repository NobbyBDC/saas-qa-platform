import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ── Platform stats ────────────────────────────────────────────────────────

  async getPlatformStats() {
    const [orgs, users, runs, issues] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.user.count(),
      this.prisma.testRun.count(),
      this.prisma.issue.count(),
    ]);

    const runsByStatus = await this.prisma.testRun.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    const orgsByPlan = await this.prisma.organization.groupBy({
      by: ['plan'],
      _count: { _all: true },
    });

    const recentRuns = await this.prisma.testRun.count({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });

    return {
      totals: { organizations: orgs, users, runs, issues },
      runsByStatus: Object.fromEntries(runsByStatus.map(r => [r.status, r._count._all])),
      orgsByPlan: Object.fromEntries(orgsByPlan.map(r => [r.plan, r._count._all])),
      runsLast24h: recentRuns,
    };
  }

  // ── Organizations ────────────────────────────────────────────────────────

  async listOrganizations(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const where = search
      ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { slug: { contains: search, mode: 'insensitive' as const } }] }
      : {};

    const [organizations, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { users: true, projects: true } },
        },
      }),
      this.prisma.organization.count({ where }),
    ]);

    return {
      data: organizations,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async getOrganization(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        users: { select: { id: true, email: true, name: true, role: true, createdAt: true } },
        projects: { select: { id: true, name: true, status: true, createdAt: true } },
        _count: { select: { users: true, projects: true } },
      },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async updateOrganizationPlan(
    id: string,
    plan: string,
    overrides: { projectsLimit?: number; runsPerMonth?: number; storageGb?: number; apiAccessEnabled?: boolean; ssoEnabled?: boolean },
  ) {
    await this.getOrganization(id);
    return this.prisma.organization.update({
      where: { id },
      data: { plan: plan as any, ...overrides },
    });
  }

  async suspendOrganization(id: string) {
    await this.getOrganization(id);
    return this.prisma.organization.update({
      where: { id },
      data: { planStatus: 'suspended' },
    });
  }

  async deleteOrganization(id: string) {
    await this.getOrganization(id);
    // Cascade is handled by Prisma schema relations — deletes users, projects, runs etc.
    return this.prisma.organization.delete({ where: { id } });
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  async listUsers(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const where = search
      ? { OR: [{ email: { contains: search, mode: 'insensitive' as const } }, { name: { contains: search, mode: 'insensitive' as const } }] }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, email: true, name: true, role: true, createdAt: true,
          organization: { select: { id: true, name: true, slug: true, plan: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async deleteUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'SUPER_ADMIN') throw new Error('Cannot delete a super admin account');
    return this.prisma.user.delete({ where: { id } });
  }

  // ── Runs (cross-tenant) ───────────────────────────────────────────────────

  async listRuns(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [runs, total] = await Promise.all([
      this.prisma.testRun.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          project: {
            select: {
              name: true,
              organization: { select: { name: true, slug: true } },
            },
          },
        },
      }),
      this.prisma.testRun.count(),
    ]);
    return { data: runs, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  // ── Impersonation ────────────────────────────────────────────────────────
  // Issues a short-lived access token acting as the OWNER of a given org.
  // The token carries isSuperAdmin=false so it behaves exactly like a normal user.

  async impersonate(organizationId: string, requestingAdminId: string) {
    const org = await this.getOrganization(organizationId);

    const owner = (org as any).users?.find((u: any) => u.role === 'OWNER') ?? (org as any).users?.[0];
    if (!owner) throw new NotFoundException('No users found in organization');

    const payload = {
      sub: owner.id,
      email: owner.email,
      role: owner.role,
      orgId: organizationId,
      impersonatedBy: requestingAdminId,
    };

    const accessToken = this.jwt.sign(payload, { expiresIn: '1h' });

    return {
      accessToken,
      expiresIn: 3600,
      impersonating: { userId: owner.id, email: owner.email, organizationId, organizationName: (org as any).name },
      warning: 'This token expires in 1 hour. All actions taken will appear as the impersonated user.',
    };
  }
}
