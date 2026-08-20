import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import {
  AIGenerationMode,
  AutomationFramework,
  TestCaseSourceType,
  TestCaseStatus,
  TestPriority,
} from '@prisma/client';
import ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import {
  ImportProjectPreviewDto,
  ImportProjectPreviewItem,
  ImportProjectResultDto,
} from './dto/import-project.dto';
import {
  ExportProjectResultDto,
  PROJECT_TRANSFER_TEMPLATE_VERSION,
} from './dto/export-project.dto';

type ImportedProjectRow = {
  projectKey: string;
  name: string;
  description: string | null;
  baseUrl: string | null;
};

type ImportedSuiteRow = {
  suiteKey: string;
  projectKey: string;
  name: string;
  description: string | null;
};

type ImportedTestCaseRow = {
  testCaseKey: string;
  suiteKey: string;
  title: string;
  description: string | null;
  expected: string | null;
  status: TestCaseStatus;
  priority: TestPriority;
  sourceType: TestCaseSourceType;
  generationMode: AIGenerationMode | null;
  automationFramework: AutomationFramework | null;
  automationCode: string | null;
};

type ImportedStepRow = {
  stepKey: string;
  testCaseKey: string;
  stepOrder: number;
  action: string;
  expected: string | null;
};

type ParsedWorkbook = {
  templateVersion: string | null;
  projects: ImportedProjectRow[];
  suites: ImportedSuiteRow[];
  testCases: ImportedTestCaseRow[];
  steps: ImportedStepRow[];
  errors: string[];
};

@Injectable()
export class ProjectTransferService {
  private readonly contentType =
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  constructor(private readonly prisma: PrismaService) {}

