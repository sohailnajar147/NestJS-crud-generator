import * as vscode from "vscode";
import type { CrudCodeGenOptions } from "./crudOptions";
import { readCrudOptions } from "./crudConfigFromVscode";
import { resolveAddSwaggerForWizard } from "./nestjsSwaggerCheck";

export const WIZARD_PRESET_MEMENTO_KEY = "nestjsCrud.wizardPreset.v1";

function loadWizardPreset(
  workspaceState: vscode.Memento,
): CrudCodeGenOptions | undefined {
  const raw = workspaceState.get<string | undefined>(WIZARD_PRESET_MEMENTO_KEY, undefined);
  if (!raw) {
    return undefined;
  }
  try {
    const j = JSON.parse(raw) as CrudCodeGenOptions;
    if (
      j.dataSource !== "mongodb" &&
      j.dataSource !== "sql"
    ) {
      return undefined;
    }
    return j;
  } catch {
    return undefined;
  }
}

function saveWizardPreset(
  workspaceState: vscode.Memento,
  opts: CrudCodeGenOptions,
): void {
  void workspaceState.update(
    WIZARD_PRESET_MEMENTO_KEY,
    JSON.stringify(opts),
  );
}

interface ValuedItem<T> extends vscode.QuickPickItem {
  value: T;
}

async function pickValued<T>(
  title: string,
  step: string,
  items: ValuedItem<T>[],
): Promise<T | undefined> {
  const chosen = await vscode.window.showQuickPick(items, {
    title: `${title} — ${step}`,
    placeHolder: "Choose (Esc to cancel)",
  });
  return chosen?.value;
}

function buildSummary(
  opts: CrudCodeGenOptions,
  entityLabel: string,
): string {
  const lines: string[] = [
    `Entity: ${entityLabel}`,
    `Data source: ${opts.dataSource}`,
  ];
  if (opts.dataSource === "sql") {
    lines.push(
      `SQL id: ${opts.sqlIdType} (field: ${opts.primaryKeyField})`,
    );
  }
  const route = opts.routeStrategy;
  lines.push(
    `Route style: ${route}`,
    route === "rest"
      ? `REST update: @${opts.restUpdateMethod === "put" ? "Put" : "Patch"}`
      : "Legacy (AddX, showX, …)",
    `Prefix: ${opts.routePrefix || "none"}`,
    `Swagger: ${opts.addSwagger ? "on" : "off"}`,
    `Register module: ${opts.autoRegisterModule ? "on" : "off"}`,
    `Email heuristics: ${opts.useIsEmailForEmailFields ? "on" : "off"}`,
    `class-validator on DTOs: ${opts.useClassValidatorDecorators ? "on" : "off"}`,
    `Service spec (Jest): ${opts.generateServiceSpec ? "on" : "off"}`,
  );
  return lines.join("\n");
}

type WizardMode = "quick" | "custom";

/**
 * Interactive wizard. Returns `undefined` if the user cancels.
 * Custom path persists the chosen options in workspace state for the Quick path.
 * @param entityFilePath — Entity `.ts` path (used to resolve node_modules for the Swagger check).
 */
