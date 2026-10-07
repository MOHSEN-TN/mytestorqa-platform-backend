import { Test, TestingModule } from '@nestjs/testing';
import { TestsuitesController } from './testsuites.controller';
import { TestsuitesService } from './testsuites.service';

describe('TestsuitesController', () => {
  let controller: TestsuitesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TestsuitesController],
      providers: [
        {
          provide: TestsuitesService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<TestsuitesController>(TestsuitesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