  async exportProjects(userId: string): Promise<ExportProjectResultDto> {
    const projects = await this.prisma.project.findMany({
      where: {
        members: {
          some: {
            userId,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      include: {
        testSuites: {
          orderBy: {
            createdAt: 'asc',
          },
          include: {
            testCases: {
              orderBy: {
                createdAt: 'asc',
              },
              include: {
                steps: {
                  orderBy: {
                    stepOrder: 'asc',
                  },
                },
              },
            },
          },
        },
      },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MyTester SMART QA Platform';
    workbook.created = new Date();

    const metaSheet = workbook.addWorksheet('META');
    const projectsSheet = workbook.addWorksheet('PROJECTS');
    const suitesSheet = workbook.addWorksheet('SUITES');
    const testCasesSheet = workbook.addWorksheet('TEST_CASES');
    const stepsSheet = workbook.addWorksheet('STEPS');

    metaSheet.columns = [
      { header: 'key', key: 'key', width: 24 },
      { header: 'value', key: 'value', width: 40 },
    ];

    metaSheet.addRows([
      {
        key: 'templateVersion',
        value: PROJECT_TRANSFER_TEMPLATE_VERSION,
      },
      {
        key: 'platform',
        value: 'MyTester',
      },
      {
        key: 'exportedAt',
        value: new Date().toISOString(),
      },
    ]);

    projectsSheet.columns = [
      { header: 'projectKey', key: 'projectKey', width: 20 },
      { header: 'name', key: 'name', width: 30 },
      { header: 'description', key: 'description', width: 50 },
      { header: 'baseUrl', key: 'baseUrl', width: 50 },
    ];

    suitesSheet.columns = [
      { header: 'suiteKey', key: 'suiteKey', width: 24 },
      { header: 'projectKey', key: 'projectKey', width: 20 },
      { header: 'name', key: 'name', width: 30 },
      { header: 'description', key: 'description', width: 50 },
    ];

    testCasesSheet.columns = [
      { header: 'testCaseKey', key: 'testCaseKey', width: 30 },
      { header: 'suiteKey', key: 'suiteKey', width: 24 },
      { header: 'title', key: 'title', width: 40 },
      { header: 'description', key: 'description', width: 50 },
      { header: 'expected', key: 'expected', width: 50 },
      { header: 'status', key: 'status', width: 18 },
      { header: 'priority', key: 'priority', width: 18 },
      { header: 'sourceType', key: 'sourceType', width: 20 },
      { header: 'generationMode', key: 'generationMode', width: 20 },
      {
        header: 'automationFramework',
        key: 'automationFramework',
        width: 24,
      },
      { header: 'automationCode', key: 'automationCode', width: 80 },
    ];

    stepsSheet.columns = [
      { header: 'stepKey', key: 'stepKey', width: 36 },
      { header: 'testCaseKey', key: 'testCaseKey', width: 30 },
      { header: 'stepOrder', key: 'stepOrder', width: 12 },
      { header: 'action', key: 'action', width: 60 },
      { header: 'expected', key: 'expected', width: 60 },
    ];

    let suiteCount = 0;
    let testCaseCount = 0;
    let stepCount = 0;

    projects.forEach((project, projectIndex) => {
      const projectKey = `PROJECT_${String(projectIndex + 1).padStart(4, '0')}`;

      projectsSheet.addRow({
        projectKey,
        name: project.name,
        description: project.description ?? '',
        baseUrl: project.baseUrl ?? '',
      });

      project.testSuites.forEach((suite, suiteIndex) => {
        suiteCount += 1;

        const suiteKey =
          `${projectKey}_SUITE_${String(suiteIndex + 1).padStart(4, '0')}`;

        suitesSheet.addRow({
          suiteKey,
          projectKey,
          name: suite.name,
          description: suite.description ?? '',
        });

        suite.testCases.forEach((testCase, testCaseIndex) => {
          testCaseCount += 1;

          const testCaseKey =
            `${suiteKey}_TC_${String(testCaseIndex + 1).padStart(4, '0')}`;

          testCasesSheet.addRow({
            testCaseKey,
            suiteKey,
            title: testCase.title,
            description: testCase.description ?? '',
            expected: testCase.expected ?? '',
            status: testCase.status,
            priority: testCase.priority,
            sourceType: testCase.sourceType,
            generationMode: testCase.generationMode ?? '',
            automationFramework: testCase.automationFramework ?? '',
            automationCode: testCase.automationCode ?? '',
          });

          testCase.steps.forEach((step, stepIndex) => {
            stepCount += 1;

            const stepKey =
              `${testCaseKey}_STEP_${String(stepIndex + 1).padStart(4, '0')}`;

            stepsSheet.addRow({
              stepKey,
              testCaseKey,
              stepOrder: step.stepOrder,
              action: step.action,
              expected: step.expected ?? '',
            });
          });
        });
      });
    });

    this.formatSheet(metaSheet);
    this.formatSheet(projectsSheet);
    this.formatSheet(suitesSheet);
    this.formatSheet(testCasesSheet);
    this.formatSheet(stepsSheet);

    const workbookBuffer = await workbook.xlsx.writeBuffer();

    const buffer = Buffer.from(workbookBuffer);
    const date = new Date().toISOString().slice(0, 10);
    const fileName = `MyTester_Projects_${date}.xlsx`;

    return {
      fileName,
      contentType: this.contentType,
      buffer,
      summary: {
        fileName,
        contentType: this.contentType,
        projectCount: projects.length,
        suiteCount,
        testCaseCount,
        stepCount,
      },
    };
  }

  async previewImport(
    userId: string,
    fileBuffer: Buffer,
  ): Promise<ImportProjectPreviewDto> {
    const parsed = await this.parseWorkbook(fileBuffer);
    const projects: ImportProjectPreviewItem[] = [];

    for (const project of parsed.projects) {
      const projectErrors = this.validateProjectRelations(parsed, project);
      const exists = await this.projectExistsForUser(userId, project.name);

      const suiteRows = parsed.suites.filter(
        (suite) => suite.projectKey === project.projectKey,
      );

      const suiteKeys = new Set(
        suiteRows.map((suite) => suite.suiteKey),
      );

      const testCaseRows = parsed.testCases.filter((testCase) =>
        suiteKeys.has(testCase.suiteKey),
      );

      const testCaseKeys = new Set(
        testCaseRows.map((testCase) => testCase.testCaseKey),
      );

      const stepRows = parsed.steps.filter((step) =>
        testCaseKeys.has(step.testCaseKey),
      );

      if (projectErrors.length > 0) {
        projects.push({
          projectKey: project.projectKey,
          name: project.name,
          status: 'INVALID',
          suites: suiteRows.length,
          testCases: testCaseRows.length,
          steps: stepRows.length,
          message: projectErrors.join(' | '),
        });

        continue;
      }

      if (exists) {
        projects.push({
          projectKey: project.projectKey,
          name: project.name,
          status: 'PROJECT_ALREADY_EXISTS',
          suites: suiteRows.length,
          testCases: testCaseRows.length,
          steps: stepRows.length,
          message: `Le projet "${project.name}" existe déjà dans votre espace.`,
        });

        continue;
      }

      projects.push({
        projectKey: project.projectKey,
        name: project.name,
        status: 'READY',
        suites: suiteRows.length,
        testCases: testCaseRows.length,
        steps: stepRows.length,
      });
    }

    return {
      valid:
        parsed.errors.length === 0 &&
        projects.every((project) => project.status !== 'INVALID'),
      templateVersion: parsed.templateVersion,
      projectsFound: parsed.projects.length,
      suitesFound: parsed.suites.length,
      testCasesFound: parsed.testCases.length,
      stepsFound: parsed.steps.length,
      projects,
      errors: parsed.errors,
    };
  }

  async importProjects(
    userId: string,
    fileBuffer: Buffer,
  ): Promise<ImportProjectResultDto> {
    const parsed = await this.parseWorkbook(fileBuffer);

    if (parsed.errors.length > 0) {
      throw new BadRequestException({
        message: 'Le fichier d’import est invalide.',
        errors: parsed.errors,
      });
    }

    const result: ImportProjectResultDto = {
      imported: [],
      skipped: [],
      errors: [],
    };

    for (const project of parsed.projects) {
      const relationErrors = this.validateProjectRelations(parsed, project);

      if (relationErrors.length > 0) {
        result.skipped.push({
          projectKey: project.projectKey,
          name: project.name,
          reason: 'INVALID_PROJECT',
          message: relationErrors.join(' | '),
        });

        continue;
      }

      const exists = await this.projectExistsForUser(userId, project.name);

      if (exists) {
        result.skipped.push({
          projectKey: project.projectKey,
          name: project.name,
          reason: 'PROJECT_ALREADY_EXISTS',
          message:
            `Le projet "${project.name}" existe déjà dans votre espace. ` +
            'Import ignoré.',
        });

        continue;
      }

      try {
        const imported = await this.prisma.$transaction(async (tx) => {
          const createdProject = await tx.project.create({
            data: {
              name: project.name,
              description: project.description,
              baseUrl: project.baseUrl,
              members: {
                create: {
                  userId,
                  role: 'OWNER',
                },
              },
            },
          });

          const suiteRows = parsed.suites.filter(
            (suite) => suite.projectKey === project.projectKey,
          );

          let testCaseCount = 0;
          let stepCount = 0;

          for (const suiteRow of suiteRows) {
            const createdSuite = await tx.testSuite.create({
              data: {
                projectId: createdProject.id,
                name: suiteRow.name,
                description: suiteRow.description,
              },
            });

            const testCaseRows = parsed.testCases.filter(
              (testCase) => testCase.suiteKey === suiteRow.suiteKey,
            );

            for (const testCaseRow of testCaseRows) {
              const stepRows = parsed.steps
                .filter(
                  (step) => step.testCaseKey === testCaseRow.testCaseKey,
                )
                .sort((a, b) => a.stepOrder - b.stepOrder);

              await tx.testCase.create({
                data: {
                  suiteId: createdSuite.id,
                  title: testCaseRow.title,
                  description: testCaseRow.description,
                  expected: testCaseRow.expected,
                  status: testCaseRow.status,
                  priority: testCaseRow.priority,
                  sourceType: testCaseRow.sourceType,
                  generationMode: testCaseRow.generationMode,
                  automationFramework: testCaseRow.automationFramework,
                  automationCode: testCaseRow.automationCode,
                  steps:
                    stepRows.length > 0
                      ? {
                          create: stepRows.map((step) => ({
                            stepOrder: step.stepOrder,
                            action: step.action,
                            expected: step.expected,
                          })),
                        }
                      : undefined,
                },
              });

              testCaseCount += 1;
              stepCount += stepRows.length;
            }
          }

          return {
            projectId: createdProject.id,
            suites: suiteRows.length,
            testCases: testCaseCount,
            steps: stepCount,
          };
        });

        result.imported.push({
          projectKey: project.projectKey,
          name: project.name,
          projectId: imported.projectId,
          suites: imported.suites,
          testCases: imported.testCases,
          steps: imported.steps,
        });
      } catch (error) {
        result.errors.push(
          `Échec de l’import du projet "${project.name}" : ` +
            this.errorMessage(error),
        );
      }
    }

    return result;
  }

  private async projectExistsForUser(
    userId: string,
    projectName: string,
  ): Promise<boolean> {
    const existing = await this.prisma.project.findFirst({
      where: {
        name: {
          equals: projectName.trim(),
          mode: 'insensitive',
        },
        members: {
          some: {
            userId,
          },
        },
      },
      select: {
        id: true,
      },
    });

    return Boolean(existing);
  }

  private validateProjectRelations(
    parsed: ParsedWorkbook,
    project: ImportedProjectRow,
  ): string[] {
    const errors: string[] = [];

    const suiteRows = parsed.suites.filter(
      (suite) => suite.projectKey === project.projectKey,
    );

    const duplicateSuiteNames = this.findDuplicates(
      suiteRows.map((suite) => suite.name.trim().toLowerCase()),
    );

    if (duplicateSuiteNames.length > 0) {
      errors.push(
        `Suites dupliquées : ${duplicateSuiteNames.join(', ')}`,
      );
    }

    for (const suite of suiteRows) {
      const testCaseRows = parsed.testCases.filter(
        (testCase) => testCase.suiteKey === suite.suiteKey,
      );

      const duplicateTestCaseTitles = this.findDuplicates(
        testCaseRows.map((testCase) => testCase.title.trim().toLowerCase()),
      );

      if (duplicateTestCaseTitles.length > 0) {
        errors.push(
          `Cas de test dupliqués dans la suite "${suite.name}" : ` +
            duplicateTestCaseTitles.join(', '),
        );
      }

      for (const testCase of testCaseRows) {
        const stepRows = parsed.steps.filter(
          (step) => step.testCaseKey === testCase.testCaseKey,
        );

        const duplicateOrders = this.findDuplicateNumbers(
          stepRows.map((step) => step.stepOrder),
        );

        if (duplicateOrders.length > 0) {
          errors.push(
            `Ordres de steps dupliqués pour "${testCase.title}" : ` +
              duplicateOrders.join(', '),
          );
        }
      }
    }

    return errors;
  }

  private async parseWorkbook(fileBuffer: Buffer): Promise<ParsedWorkbook> {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException('Le fichier XLSX est vide.');
    }

    const workbook = new ExcelJS.Workbook();

    try {
      const arrayBuffer = fileBuffer.buffer.slice(
        fileBuffer.byteOffset,
        fileBuffer.byteOffset + fileBuffer.byteLength,
      ) as ArrayBuffer;

      const excelBuffer = Buffer.from(arrayBuffer);

      await workbook.xlsx.load(
  excelBuffer as unknown as Parameters<
    typeof workbook.xlsx.load
  >[0],
);
    } catch {
      throw new BadRequestException(
        'Le fichier fourni n’est pas un fichier XLSX valide.',
      );
    }

    const errors: string[] = [];

    const metaSheet = workbook.getWorksheet('META');
    const projectsSheet = workbook.getWorksheet('PROJECTS');
    const suitesSheet = workbook.getWorksheet('SUITES');
    const testCasesSheet = workbook.getWorksheet('TEST_CASES');
    const stepsSheet = workbook.getWorksheet('STEPS');

    if (!metaSheet) errors.push('Feuille META manquante.');
    if (!projectsSheet) errors.push('Feuille PROJECTS manquante.');
    if (!suitesSheet) errors.push('Feuille SUITES manquante.');
    if (!testCasesSheet) errors.push('Feuille TEST_CASES manquante.');
    if (!stepsSheet) errors.push('Feuille STEPS manquante.');

    if (
      !metaSheet ||
      !projectsSheet ||
      !suitesSheet ||
      !testCasesSheet ||
      !stepsSheet
    ) {
      return {
        templateVersion: null,
        projects: [],
        suites: [],
        testCases: [],
        steps: [],
        errors,
      };
    }

    const meta = this.readKeyValueSheet(metaSheet);
    const templateVersion = meta.get('templateVersion') ?? null;

    if (templateVersion !== PROJECT_TRANSFER_TEMPLATE_VERSION) {
      errors.push(
        `Version de template non supportée : ` +
          `${templateVersion ?? 'absente'}. ` +
          `Version attendue : ${PROJECT_TRANSFER_TEMPLATE_VERSION}.`,
      );
    }

    this.assertHeaders(
      projectsSheet,
      ['projectKey', 'name', 'description', 'baseUrl'],
      errors,
    );

    this.assertHeaders(
      suitesSheet,
      ['suiteKey', 'projectKey', 'name', 'description'],
      errors,
    );

    this.assertHeaders(
      testCasesSheet,
      [
        'testCaseKey',
        'suiteKey',
        'title',
        'description',
        'expected',
        'status',
        'priority',
        'sourceType',
        'generationMode',
        'automationFramework',
        'automationCode',
      ],
      errors,
    );

    this.assertHeaders(
      stepsSheet,
      ['stepKey', 'testCaseKey', 'stepOrder', 'action', 'expected'],
      errors,
    );

    if (errors.length > 0) {
      return {
        templateVersion,
        projects: [],
        suites: [],
        testCases: [],
        steps: [],
        errors,
      };
    }

    const projects = this.readProjects(projectsSheet, errors);
    const suites = this.readSuites(suitesSheet, errors);
    const testCases = this.readTestCases(testCasesSheet, errors);
    const steps = this.readSteps(stepsSheet, errors);

    const projectKeys = new Set(
      projects.map((project) => project.projectKey),
    );
    const suiteKeys = new Set(
      suites.map((suite) => suite.suiteKey),
    );
    const testCaseKeys = new Set(
      testCases.map((testCase) => testCase.testCaseKey),
    );

    for (const suite of suites) {
      if (!projectKeys.has(suite.projectKey)) {
        errors.push(
          `Suite "${suite.name}" référence un projectKey inconnu : ` +
            `${suite.projectKey}.`,
        );
      }
    }

    for (const testCase of testCases) {
      if (!suiteKeys.has(testCase.suiteKey)) {
        errors.push(
          `Cas "${testCase.title}" référence un suiteKey inconnu : ` +
            `${testCase.suiteKey}.`,
        );
      }
    }

    for (const step of steps) {
      if (!testCaseKeys.has(step.testCaseKey)) {
        errors.push(
          `Step "${step.stepKey}" référence un testCaseKey inconnu : ` +
            `${step.testCaseKey}.`,
        );
      }
    }

    return {
      templateVersion,
      projects,
      suites,
      testCases,
      steps,
      errors,
    };
  }

  private readProjects(
    sheet: ExcelJS.Worksheet,
    errors: string[],
  ): ImportedProjectRow[] {
    const rows: ImportedProjectRow[] = [];
    const seenKeys = new Set<string>();

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);

      if (this.isRowEmpty(row)) continue;

      const projectKey = this.cellText(row.getCell(1).value);
      const name = this.cellText(row.getCell(2).value);
      const description = this.nullableText(row.getCell(3).value);
      const baseUrl = this.nullableText(row.getCell(4).value);

      if (!projectKey) {
        errors.push(
          `PROJECTS ligne ${rowNumber} : projectKey obligatoire.`,
        );
        continue;
      }

      if (!name) {
        errors.push(
          `PROJECTS ligne ${rowNumber} : name obligatoire.`,
        );
        continue;
      }

      if (seenKeys.has(projectKey)) {
        errors.push(
          `PROJECTS ligne ${rowNumber} : projectKey dupliqué ` +
            `"${projectKey}".`,
        );
        continue;
      }

      seenKeys.add(projectKey);

      rows.push({
        projectKey,
        name,
        description,
        baseUrl,
      });
    }

    return rows;
  }

  private readSuites(
    sheet: ExcelJS.Worksheet,
    errors: string[],
  ): ImportedSuiteRow[] {
    const rows: ImportedSuiteRow[] = [];
    const seenKeys = new Set<string>();

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);

      if (this.isRowEmpty(row)) continue;

      const suiteKey = this.cellText(row.getCell(1).value);
      const projectKey = this.cellText(row.getCell(2).value);
      const name = this.cellText(row.getCell(3).value);
      const description = this.nullableText(row.getCell(4).value);

      if (!suiteKey || !projectKey || !name) {
        errors.push(
          `SUITES ligne ${rowNumber} : suiteKey, projectKey et name ` +
            'sont obligatoires.',
        );
        continue;
      }

      if (seenKeys.has(suiteKey)) {
        errors.push(
          `SUITES ligne ${rowNumber} : suiteKey dupliqué "${suiteKey}".`,
        );
        continue;
      }

      seenKeys.add(suiteKey);

      rows.push({
        suiteKey,
        projectKey,
        name,
        description,
      });
    }

    return rows;
  }

