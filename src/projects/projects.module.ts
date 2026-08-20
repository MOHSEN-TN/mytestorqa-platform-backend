import { Module } from '@nestjs/common';

import { ProjectTransferService } from './project-transfer.service';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  controllers: [
    ProjectsController,
  ],
  providers: [
    ProjectsService,
    ProjectTransferService,
  ],
})
export class ProjectsModule {}
