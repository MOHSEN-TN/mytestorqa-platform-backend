import { Module } from '@nestjs/common';
import { TestsuitesService } from './testsuites.service';
import { TestsuitesController } from './testsuites.controller';

@Module({
  providers: [TestsuitesService],
  controllers: [TestsuitesController],
})
export class TestsuitesModule {}
