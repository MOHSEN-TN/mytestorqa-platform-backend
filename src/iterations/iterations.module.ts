import { Module } from '@nestjs/common';
import { IterationsService } from './iterations.service';
import { IterationsController } from './iterations.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [IterationsController],
  providers: [IterationsService],
  exports: [IterationsService],
})
export class IterationsModule {}