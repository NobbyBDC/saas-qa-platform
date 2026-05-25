import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ApiKeysService } from '../../api-keys/api-keys.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeys: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) throw new UnauthorizedException('API key required');

    const keyData = await this.apiKeys.validate(apiKey);
    if (!keyData) throw new UnauthorizedException('Invalid or expired API key');

    req.user = { orgId: keyData.organizationId, apiKeyScopes: keyData.scopes };
    req.tenantId = keyData.organizationId;
    return true;
  }
}
