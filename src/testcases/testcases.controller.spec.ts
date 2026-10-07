import { Test, TestingModule } from '@nestjs/testing';

// The controller imports TestcasesService, whose dependency tree includes
// archiver. Mocking the service module keeps this unit test isolated.
jest.mock('./testcases.service', () => ({
  TestcasesService: class TestcasesService {},
}));

import { TestcasesController } from './testcases.controller';
import { TestcasesService } from './testcases.service';

describe('TestcasesController', () => {
  let controller: TestcasesController;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
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
    })
      .useMocker(() => ({}))
      .compile();

    controller = moduleRef.get<TestcasesController>(TestcasesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
