import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AIExplorationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlaywrightExplorerService } from '../automation/playwright/playwright-explorer.service';
import { AITestGeneratorService } from './generator/ai-test-generator.service';

export type CreateAIExplorationDto = {
  projectId: string;
  createdById?: string;

  title: string;
  prompt?: string;
  context?: string;

  targetUrl?: string;
  depth?: number;

  authenticationRequired?: boolean;
  username?: string;
  password?: string;

  generatePlaywright?: boolean;
  generateGherkin?: boolean;
  generateNegativeTests?: boolean;
};

export type UpdateAIExplorationDto = Partial<CreateAIExplorationDto> & {
  status?: AIExplorationStatus;
};

@Injectable()
export class AIExplorationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly playwrightExplorerService: PlaywrightExplorerService,
    private readonly aiTestGeneratorService: AITestGeneratorService,
  ) {}

  async findAll() {
    return this.prisma.aIExploration.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        suggestions: true,
      },
    });
  }

  async findAllByUser(createdById: string) {
    return this.prisma.aIExploration.findMany({
      where: {
        createdById,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        suggestions: true,
      },
    });
  }

  async findByProject(projectId: string) {
    return this.prisma.aIExploration.findMany({
      where: {
        projectId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        suggestions: true,
      },
    });
  }

  async findOne(id: string) {
    const exploration = await this.prisma.aIExploration.findUnique({
      where: {
        id,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        suggestions: true,
      },
    });

    if (!exploration) {
      throw new NotFoundException('AI exploration not found');
    }

    return exploration;
  }

  async create(dto: CreateAIExplorationDto) {
    if (!dto.projectId) {
      throw new BadRequestException('projectId is required');
    }

    if (!dto.createdById) {
      throw new BadRequestException('createdById is required');
    }

    if (!dto.title || !dto.title.trim()) {
      throw new BadRequestException('title is required');
    }

    const project = await this.prisma.project.findUnique({
      where: {
        id: dto.projectId,
      },
      select: {
        id: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: dto.createdById,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const prompt =
      dto.prompt ||
      this.buildPromptFromExplorerOptions({
        title: dto.title,
        targetUrl: dto.targetUrl,
        depth: dto.depth,
        authenticationRequired: dto.authenticationRequired,
        generatePlaywright: dto.generatePlaywright,
        generateGherkin: dto.generateGherkin,
        generateNegativeTests: dto.generateNegativeTests,
        context: dto.context,
      });

    return this.prisma.aIExploration.create({
      data: {
        projectId: dto.projectId,
        createdById: dto.createdById,

        title: dto.title.trim(),
        prompt,
        context: dto.context,

        targetUrl: dto.targetUrl,
        depth: dto.depth ?? 1,

        authenticationRequired: dto.authenticationRequired ?? false,
        username: dto.username,
        password: dto.password,

        generatePlaywright: dto.generatePlaywright ?? true,
        generateGherkin: dto.generateGherkin ?? true,
        generateNegativeTests: dto.generateNegativeTests ?? false,

        status: AIExplorationStatus.DRAFT,
        generatedCount: 0,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        suggestions: true,
      },
    });
  }

  async update(id: string, dto: UpdateAIExplorationDto) {
    await this.findOne(id);

    return this.prisma.aIExploration.update({
      where: {
        id,
      },
      data: {
        title: dto.title?.trim(),
        prompt: dto.prompt,
        context: dto.context,

        targetUrl: dto.targetUrl,
        depth: dto.depth,

        authenticationRequired: dto.authenticationRequired,
        username: dto.username,
        password: dto.password,

        generatePlaywright: dto.generatePlaywright,
        generateGherkin: dto.generateGherkin,
        generateNegativeTests: dto.generateNegativeTests,

        status: dto.status,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        suggestions: true,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.aIExploration.delete({
      where: {
        id,
      },
    });
  }

  async generate(id: string) {
    const exploration = await this.findOne(id);

    if (!exploration.targetUrl) {
      throw new BadRequestException('targetUrl is required for generation');
    }

    await this.prisma.aIExploration.update({
      where: {
        id,
      },
      data: {
        status: AIExplorationStatus.PROCESSING,
      },
    });

    try {
      await this.prisma.aITestSuggestion.deleteMany({
        where: {
          explorationId: id,
        },
      });

      const explorationResult =
        await this.playwrightExplorerService.explore({
          targetUrl: exploration.targetUrl,
          depth: exploration.depth ?? 1,
          authenticationRequired:
            exploration.authenticationRequired ?? false,
          username: exploration.username ?? undefined,
          password: exploration.password ?? undefined,
        });

      const suggestions =
        this.aiTestGeneratorService.generateFromExploration(
          explorationResult,
          {
            generatePlaywright: exploration.generatePlaywright,
            generateGherkin: exploration.generateGherkin,
            generateNegativeTests: exploration.generateNegativeTests,
          },
        );

      if (suggestions.length > 0) {
        await this.prisma.aITestSuggestion.createMany({
          data: suggestions.map((suggestion) => ({
            explorationId: id,
            title: suggestion.title,
            description: suggestion.description,
            expectedResult: suggestion.expectedResult,
            priority: suggestion.priority,
          })),
        });
      }

      return this.prisma.aIExploration.update({
        where: {
          id,
        },
        data: {
          status: AIExplorationStatus.GENERATED,
          generatedCount: suggestions.length,
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          suggestions: true,
        },
      });
    } catch (error) {
      await this.prisma.aIExploration.update({
        where: {
          id,
        },
        data: {
          status: AIExplorationStatus.DRAFT,
        },
      });

      throw error;
    }
  }

  async validate(id: string) {
    await this.findOne(id);

    return this.prisma.aIExploration.update({
      where: {
        id,
      },
      data: {
        status: AIExplorationStatus.VALIDATED,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        suggestions: true,
      },
    });
  }

  async archive(id: string) {
    await this.findOne(id);

    return this.prisma.aIExploration.update({
      where: {
        id,
      },
      data: {
        status: AIExplorationStatus.ARCHIVED,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        suggestions: true,
      },
    });
  }

  private buildPromptFromExplorerOptions(options: {
    title: string;
    targetUrl?: string;
    depth?: number;
    authenticationRequired?: boolean;
    generatePlaywright?: boolean;
    generateGherkin?: boolean;
    generateNegativeTests?: boolean;
    context?: string;
  }) {
    return `
Generate QA test scenarios for the following application.

Title: ${options.title}
Target URL: ${options.targetUrl || 'Not provided'}
Exploration depth: ${options.depth ?? 1}
Authentication required: ${options.authenticationRequired ? 'Yes' : 'No'}
Generate Playwright tests: ${options.generatePlaywright ?? true}
Generate Gherkin scenarios: ${options.generateGherkin ?? true}
Include negative tests: ${options.generateNegativeTests ?? false}
Additional context: ${options.context || 'None'}
`.trim();
  }
}