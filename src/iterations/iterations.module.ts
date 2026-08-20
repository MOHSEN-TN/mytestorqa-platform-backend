import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { TestcasesModule } from '../testcases/testcases.module';

import { IterationsController } from './iterations.controller';
import { IterationsService } from './iterations.service';

@Module({
  imports: [
    PrismaModule,
    TestcasesModule,
  ],

  controllers: [
    IterationsController,
  ],

  providers: [
    IterationsService,
  ],

  exports: [
    IterationsService,
  ],
})
export class IterationsModule {}