import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { HealthController } from './health.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({ name: 'runs' }),
  ],
  controllers: [HealthController],
})
export class HealthModule {}
