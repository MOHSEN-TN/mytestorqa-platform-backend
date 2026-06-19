// src/bugs/bugs.module.ts
import { Module } from '@nestjs/common';
import { BugsController } from './bugs.controller';
import { BugsService } from './bugs.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BugsController],
  providers: [BugsService],
})
export class BugsModule {}