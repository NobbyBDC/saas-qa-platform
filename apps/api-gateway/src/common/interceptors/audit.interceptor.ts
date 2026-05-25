import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const user = req.user;
        if (!user?.orgId) return;

        const method = req.method;
        const url = req.url;

        // Only audit mutating operations
        if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return;

        const action = `api.${method.toLowerCase()}.${url.replace(/\/api\//, '').replace(/\//g, '.').replace(/\.[a-f0-9-]{36}/g, '')}`;

        this.audit.log({
          organizationId: user.orgId,
          userId: user.sub,
          action,
          metadata: {
            method,
            url,
            durationMs: Date.now() - start,
            body: this.sanitizeBody(req.body),
          },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        });
      }),
    );
  }

  private sanitizeBody(body: any): any {
    if (!body) return undefined;
    const sanitized = { ...body };
    const sensitive = ['password', 'passwordHash', 'accessToken', 'refreshToken', 'apiKey', 'secret'];
    sensitive.forEach(k => { if (k in sanitized) sanitized[k] = '[REDACTED]'; });
    return sanitized;
  }
}