  private readTestCases(
    sheet: ExcelJS.Worksheet,
    errors: string[],
  ): ImportedTestCaseRow[] {
    const rows: ImportedTestCaseRow[] = [];
    const seenKeys = new Set<string>();

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);

      if (this.isRowEmpty(row)) continue;

      const testCaseKey = this.cellText(row.getCell(1).value);
      const suiteKey = this.cellText(row.getCell(2).value);
      const title = this.cellText(row.getCell(3).value);
      const description = this.nullableText(row.getCell(4).value);
      const expected = this.nullableText(row.getCell(5).value);

      const rawStatus = this.cellText(row.getCell(6).value);
      const rawPriority = this.cellText(row.getCell(7).value);
      const rawSourceType = this.cellText(row.getCell(8).value);
      const rawGenerationMode = this.cellText(row.getCell(9).value);
      const rawAutomationFramework = this.cellText(
        row.getCell(10).value,
      );
      const automationCode = this.nullableText(row.getCell(11).value);

      if (!testCaseKey || !suiteKey || !title) {
        errors.push(
          `TEST_CASES ligne ${rowNumber} : testCaseKey, suiteKey et ` +
            'title sont obligatoires.',
        );
        continue;
      }

      if (seenKeys.has(testCaseKey)) {
        errors.push(
          `TEST_CASES ligne ${rowNumber} : testCaseKey dupliqué ` +
            `"${testCaseKey}".`,
        );
        continue;
      }

