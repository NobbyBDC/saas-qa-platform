import { Module } from '@nestjs/common';
import { FigmaController } from './figma.controller';
import { FigmaService } from './figma.service';
import { FigmaParser } from './figma.parser';
import { FigmaScreenshotter } from './figma.screenshotter';
import { StorageService } from './storage.service';

@Module({
  controllers: [FigmaController],
  providers: [FigmaService, FigmaParser, FigmaScreenshotter, StorageService],
  exports: [FigmaService],
})
export class FigmaModule {}
