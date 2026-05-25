import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import * as crypto from 'crypto';

const KEY_PREFIX = 'qap_';
const KEY_BYTES = 32;

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(opts: {
    organizationId: string;
    createdById: string;
    name: string;
    scopes: string[];
    projectId?: string;
    expiresAt?: Date;
  }) {
    const rawKey = `${KEY_PREFIX}${crypto.randomBytes(KEY_BYTES).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.slice(0, KEY_PREFIX.length + 8);

    // Enforce plan limits
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: opts.organizationId } });
    if (!org.apiAccessEnabled) throw new ForbiddenException('API access requires PRO plan or higher');

    const existing = await this.prisma.apiKey.count({ where: { organizationId: opts.organizationId, isActive: true } });
    if (existing >= 10) throw new BadRequestException('Maximum 10 active API keys allowed');

    const key = await this.prisma.apiKey.create({
      data: {
        name: opts.name,
        keyHash,
        keyPrefix,
        organizationId: opts.organizationId,
        projectId: opts.projectId,
        scopes: opts.scopes,
        createdById: opts.createdById,
        expiresAt: opts.expiresAt,
      },
    });

    await this.audit.log({
      organizationId: opts.organizationId,
      userId: opts.createdById,
      action: 'api_key.create',
      resourceType: 'api_key',
      resourceId: key.id,
      metadata: { name: opts.name, scopes: opts.scopes },
    });

    // Return the raw key ONCE — never stored
    return { id: key.id, key: rawKey, name: key.name, prefix: keyPrefix, scopes: key.scopes };
  }

  async validate(rawKey: string): Promise<{ organizationId: string; scopes: string[]; projectId: string | null } | null> {
    if (!rawKey.startsWith(KEY_PREFIX)) return null;

    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      select: { id: true, organizationId: true, scopes: true, projectId: true, isActive: true, expiresAt: true, revokedAt: true },
    });

    if (!apiKey?.isActive || apiKey.revokedAt) return null;
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

    // Update last used
    this.prisma.apiKey.update({ where: { keyHash }, data: { lastUsedAt: new Date() } }).catch(() => {});

    return { organizationId: apiKey.organizationId, scopes: apiKey.scopes, projectId: apiKey.projectId };
  }

  async list(organizationId: string) {
    return this.prisma.apiKey.findMany({
      where: { organizationId, isActive: true },
      select: {
        id: true, name: true, keyPrefix: true, scopes: true, projectId: true,
        lastUsedAt: true, expiresAt: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(id: string, organizationId: string, userId: string) {
    const key = await this.prisma.apiKey.findFirst({ where: { id, organizationId } });
    if (!key) throw new NotFoundException('API key not found');

    await this.prisma.apiKey.update({
      where: { id },
      data: { isActive: false, revokedAt: new Date() },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'api_key.revoke',
      resourceType: 'api_key',
      resourceId: id,
      metadata: { name: key.name },
    });

    return { revoked: true };
  }
}
