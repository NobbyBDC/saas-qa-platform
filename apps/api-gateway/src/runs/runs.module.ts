import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { RunsController } from './runs.controller';
import { RunsService } from './runs.service';
import { RunsProcessor } from './runs.processor';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'runs' }),
    WebsocketModule,
  ],
  controllers: [RunsController],
  providers: [RunsService, RunsProcessor],
})
export class RunsModule {}
