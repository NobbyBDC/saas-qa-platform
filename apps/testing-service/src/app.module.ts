import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TestingController } from './orchestrator/testing.controller';
import { VisualRegressionService } from './visual/visual-regression.service';
import { AccessibilityService } from './accessibility/accessibility.service';
import { PerformanceService } from './performance/performance.service';
import { FunctionalTestingService } from './functional/functional-testing.service';
import { StorageService } from './storage/storage.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [TestingController],
  providers: [
    VisualRegressionService,
    AccessibilityService,
    PerformanceService,
    FunctionalTestingService,
    StorageService,
  ],
})
export class AppModule {}
