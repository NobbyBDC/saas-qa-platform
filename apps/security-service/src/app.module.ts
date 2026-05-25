import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SecurityController } from './scanner/security.controller';
import { SecurityScannerService } from './scanner/security-scanner.service';
import { CodeQualityService } from './scanner/code-quality.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [SecurityController],
  providers: [SecurityScannerService, CodeQualityService],
})
export class AppModule {}
