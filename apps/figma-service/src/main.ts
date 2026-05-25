import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
  app.use(helmet());
  app.enableCors({ origin: '*' });
  app.setGlobalPrefix('figma');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = new DocumentBuilder()
    .setTitle('Figma Service')
    .setDescription('Parses Figma designs and extracts design schemas')
    .setVersion('1.0')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  const port = process.env.FIGMA_SERVICE_PORT ?? 4001;
  await app.listen(port);
  console.log(`Figma Service running on http://localhost:${port}`);
}

bootstrap();
