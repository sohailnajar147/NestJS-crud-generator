import * as path from "path";
import * as vscode from "vscode";
import type { CrudCodeGenOptions, PreviewMode } from "./crudOptions";

type DataSourceSetting = "mongodb" | "sql";
type SqlIdTypeSetting = "number" | "string" | "auto";
type RouteStrategySetting = "rest" | "legacy";
type RestUpdateSetting = "put" | "patch";

function nullIfEmpty(
  s: string | null | undefined,
): string | null {
  if (s == null) {
    return null;
  }
  const t = String(s).trim();
  return t.length === 0 ? null : t;
}

/**
 * Turn `nestjsCrud.templatesPath` into an absolute path: workspace-relative when not absolute, otherwise as-is. Returns `null` when the setting is empty (use built-in codegen).
 * For a **relative** path with no workspace folder, returns `null`; callers that need a strict error should check first (see `runGenerateCrud`).
 */
export function resolveCrudTemplateRoot(
  raw: string | null | undefined,
  folder: vscode.WorkspaceFolder | undefined,
): string | null {
  const t = nullIfEmpty(raw);
  if (t === null) {
    return null;
  }
  if (path.isAbsolute(t)) {
    return t;
  }
  if (!folder) {
    return null;
  }
  return path.join(folder.uri.fsPath, t);
}

/**
 * Read codegen options from workspace / user `nestjsCrud` settings.
 */
export function readCrudOptions(
  config: vscode.WorkspaceConfiguration,
): CrudCodeGenOptions {
  return {
    addSwagger: config.get<boolean>("addSwagger", true),
    useIsEmailForEmailFields: config.get<boolean>("useIsEmailForEmailFields", true),
    routePrefix: config.get<string>("routePrefix", ""),
    autoRegisterModule: config.get<boolean>("autoRegisterModule", true),
    dataSource: config.get<DataSourceSetting>("dataSource", "mongodb"),
    sqlIdType: config.get<SqlIdTypeSetting>("sqlIdType", "auto"),
    primaryKeyField: config.get<string>("primaryKeyField", "id"),
    routeStrategy: config.get<RouteStrategySetting>("routeStrategy", "rest"),
    restUpdateMethod: config.get<RestUpdateSetting>("restUpdateMethod", "patch"),
    templatesPath: nullIfEmpty(config.get<string | null | undefined>("templatesPath", undefined)),
    generateServiceSpec: config.get<boolean>("generateServiceSpec", false),
    includeInheritedEntityProperties: config.get<boolean>(
      "includeInheritedEntityProperties",
      true,
    ),
    useClassValidatorDecorators: config.get<boolean>(
      "useClassValidatorDecorators",
      false,
    ),
  };
}

export function readPreviewMode(
  config: vscode.WorkspaceConfiguration,
): PreviewMode {
  return config.get<PreviewMode>("previewMode", "perFile");
}

export function readTrustEntityFileWithoutEntitySuffix(
  config: vscode.WorkspaceConfiguration,
): boolean {
  return config.get<boolean>("trustEntityFileWithoutEntitySuffix", false);
}

export function getShowWizard(
  config: vscode.WorkspaceConfiguration,
): boolean {
  return config.get<boolean>("showOptionsWizard", true);
}
