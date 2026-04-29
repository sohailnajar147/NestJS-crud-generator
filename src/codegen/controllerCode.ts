import type { DataSource, RestUpdateMethod, RouteStrategy } from "../crudOptions";
import type { ResolvedSqlIdType } from "../sqlIdInference";
import { toCamelCase } from "../utils";

function swaggerMethodBlock(
  addSwagger: boolean,
  summary: string,
  param?: { name: string; description: string; typeName: "String" | "Number" },
): string {
  if (!addSwagger) {
    return "";
  }
  let lines = `  @ApiOperation({ summary: '${summary}' })\n  @ApiResponse({ status: 200, description: 'Success' })`;
  if (param) {
    lines += `\n  @ApiParam({ name: '${param.name}', type: ${param.typeName}, description: '${param.description}' })`;
  }
  return lines + "\n";
}

export function buildControllerFile(params: {
  entityName: string;
  entityFile: string;
  finalRoute: string;
  swaggerTag: string;
  entitiesPascal: string;
  dataSource: DataSource;
  sqlIdType: ResolvedSqlIdType;
  routeStrategy: RouteStrategy;
  restUpdateMethod: RestUpdateMethod;
  addSwagger: boolean;
}): string {
  const {
    entityName,
    entityFile,
    finalRoute,
    swaggerTag,
    entitiesPascal,
    dataSource,
    sqlIdType,
    routeStrategy,
    restUpdateMethod,
    addSwagger,
  } = params;
  const entity = toCamelCase(entityName);
  const idDescription =
    dataSource === "mongodb"
      ? "MongoDB ObjectId as a hex string"
      : sqlIdType === "number"
        ? "Numeric primary key"
        : "Primary key value";
  const idApiType: "String" | "Number" =
    dataSource === "sql" && sqlIdType === "number" ? "Number" : "String";

  const swaggerImports = addSwagger
    ? "import { ApiOperation, ApiResponse, ApiTags, ApiParam } from '@nestjs/swagger';"
    : "";
  const swaggerClass = addSwagger
    ? `@ApiTags('${swaggerTag}')`
    : "";

  if (routeStrategy === "rest") {
    return buildRestController({
      entityName,
      entityFile,
      finalRoute,
      dataSource,
      sqlIdType,
      restUpdateMethod,
      addSwagger,
      entity,
      idDescription,
      idApiType,
      swaggerImports,
      swaggerClass,
    });
  }

  // legacy
  return buildLegacyController({
    entityName,
    entityFile,
    finalRoute,
    entitiesPascal,
    dataSource,
    sqlIdType,
    addSwagger,
    entity,
    idDescription,
    idApiType,
    swaggerImports,
    swaggerClass,
  });
}

function buildRestController(p: {
  entityName: string;
  entityFile: string;
  finalRoute: string;
  dataSource: DataSource;
  sqlIdType: ResolvedSqlIdType;
  restUpdateMethod: RestUpdateMethod;
  addSwagger: boolean;
  entity: string;
  idDescription: string;
  idApiType: "String" | "Number";
  swaggerImports: string;
  swaggerClass: string;
}): string {
  const {
    entityName,
    entityFile,
    finalRoute,
    dataSource,
    sqlIdType,
    restUpdateMethod,
    addSwagger,
    entity,
    idDescription,
    idApiType,
    swaggerImports,
    swaggerClass,
  } = p;
  const commonImports: string[] = [
    "Controller",
    "Get",
    "Post",
    "Body",
    "Param",
    "Delete",
  ];
  if (restUpdateMethod === "put") {
    commonImports.push("Put");
  } else {
    commonImports.push("Patch");
  }
  if (dataSource === "sql" && sqlIdType === "number") {
    commonImports.push("ParseIntPipe");
  }
  commonImports.sort();
  const updateDecorator =
    restUpdateMethod === "put" ? "@Put(':id')" : "@Patch(':id')";
  const idParamForMongoOrString =
    dataSource === "sql" && sqlIdType === "number"
      ? `@Param('id', ParseIntPipe) id: number`
      : `@Param('id') id: string`;
  return `import { ${commonImports.join(", ")} } from '@nestjs/common';
import { ${entityName}Service } from './${entityFile}.service';
import { Create${entityName}Dto } from './dto/create-${entityFile}.dto';
import { Update${entityName}Dto } from './dto/update-${entityFile}.dto';
${swaggerImports ? `${swaggerImports}\n` : ""}
${swaggerClass ? `${swaggerClass}\n` : ""}@Controller('${finalRoute}')
export class ${entityName}Controller {
  constructor(private readonly ${entity}Service: ${entityName}Service) {}

  @Post()
${swaggerMethodBlock(addSwagger, `Create ${entityName}`)}  create(@Body() create${entityName}Dto: Create${entityName}Dto) {
    return this.${entity}Service.create(create${entityName}Dto);
  }

  @Get()
${swaggerMethodBlock(addSwagger, `List all ${entityName}`)}  findAll() {
    return this.${entity}Service.findAll();
  }

  @Get(':id')
${swaggerMethodBlock(addSwagger, `Get ${entityName} by id`, { name: "id", typeName: idApiType, description: idDescription })}  findOne(${idParamForMongoOrString}) {
    return this.${entity}Service.findOne(id);
  }

  ${updateDecorator}
${swaggerMethodBlock(addSwagger, `Update ${entityName}`, { name: "id", typeName: idApiType, description: idDescription })}  update(
    ${idParamForMongoOrString},
    @Body() update${entityName}Dto: Update${entityName}Dto,
  ) {
    return this.${entity}Service.update(id, update${entityName}Dto);
  }

  @Delete(':id')
${swaggerMethodBlock(addSwagger, `Delete ${entityName}`, { name: "id", typeName: idApiType, description: idDescription })}  remove(${idParamForMongoOrString}) {
    return this.${entity}Service.remove(id);
  }
}
`;
}

