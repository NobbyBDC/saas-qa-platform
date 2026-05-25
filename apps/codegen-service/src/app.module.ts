import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CodegenController } from './codegen/codegen.controller';
import { CodegenService } from './codegen/codegen.service';
import { StorageService } from './codegen/storage.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [CodegenController],
  providers: [CodegenService, StorageService],
})
export class AppModule {}
