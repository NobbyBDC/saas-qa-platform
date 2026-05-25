import { Module, Global } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { LoggerService } from './logger.service';
import { ObservabilityController } from './observability.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [ObservabilityController],
  providers: [MetricsService, LoggerService],
  exports: [MetricsService, LoggerService],
})
export class ObservabilityModule {}
