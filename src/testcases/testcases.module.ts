import { Module } from '@nestjs/common';
import { TestcasesController } from './testcases.controller';
import { TestcasesService } from './testcases.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TestcasesController],
  providers: [TestcasesService],
})
export class TestcasesModule {}