import type { DataSource } from "../crudOptions";
import type { ResolvedSqlIdType } from "../sqlIdInference";
import { toCamelCase } from "../utils";

export function buildServiceFile(params: {
  entityName: string;
  entityFile: string;
  dataSource: DataSource;
  sqlIdType: ResolvedSqlIdType;
  primaryKeyField: string;
}): string {
  const { entityName, entityFile, dataSource, sqlIdType, primaryKeyField } = params;
  const entityFromPath = `./entities/${entityFile}.entity`;
  const entity = toCamelCase(entityName);

  if (dataSource === "mongodb") {
    return `import { Injectable } from '@nestjs/common';
import { Create${entityName}Dto } from './dto/create-${entityFile}.dto';
import { Update${entityName}Dto } from './dto/update-${entityFile}.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { ${entityName} } from '${entityFromPath}';
import { MongoRepository } from 'typeorm';
import { ObjectId } from 'mongodb';

@Injectable()
export class ${entityName}Service {
  constructor(
    @InjectRepository(${entityName})
    private readonly ${entity}Repository: MongoRepository<${entityName}>,
  ) {}

  async create(create${entityName}Dto: Create${entityName}Dto) {
    await this.${entity}Repository.save(create${entityName}Dto);
  }

  async findAll() {
    return await this.${entity}Repository.find();
  }

  async findOne(id: string) {
    return await this.${entity}Repository.findOneBy({ _id: new ObjectId(id) } as any);
  }

  async update(id: string, update${entityName}Dto: Update${entityName}Dto) {
    return await this.${entity}Repository.update(
      { _id: new ObjectId(id) } as any,
      update${entityName}Dto,
    );
  }

  async remove(id: string) {
    return await this.${entity}Repository.delete({ _id: new ObjectId(id) } as any);
  }
}
`;
  }

  const idTs = sqlIdType === "number" ? "number" : "string";
  return `import { Injectable } from '@nestjs/common';
import { Create${entityName}Dto } from './dto/create-${entityFile}.dto';
import { Update${entityName}Dto } from './dto/update-${entityFile}.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { ${entityName} } from '${entityFromPath}';
import { Repository } from 'typeorm';

@Injectable()
export class ${entityName}Service {
  constructor(
    @InjectRepository(${entityName})
    private readonly ${entity}Repository: Repository<${entityName}>,
  ) {}

  async create(create${entityName}Dto: Create${entityName}Dto) {
    return await this.${entity}Repository.save(create${entityName}Dto);
  }

  async findAll() {
    return await this.${entity}Repository.find();
  }

  async findOne(id: ${idTs}) {
    return await this.${entity}Repository.findOne({
      where: { ${primaryKeyField}: id },
    });
  }

  async update(id: ${idTs}, update${entityName}Dto: Update${entityName}Dto) {
    return await this.${entity}Repository.update(id, update${entityName}Dto);
  }

  async remove(id: ${idTs}) {
    return await this.${entity}Repository.delete(id);
  }
}
`;
}