export async function runCrudOptionsWizard(
  config: vscode.WorkspaceConfiguration,
  entityLabel: string,
  workspaceState: vscode.Memento,
  entityFilePath: string,
): Promise<CrudCodeGenOptions | undefined> {
  const o = readCrudOptions(config);

  const mode = await pickValued<WizardMode>("NestJS CRUD", "Options", [
    {
      label: "Quick (workspace defaults)",
      description: "Settings + your last custom choices (or settings only)",
      value: "quick",
    },
    {
      label: "Custom (step-by-step)",
      description: "Walk through 8 steps; options are saved for next time",
      value: "custom",
    },
  ]);
  if (mode === undefined) {
    return undefined;
  }

  if (mode === "quick") {
    const fromPreset = loadWizardPreset(workspaceState);
    let opts: CrudCodeGenOptions = {
      ...o,
      ...(fromPreset ?? {}),
    };
    const swaggerResolved = await resolveAddSwaggerForWizard(
      entityFilePath,
      opts.addSwagger,
    );
    if (swaggerResolved === undefined) {
      return undefined;
    }
    opts = { ...opts, addSwagger: swaggerResolved };
    const itemGen: vscode.MessageItem = { title: "Generate" };
    const itemAbort: vscode.MessageItem = { title: "Abort", isCloseAffordance: true };
    const confirm = await vscode.window.showInformationMessage(
      "Generate files with these options?",
      {
        modal: true,
        detail: buildSummary(opts, entityLabel),
      },
      itemGen,
      itemAbort,
    );
    if (confirm?.title !== "Generate") {
      return undefined;
    }
    return opts;
  }

  const dataSource = await pickValued("NestJS CRUD", "1/8 Data source", [
    {
      label: "MongoDB",
      description: "MongoRepository; string :id in routes",
      value: "mongodb" as const,
    },
    {
      label: "SQL (Postgres, MySQL, …)",
      description: "TypeORM Repository",
      value: "sql" as const,
    },
  ]);
  if (dataSource === undefined) {
    return undefined;
  }

  let sqlIdType = o.sqlIdType;
  if (dataSource === "sql") {
    const st = await pickValued("NestJS CRUD", "2/8 SQL primary key", [
      {
        label: "Auto",
        description: "Infer from entity (id, @PrimaryGeneratedColumn, …)",
        value: "auto" as const,
      },
      {
        label: "number",
        description: "Numeric id; ParseIntPipe in REST",
        value: "number" as const,
      },
      {
        label: "string",
        description: "UUID / string",
        value: "string" as const,
      },
    ]);
    if (st === undefined) {
      return undefined;
    }
    sqlIdType = st;
  }

  const routeStrategy = await pickValued("NestJS CRUD", "3/8 Route style", [
    {
      label: "REST (recommended)",
      description: "POST/GET, :id, PATCH/PUT, DELETE",
      value: "rest" as const,
    },
    {
      label: "Legacy",
      description: "AddX, showXs, showX/:id, …",
      value: "legacy" as const,
    },
  ]);
  if (routeStrategy === undefined) {
    return undefined;
  }

  let restUpdateMethod = o.restUpdateMethod;
  if (routeStrategy === "rest") {
    const m = await pickValued("NestJS CRUD", "4/8 REST update", [
      {
        label: "PATCH",
        description: "Partial update (default)",
        value: "patch" as const,
      },
      {
        label: "PUT",
        description: "Replace style",
        value: "put" as const,
      },
    ]);
    if (m === undefined) {
      return undefined;
    }
    restUpdateMethod = m;
  }

  const addSwaggerChoice = await pickValued("NestJS CRUD", "5/8 OpenAPI (Swagger)", [
    {
      label: "Add Swagger decorators",
      value: true,
    },
    {
      label: "Skip Swagger",
      description: "No @Api… imports",
      value: false,
    },
  ]);
  if (addSwaggerChoice === undefined) {
    return undefined;
  }
  const addSwagger = await resolveAddSwaggerForWizard(
    entityFilePath,
    addSwaggerChoice,
  );
  if (addSwagger === undefined) {
    return undefined;
  }

  const autoRegisterModule = await pickValued("NestJS CRUD", "6/8 Register in module", [
    {
      label: "Update nearest *.module.ts",
      description: "AST: imports, forFeature, controller, provider",
      value: true,
    },
    {
      label: "Do not change module",
      value: false,
    },
  ]);
  if (autoRegisterModule === undefined) {
    return undefined;
  }

  const useIsEmail = await pickValued("NestJS CRUD", "7/8 String ‘email’ fields", [
    {
      label: "Use @IsEmail when the property name includes “email”",
      value: true,
    },
    {
      label: "Always @IsString for string fields",
      value: false,
    },
  ]);
  if (useIsEmail === undefined) {
    return undefined;
  }

  const generateServiceSpec = await pickValued(
    "NestJS CRUD",
    "8/8 Jest spec for service",
    [
      {
        label: "Do not add *.service.spec.ts",
        value: false,
      },
      {
        label: "Add *.service.spec.ts (Jest, mocked repository)",
        value: true,
      },
    ],
  );
  if (generateServiceSpec === undefined) {
    return undefined;
  }

  const routePrefix = await vscode.window.showInputBox({
    title: "NestJS CRUD",
    prompt: "Route prefix (e.g. api/v1) — leave empty for none",
    value: o.routePrefix,
  });
  if (routePrefix === undefined) {
    return undefined;
  }

  const primaryKey = await vscode.window.showInputBox({
    title: "NestJS CRUD",
    prompt: "SQL primary key property name (ignored for Mongo)",
    value: o.primaryKeyField,
  });
  if (primaryKey === undefined) {
    return undefined;
  }

  const opts: CrudCodeGenOptions = {
    ...o,
    dataSource,
    sqlIdType,
    routeStrategy,
    restUpdateMethod,
    addSwagger,
    autoRegisterModule,
    useIsEmailForEmailFields: useIsEmail,
    generateServiceSpec,
    routePrefix: routePrefix.trim(),
    primaryKeyField: primaryKey.trim() || "id",
  };

  const itemGen2: vscode.MessageItem = { title: "Generate" };
  const itemAbort2: vscode.MessageItem = { title: "Abort", isCloseAffordance: true };
  const confirm = await vscode.window.showInformationMessage(
    "Generate files with these options?",
    {
      modal: true,
      detail: buildSummary(opts, entityLabel),
    },
    itemGen2,
    itemAbort2,
  );
  if (confirm?.title !== "Generate") {
    return undefined;
  }

  saveWizardPreset(workspaceState, opts);
  return opts;
}

/**
 * Workspace defaults merged with the last custom wizard run, with Swagger
 * resolution against the open project. Used by the “quick generate” command.
 */
export async function resolveQuickCrudOptions(
  config: vscode.WorkspaceConfiguration,
  workspaceState: vscode.Memento,
  entityFilePath: string,
): Promise<CrudCodeGenOptions | undefined> {
  const o = readCrudOptions(config);
  const fromPreset = loadWizardPreset(workspaceState);
  let opts: CrudCodeGenOptions = { ...o, ...(fromPreset ?? {}) };
  const swaggerResolved = await resolveAddSwaggerForWizard(
    entityFilePath,
    opts.addSwagger,
  );
  if (swaggerResolved === undefined) {
    return undefined;
  }
  opts = { ...opts, addSwagger: swaggerResolved };
  return opts;
}
