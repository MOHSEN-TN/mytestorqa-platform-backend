import { Test, TestingModule } from '@nestjs/testing';
import { TestcasesController } from './testcases.controller';
import { TestcasesService } from './testcases.service';

describe('TestcasesController', () => {
  let controller: TestcasesController;

  beforeEach(async () => {
    const moduleRef: TestingModule =
      await Test.createTestingModule({
        controllers: [TestcasesController],
        providers: [
          {
            provide: TestcasesService,
            useValue: {
              create: jest.fn(),
              findAll: jest.fn(),
              update: jest.fn(),
              remove: jest.fn(),
            },
          },
        ],
      }).compile();

    controller =
      moduleRef.get<TestcasesController>(
        TestcasesController,
      );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
