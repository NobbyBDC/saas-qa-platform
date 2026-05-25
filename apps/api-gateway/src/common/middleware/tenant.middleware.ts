import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiKeysService } from '../../api-keys/api-keys.service';

declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      tenantPlan?: string;
    }
  }
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly prisma: PrismaService,
    private readonly apiKeys: ApiKeysService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Inject tenant from JWT (already decoded by JwtStrategy into req.user)
    const user = (req as any).user;
    if (user?.orgId) {
      // SUPER_ADMIN bypasses all tenant scoping and IP whitelisting
      if (user.role === 'SUPER_ADMIN') {
        req.tenantId = user.orgId;
        req.tenantPlan = 'ENTERPRISE';
        return next();
      }

      req.tenantId = user.orgId;
      // Lazy-load plan for downstream guards
      const org = await this.prisma.organization.findUnique({
        where: { id: user.orgId },
        select: { plan: true, planStatus: true, allowedIpRanges: true, ipWhitelistEnabled: true },
      });
      if (org) {
        req.tenantPlan = org.plan;

        // IP whitelisting
        if (org.ipWhitelistEnabled && org.allowedIpRanges.length > 0) {
          const clientIp = this.extractIp(req);
          if (!this.isIpAllowed(clientIp, org.allowedIpRanges)) {
            throw new ForbiddenException(`IP ${clientIp} is not whitelisted for this organization`);
          }
        }
      }
    }

    // API key auth path
    const apiKey = req.headers['x-api-key'] as string;
    if (apiKey && !user) {
      const keyData = await this.apiKeys.validate(apiKey);
      if (keyData) {
        req.tenantId = keyData.organizationId;
        (req as any).apiKeyScopes = keyData.scopes;
      }
    }

    next();
  }

  private extractIp(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.headers['x-real-ip'] as string ??
      req.socket.remoteAddress ??
      '0.0.0.0'
    );
  }

  private isIpAllowed(ip: string, allowedRanges: string[]): boolean {
    // Simple exact-match for now; production would use CIDR matching
    return allowedRanges.some(range => {
      if (range.includes('/')) {
        return this.ipInCidr(ip, range);
      }
      return ip === range;
    });
  }

  private ipInCidr(ip: string, cidr: string): boolean {
    try {
      const [range, bits] = cidr.split('/');
      const mask = ~(Math.pow(2, 32 - parseInt(bits)) - 1);
      const ipNum = this.ipToNum(ip);
      const rangeNum = this.ipToNum(range);
      return (ipNum & mask) === (rangeNum & mask);
    } catch {
      return false;
    }
  }

  private ipToNum(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
  }
}
