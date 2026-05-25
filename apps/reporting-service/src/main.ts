import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const { json, urlencoded } = await import('express');
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));
  app.use(helmet());
  app.enableCors({ origin: '*' });
  app.setGlobalPrefix('reports');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = process.env.REPORTING_SERVICE_PORT ?? 4005;
  await app.listen(port);
  console.log(`Reporting Service running on http://localhost:${port}`);
}
bootstrap();
