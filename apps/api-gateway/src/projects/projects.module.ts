import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'runs' })],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
