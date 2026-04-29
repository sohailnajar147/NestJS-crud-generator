import type { DataSource } from "../crudOptions";

/**
 * Jest + @nestjs/testing scaffold for the generated service. Repository is mocked
 * so the file compiles without a live DB; teams replace with deeper tests.
 */
export function buildServiceSpecFile(params: {
  entityName: string;
  entityFile: string;
  dataSource: DataSource;
}): string {
  const { entityName, entityFile, dataSource } = params;
  if (dataSource === "mongodb") {
    return `import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ${entityName}Service } from './${entityFile}.service';
import { ${entityName} } from './entities/${entityFile}.entity';
import { MongoRepository } from 'typeorm';

describe('${entityName}Service', () => {
  let service: ${entityName}Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ${entityName}Service,
        {
          provide: getRepositoryToken(${entityName}),
          useValue: {
            save: jest.fn(),
            find: jest.fn(),
            findOneBy: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          } as unknown as MongoRepository<${entityName}>,
        },
      ],
    }).compile();

    service = module.get<${entityName}Service>(${entityName}Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
`;
  }
  return `import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ${entityName}Service } from './${entityFile}.service';
import { ${entityName} } from './entities/${entityFile}.entity';
import { Repository } from 'typeorm';

describe('${entityName}Service', () => {
  let service: ${entityName}Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ${entityName}Service,
        {
          provide: getRepositoryToken(${entityName}),
          useValue: {
            save: jest.fn(),
            find: jest.fn(),
            findOneBy: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            remove: jest.fn(),
          } as unknown as Repository<${entityName}>,
        },
      ],
    }).compile();

    service = module.get<${entityName}Service>(${entityName}Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
`;
}