      const status = this.parseRequiredEnum(
        rawStatus,
        Object.values(TestCaseStatus),
      );

      if (!status) {
        errors.push(
          `TEST_CASES ligne ${rowNumber} : status invalide ` +
            `"${rawStatus}".`,
        );
        continue;
      }

      const priority = this.parseRequiredEnum(
        rawPriority,
        Object.values(TestPriority),
      );

      if (!priority) {
        errors.push(
          `TEST_CASES ligne ${rowNumber} : priority invalide ` +
            `"${rawPriority}".`,
        );
        continue;
      }

      const sourceType = this.parseRequiredEnum(
        rawSourceType,
        Object.values(TestCaseSourceType),
      );

      if (!sourceType) {
        errors.push(
          `TEST_CASES ligne ${rowNumber} : sourceType invalide ` +
            `"${rawSourceType}".`,
        );
        continue;
      }

      const generationMode = this.parseOptionalEnum(
        rawGenerationMode,
        Object.values(AIGenerationMode),
      );

      if (rawGenerationMode && !generationMode) {
        errors.push(
          `TEST_CASES ligne ${rowNumber} : generationMode invalide ` +
            `"${rawGenerationMode}".`,
        );
        continue;
      }

      const automationFramework = this.parseOptionalEnum(
        rawAutomationFramework,
        Object.values(AutomationFramework),
      );