function buildLegacyController(p: {
  entityName: string;
  entityFile: string;
  finalRoute: string;
  entitiesPascal: string;
  dataSource: DataSource;
  sqlIdType: ResolvedSqlIdType;
  addSwagger: boolean;
  entity: string;
  idDescription: string;
  idApiType: "String" | "Number";
  swaggerImports: string;
  swaggerClass: string;
}): string {
  const {
    entityName,
    entityFile,
    finalRoute,
    entitiesPascal,
    dataSource,
    sqlIdType,
    addSwagger,
    entity,
    idDescription,
    idApiType,
    swaggerImports,
    swaggerClass,
  } = p;
  const commonImports = [
    "Controller",
    "Get",
    "Post",
    "Body",
    "Param",
    "Delete",
    "Put",
  ];
  if (dataSource === "sql" && sqlIdType === "number") {
    commonImports.push("ParseIntPipe");
  }
  commonImports.sort();
  const idParamForMongoOrString =
    dataSource === "sql" && sqlIdType === "number"
      ? `@Param('id', ParseIntPipe) id: number`
      : `@Param('id') id: string`;
  return `import { ${commonImports.join(", ")} } from '@nestjs/common';
import { ${entityName}Service } from './${entityFile}.service';
import { Create${entityName}Dto } from './dto/create-${entityFile}.dto';
import { Update${entityName}Dto } from './dto/update-${entityFile}.dto';
${swaggerImports ? `${swaggerImports}\n` : ""}
${swaggerClass ? `${swaggerClass}\n` : ""}@Controller('${finalRoute}')
export class ${entityName}Controller {
  constructor(private readonly ${entity}Service: ${entityName}Service) {}

  @Post('Add${entityName}')
${swaggerMethodBlock(addSwagger, `Create ${entityName}`)}  create(@Body() create${entityName}Dto: Create${entityName}Dto) {
    return this.${entity}Service.create(create${entityName}Dto);
  }

  @Get('show${entitiesPascal}')
${swaggerMethodBlock(addSwagger, `Find all ${entitiesPascal}`)}  findAll() {
    return this.${entity}Service.findAll();
  }

  @Get('show${entityName}/:id')
${swaggerMethodBlock(addSwagger, `Find one ${entityName}`, { name: "id", typeName: idApiType, description: idDescription })}  findOne(${idParamForMongoOrString}) {
    return this.${entity}Service.findOne(id);
  }

  @Put('Update${entityName}/:id')
${swaggerMethodBlock(addSwagger, `Update ${entityName}`, { name: "id", typeName: idApiType, description: idDescription })}  update(
    ${idParamForMongoOrString},
    @Body() update${entityName}Dto: Update${entityName}Dto,
  ) {
    return this.${entity}Service.update(id, update${entityName}Dto);
  }

  @Delete('Delete${entityName}/:id')
${swaggerMethodBlock(addSwagger, `Delete ${entityName}`, { name: "id", typeName: idApiType, description: idDescription })}  remove(${idParamForMongoOrString}) {
    return this.${entity}Service.remove(id);
  }
}
`;
}
