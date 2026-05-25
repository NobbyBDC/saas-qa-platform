import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ReportsController } from './reports/reports.controller';
import { ReportService } from './reports/report.service';
import { ReportGenerator } from './reports/report.generator';
import { StorageService } from './storage/storage.service';
import { JiraService } from './integrations/jira.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [ReportsController],
  providers: [ReportService, ReportGenerator, StorageService, JiraService],
})
export class AppModule {}
