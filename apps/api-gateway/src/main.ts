import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';
import compression from 'compression';
import { LoggerService } from './observability/logger.service';
import { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const logger = app.get(LoggerService);
  app.useLogger(logger);

  // Capture raw body for Stripe & GitHub webhook signature verification
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/v1/billing/webhook') || req.path.startsWith('/api/v1/github/webhook')) {
      let data: Buffer[] = [];
      req.on('data', (chunk: Buffer) => data.push(chunk));
      req.on('end', () => {
        (req as any).rawBody = Buffer.concat(data);
        next();
      });
    } else {
      next();
    }
  });

  // Security
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          scriptSrc: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(compression());

  // CORS
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
  });

  // Versioning
  app.enableVersioning({ type: VersioningType.URI });
  app.setGlobalPrefix('api/v1');

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('QA Platform API')
    .setDescription(
      `# QA Platform — Full-Stack SaaS API

Enterprise-grade Design → Code → QA → Deployment automation.

## Authentication
- **JWT Bearer**: Use \`POST /auth/login\` to obtain tokens
- **API Keys**: Pass \`X-API-Key: qap_...\` header for programmatic access

## Rate Limits
- 20 req/sec burst, 100 req/10s, 300 req/min
      `,
    )
    .setVersion('1.0')
    .setContact('QA Platform', 'https://qaplatform.io', 'support@qaplatform.io')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', in: 'header', name: 'X-API-Key' }, 'api-key')
    .addTag('auth', 'Authentication & token management')
    .addTag('projects', 'Project management')
    .addTag('runs', 'Test run execution')
    .addTag('reports', 'QA reports')
    .addTag('billing', 'Stripe subscriptions & usage')
    .addTag('integrations/github', 'GitHub OAuth & webhook integration')
    .addTag('ai-copilot', 'AI-powered fix suggestions & self-healing')
    .addTag('notifications', 'Email & Slack notification preferences')
    .addTag('observability', 'Metrics & dashboards')
    .addTag('audit', 'Immutable audit log')
    .addTag('api-keys', 'API key management')
    .addTag('admin', 'Super admin — cross-tenant platform management')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true, tagsSorter: 'alpha' },
    customSiteTitle: 'QA Platform API Docs',
  });

  const port = process.env.API_GATEWAY_PORT ?? 4000;
  await app.listen(port);
  logger.log(`API Gateway running on http://localhost:${port}`, 'Bootstrap');
  logger.log(`Swagger docs → http://localhost:${port}/api/docs`, 'Bootstrap');
  logger.log(`Prometheus metrics → http://localhost:${port}/api/v1/observability/metrics`, 'Bootstrap');
}

bootstrap();
