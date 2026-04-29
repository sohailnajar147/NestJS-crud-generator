import { collectValidatorsForProperty } from "./codegen/dtoCode";
import { pluralPascalForRoutes } from "./codegen/plural";
import type { CrudCodeGenOptions } from "./crudOptions";
import type { ModelInfo } from "./modelParser";
import type { ResolvedSqlIdType } from "./sqlIdInference";
import { resolveSqlIdType } from "./sqlIdInference";
import { toCamelCase } from "./utils";

function swaggerBlock(
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

export interface CreateDtoHbsField {
  /** e.g. `  @IsString()` (two spaces + decorator) */
  decoratorLines: string[];
  name: string;
  type: string;
}

/**
 * Build the Handlebars context for custom `templates/*.hbs` (see README for the full variable schema).
 */
export function buildCrudHbsViewModel(
  modelInfo: ModelInfo,
  entityFile: string,
  entityText: string,
  opts: CrudCodeGenOptions,
): Record<string, unknown> {
  const entityName = modelInfo.className;
  const collectionName = modelInfo.collectionName;
  const entitiesPascal = pluralPascalForRoutes(entityName);
  const finalRoute = opts.routePrefix
    ? `${opts.routePrefix}/${collectionName}`
    : collectionName;
  const swaggerTag = collectionName;
  const entity = toCamelCase(entityName);
  const resolvedSql: ResolvedSqlIdType =
    opts.dataSource === "sql"
      ? resolveSqlIdType(
        opts.sqlIdType,
        entityText,
        modelInfo,
        opts.primaryKeyField,
      )
      : "string";
  const idDescription =
    opts.dataSource === "mongodb"
      ? "MongoDB ObjectId as a hex string"
      : resolvedSql === "number"
        ? "Numeric primary key"
        : "Primary key value";
  const idApiType: "String" | "Number" =
    opts.dataSource === "sql" && resolvedSql === "number" ? "Number" : "String";

  const usedValidators = new Set<string>();
  const createDtoProperties: CreateDtoHbsField[] = [];
  for (const prop of modelInfo.properties) {
    const vNames =
      opts.useClassValidatorDecorators
        ? collectValidatorsForProperty(
          prop,
          opts.useIsEmailForEmailFields,
        )
        : [];
    vNames.forEach((n) => usedValidators.add(n));
    const decoratorLines: string[] = [];
    for (const n of vNames) {
      decoratorLines.push(`  @${n}()`);
    }
    if (opts.addSwagger) {
      let example = "example";
      if (prop.type === "number") {
        example = "1";
      } else if (prop.type === "boolean") {
        example = "true";
      } else if (prop.type === "Date") {
        example = "2024-01-01";
      }
      decoratorLines.push(
        `  @ApiProperty({ example: ${JSON.stringify(example)}, description: 'The ${prop.name} of the ${entityName}' })`,
      );
    }
    createDtoProperties.push({
      decoratorLines,
      name: prop.name,
      type: prop.type,
    });
  }
  const classValidatorImports = Array.from(usedValidators).sort();

  const isMongo = opts.dataSource === "mongodb";
  const isRest = opts.routeStrategy === "rest";
  const isSqlNumber =
    opts.dataSource === "sql" && resolvedSql === "number";
  const idTs = isMongo ? "string" : resolvedSql === "number" ? "number" : "string";
  const idParamForRest =
    isSqlNumber
      ? `@Param('id', ParseIntPipe) id: number`
      : `@Param('id') id: string`;
  const idParamForLegacy = idParamForRest;

  const addSwagger = opts.addSwagger;
  const swaggerImports = addSwagger
    ? "import { ApiOperation, ApiResponse, ApiTags, ApiParam } from '@nestjs/swagger';"
    : "";
  const swaggerClass = addSwagger
    ? `@ApiTags('${swaggerTag}')`
    : "";

  // REST common imports
  const restCommon: string[] = [
    "Controller",
    "Get",
    "Post",
    "Body",
    "Param",
    "Delete",
  ];
  if (opts.restUpdateMethod === "put") {
    restCommon.push("Put");
  } else {
    restCommon.push("Patch");
  }
  if (isSqlNumber) {
    restCommon.push("ParseIntPipe");
  }
  restCommon.sort();
  const restCommonImports = restCommon.join(", ");
  const updateDecorator =
    opts.restUpdateMethod === "put" ? "@Put(':id')" : "@Patch(':id')";

  const legacyCommon: string[] = [
    "Controller",
    "Get",
    "Post",
    "Body",
    "Param",
    "Delete",
    "Put",
  ];
  if (isSqlNumber) {
    legacyCommon.push("ParseIntPipe");
  }
  legacyCommon.sort();
  const legacyCommonImports = legacyCommon.join(", ");

  return {
    entityName,
    entityFile,
    entity,
    collectionName,
    entitiesPascal,
    finalRoute,
    swaggerTag,
    primaryKeyField: opts.primaryKeyField,
    dataSource: opts.dataSource,
    isMongo,
    isSql: opts.dataSource === "sql",
    sqlIdType: resolvedSql,
    isRest,
    isLegacy: !isRest,
    restUpdateMethod: opts.restUpdateMethod,
    isPut: opts.restUpdateMethod === "put",
    isPatch: opts.restUpdateMethod === "patch",
    addSwagger,
    useIsEmailForEmailFields: opts.useIsEmailForEmailFields,
    useClassValidatorDecorators: opts.useClassValidatorDecorators,
    routePrefix: opts.routePrefix,
    routeStrategy: opts.routeStrategy,
    idDescription,
    idApiType,
    idParamForRest,
    idParamForLegacy,
    isSqlNumber,
    idTs,
    classValidatorImports,
    createDtoProperties,
    model: { properties: modelInfo.properties, className: modelInfo.className, collectionName: modelInfo.collectionName },
    swaggerImports,
    swaggerClass,
    restCommonImports,
    updateDecorator,
    legacyCommonImports,
    rest: {
      swCreate: swaggerBlock(addSwagger, `Create ${entityName}`),
      swFindAll: swaggerBlock(addSwagger, `List all ${entityName}`),
      swFindOne: swaggerBlock(
        addSwagger,
        `Get ${entityName} by id`,
        { name: "id", typeName: idApiType, description: idDescription },
      ),
      swUpdate: swaggerBlock(
        addSwagger,
        `Update ${entityName}`,
        { name: "id", typeName: idApiType, description: idDescription },
      ),
      swDelete: swaggerBlock(
        addSwagger,
        `Delete ${entityName}`,
        { name: "id", typeName: idApiType, description: idDescription },
      ),
    },
    legacy: {
      swCreate: swaggerBlock(addSwagger, `Create ${entityName}`),
      swFindAll: swaggerBlock(addSwagger, `Find all ${entitiesPascal}`),
      swFindOne: swaggerBlock(
        addSwagger,
        `Find one ${entityName}`,
        { name: "id", typeName: idApiType, description: idDescription },
      ),
      swUpdate: swaggerBlock(
        addSwagger,
        `Update ${entityName}`,
        { name: "id", typeName: idApiType, description: idDescription },
      ),
      swDelete: swaggerBlock(
        addSwagger,
        `Delete ${entityName}`,
        { name: "id", typeName: idApiType, description: idDescription },
      ),
    },
  };
}
