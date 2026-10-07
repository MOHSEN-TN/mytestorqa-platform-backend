import { Test, TestingModule } from '@nestjs/testing';

// archiver is ESM in the installed version and Jest currently runs this
// unit-test suite in CommonJS mode. The service test only checks construction,
// so archiver is safely mocked here.
jest.mock('archiver', () => ({
  ZipArchive: jest.fn(),
}));

import { TestcasesService } from './testcases.service';

describe('TestcasesService', () => {
  let service: TestcasesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TestcasesService],
    })
      .useMocker(() => ({}))
      .compile();

    service = module.get<TestcasesService>(TestcasesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
