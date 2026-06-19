import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ProjectsModule } from './projects/projects.module';
import { TestcasesModule } from './testcases/testcases.module';
import { TestsuitesModule } from './testsuites/testsuites.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { IterationsModule } from './iterations/iterations.module';
import { BugsModule } from './bugs/bugs.module';
import { ReportsModule } from './reports/reports.module';
import { AIExplorationModule } from './AiExploration/ai-exploration.module';
import { AutomationModule } from './automation/automation.module';
@Module({
  imports: [
    PrismaModule,
    UsersModule,
    AuthModule,
    ProjectsModule,
    TestcasesModule,
    TestsuitesModule,
    CampaignsModule,
    IterationsModule,
    BugsModule,
    ReportsModule,
    AIExplorationModule,
    AutomationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}