import * as fs from "fs";
import type { CrudCodeGenOptions } from "./crudOptions";
import { buildControllerFile } from "./codegen/controllerCode";
import { buildCreateDtoFile, buildUpdateDtoFile } from "./codegen/dtoCode";
import { pluralPascalForRoutes } from "./codegen/plural";
import { buildServiceFile } from "./codegen/serviceCode";
import { buildServiceSpecFile } from "./codegen/serviceSpecCode";
import { buildCrudHbsViewModel } from "./crudHbsContext";
import { renderCrudFromHandlebarsTemplatesSync } from "./crudHbsRender";
import type { ModelInfo } from "./modelParser";
import { parseModelFromText } from "./modelParser";
import { resolveSqlIdType } from "./sqlIdInference";

/**
 * Core codegen used by the extension and by golden fixture scripts (no vscode import).
 * @param templateRoot If set, loads `create-dto.hbs`, `update-dto.hbs`, `service.hbs`, and `controller.hbs` from that folder; otherwise uses built-in string builders.
 */
export function buildAllFileContents(
  modelInfo: ModelInfo,
  entityFile: string,
  entityText: string,
  opts: CrudCodeGenOptions,
  templateRoot: string | null = null,
): {
  createDto: string;
  updateDto: string;
  service: string;
  controller: string;
  serviceSpec: string | null;
} {
  const tr = templateRoot && String(templateRoot).trim();
  if (tr) {
    if (!fs.existsSync(tr) || !fs.statSync(tr).isDirectory()) {
      throw new Error(
        `Custom templates: nestjsCrud.templatesPath is not an existing directory: "${tr}"`,
      );
    }
    const view = buildCrudHbsViewModel(modelInfo, entityFile, entityText, opts);
    const rendered = renderCrudFromHandlebarsTemplatesSync(tr, view);
    return { ...rendered, serviceSpec: null };
  }

  const entityName = modelInfo.className;
  const collectionName = modelInfo.collectionName;
  const entitiesPascal = pluralPascalForRoutes(entityName);
  const finalRoute = opts.routePrefix
    ? `${opts.routePrefix}/${collectionName}`
    : collectionName;

  const resolvedSqlId =
    opts.dataSource === "sql"
      ? resolveSqlIdType(
        opts.sqlIdType,
        entityText,
        modelInfo,
        opts.primaryKeyField,
        )
      : ("string" as const);

  const createDto = buildCreateDtoFile({
    model: modelInfo,
    entityName,
    addSwagger: opts.addSwagger,
    useIsEmailForEmailFields: opts.useIsEmailForEmailFields,
    useClassValidatorDecorators: opts.useClassValidatorDecorators,
  });

  const serviceContent = buildServiceFile({
    entityName,
    entityFile,
    dataSource: opts.dataSource,
    sqlIdType: resolvedSqlId,
    primaryKeyField: opts.primaryKeyField,
  });

  const controllerContent = buildControllerFile({
    entityName,
    entityFile,
    finalRoute,
    swaggerTag: collectionName,
    entitiesPascal: entitiesPascal,
    dataSource: opts.dataSource,
    sqlIdType: resolvedSqlId,
    routeStrategy: opts.routeStrategy,
    restUpdateMethod: opts.restUpdateMethod,
    addSwagger: opts.addSwagger,
  });

  const serviceSpec = opts.generateServiceSpec
    ? buildServiceSpecFile({
      entityName,
      entityFile,
      dataSource: opts.dataSource,
    })
    : null;

  return {
    createDto: createDto.content,
    updateDto: buildUpdateDtoFile(entityName, entityFile),
    service: serviceContent,
    controller: controllerContent,
    serviceSpec,
  };
}

export function generateCrudFileContents(
  modelText: string,
  baseName: string,
  opts: CrudCodeGenOptions,
  templateRoot: string | null = null,
): {
  createDto: string;
  updateDto: string;
  service: string;
  controller: string;
} {
  const modelInfo = parseModelFromText(modelText);
  const withSpec = buildAllFileContents(
    modelInfo,
    baseName,
    modelText,
    opts,
    templateRoot,
  );
  return {
    createDto: withSpec.createDto,
    updateDto: withSpec.updateDto,
    service: withSpec.service,
    controller: withSpec.controller,
  };
}