      if (rawAutomationFramework && !automationFramework) {
        errors.push(
          `TEST_CASES ligne ${rowNumber} : automationFramework invalide ` +
            `"${rawAutomationFramework}".`,
        );
        continue;
      }

      seenKeys.add(testCaseKey);

      rows.push({
        testCaseKey,
        suiteKey,
        title,
        description,
        expected,
        status,
        priority,
        sourceType,
        generationMode,
        automationFramework,
        automationCode,
      });
    }

    return rows;
  }

  private readSteps(
    sheet: ExcelJS.Worksheet,
    errors: string[],
  ): ImportedStepRow[] {
    const rows: ImportedStepRow[] = [];
    const seenKeys = new Set<string>();

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);

      if (this.isRowEmpty(row)) continue;

      const stepKey = this.cellText(row.getCell(1).value);
      const testCaseKey = this.cellText(row.getCell(2).value);
      const rawStepOrder = this.cellText(row.getCell(3).value);
      const action = this.cellText(row.getCell(4).value);
      const expected = this.nullableText(row.getCell(5).value);

      const stepOrder = Number.parseInt(rawStepOrder, 10);

      if (!stepKey || !testCaseKey || !action) {
        errors.push(
          `STEPS ligne ${rowNumber} : stepKey, testCaseKey et action ` +
            'sont obligatoires.',
        );
        continue;
      }

      if (!Number.isInteger(stepOrder) || stepOrder <= 0) {
        errors.push(
          `STEPS ligne ${rowNumber} : stepOrder invalide ` +
            `"${rawStepOrder}".`,
        );
        continue;
      }

      if (seenKeys.has(stepKey)) {
        errors.push(
          `STEPS ligne ${rowNumber} : stepKey dupliqué "${stepKey}".`,
        );
        continue;
      }

      seenKeys.add(stepKey);

      rows.push({
        stepKey,
        testCaseKey,
        stepOrder,
        action,
        expected,
      });
    }

    return rows;
  }

  private readKeyValueSheet(
    sheet: ExcelJS.Worksheet,
  ): Map<string, string> {
    const result = new Map<string, string>();

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const key = this.cellText(row.getCell(1).value);
      const value = this.cellText(row.getCell(2).value);

      if (key) {
        result.set(key, value);
      }
    }

    return result;
  }

  private assertHeaders(
    sheet: ExcelJS.Worksheet,
    expectedHeaders: string[],
    errors: string[],
  ): void {
    expectedHeaders.forEach((expected, index) => {
      const actual = this.cellText(
        sheet.getRow(1).getCell(index + 1).value,
      );

      if (actual !== expected) {
        errors.push(
          `${sheet.name} : colonne ${index + 1} attendue "${expected}", ` +
            `trouvée "${actual || 'vide'}".`,
        );
      }
    });
  }

  private formatSheet(sheet: ExcelJS.Worksheet): void {
    const header = sheet.getRow(1);

    header.font = {
      bold: true,
    };

    sheet.views = [
      {
        state: 'frozen',
        ySplit: 1,
      },
    ];

    if (sheet.columnCount > 0) {
      sheet.autoFilter = {
        from: {
          row: 1,
          column: 1,
        },
        to: {
          row: 1,
          column: sheet.columnCount,
        },
      };
    }
  }

  private isRowEmpty(row: ExcelJS.Row): boolean {
    for (let index = 1; index <= row.cellCount; index += 1) {
      if (this.cellText(row.getCell(index).value)) {
        return false;
      }
    }

    return true;
  }

  private cellText(value: ExcelJS.CellValue): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'string') {
      return value.trim();
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value).trim();
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if ('text' in value && typeof value.text === 'string') {
      return value.text.trim();
    }

    if ('result' in value) {
      const result = value.result;

      if (
        result === null ||
        result === undefined ||
        typeof result === 'object'
      ) {
        return '';
      }

      return String(result).trim();
    }

    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText
        .map((item) => item.text)
        .join('')
        .trim();
    }

    return '';
  }

  private nullableText(value: ExcelJS.CellValue): string | null {
    const text = this.cellText(value);
    return text || null;
  }

  private parseRequiredEnum<T extends string>(
    raw: string,
    values: T[],
  ): T | null {
    const normalized = raw.trim().toUpperCase();

    return values.find((value) => value === normalized) ?? null;
  }

  private parseOptionalEnum<T extends string>(
    raw: string,
    values: T[],
  ): T | null {
    if (!raw.trim()) {
      return null;
    }

    return this.parseRequiredEnum(raw, values);
  }

  private findDuplicates(values: string[]): string[] {
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    for (const value of values) {
      if (seen.has(value)) {
        duplicates.add(value);
      }

      seen.add(value);
    }

    return Array.from(duplicates);
  }

  private findDuplicateNumbers(values: number[]): number[] {
    const seen = new Set<number>();
    const duplicates = new Set<number>();

    for (const value of values) {
      if (seen.has(value)) {
        duplicates.add(value);
      }

      seen.add(value);
    }

    return Array.from(duplicates);
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    return 'Erreur inconnue';
  }
}
