import { Test, TestingModule } from '@nestjs/testing';
import { TestsuitesService } from './testsuites.service';

describe('TestsuitesService', () => {
  let service: TestsuitesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TestsuitesService],
    }).compile();

    service = module.get<TestsuitesService>(TestsuitesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
