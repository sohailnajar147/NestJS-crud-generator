import {
  ArrayLiteralExpression,
  ObjectLiteralExpression,
  Project,
  PropertyAssignment,
  SourceFile,
  SyntaxKind,
} from "ts-morph";
import * as fs from "fs/promises";
import * as path from "path";
import * as ts from "typescript";

export interface PatchNestModuleParams {
  moduleFilePath: string;
  entityName: string;
  entityFile: string;
  /** Absolute paths — imports are computed relative to `moduleFilePath` (e.g. patching `app.module.ts`). */
  entityAbsolutePath: string;
  serviceAbsolutePath: string;
  controllerAbsolutePath: string;
}

export type PatchNestModuleResult =
  | { ok: true }
  | { ok: false; message: string; snippet: string };

/**
 * Relative import specifier from a Nest module file to another source file (no extension).
 */
export function relativeTsImport(moduleFilePath: string, targetFilePath: string): string {
  const fromDir = path.dirname(moduleFilePath);
  let rel = path.relative(fromDir, path.normalize(targetFilePath));
  if (rel === "") {
    rel = path.basename(targetFilePath);
  }
  rel = rel.split(path.sep).join("/");
  if (!rel.startsWith(".")) {
    rel = `./${rel}`;
  }
  return rel.replace(/\.tsx?$/, "");
}

function resolveImportPaths(p: PatchNestModuleParams): {
  entity: string;
  service: string;
  controller: string;
} {
  const m = p.moduleFilePath;
  return {
    entity: relativeTsImport(m, p.entityAbsolutePath),
    service: relativeTsImport(m, p.serviceAbsolutePath),
    controller: relativeTsImport(m, p.controllerAbsolutePath),
  };
}

function buildManualSnippet(p: PatchNestModuleParams): string {
  const { entityName } = p;
  const { entity: entPath, service: svcPath, controller: ctrlPath } =
    resolveImportPaths(p);
  return `// Add these imports if missing:
import { TypeOrmModule } from '@nestjs/typeorm';
import { ${entityName} } from '${entPath}';
import { ${entityName}Service } from '${svcPath}';
import { ${entityName}Controller } from '${ctrlPath}';

// In @Module({ ... }):
// imports: [..., TypeOrmModule.forFeature([${entityName}])],
// controllers: [..., ${entityName}Controller],
// providers: [..., ${entityName}Service],
`;
}

function getModuleObjectLiteral(
  sourceFile: SourceFile,
): ObjectLiteralExpression | undefined {
  for (const cls of sourceFile.getClasses()) {
    const mod = cls.getDecorator("Module");
    if (!mod) {
      continue;
    }
    const arg = mod.getArguments()[0];
    if (arg?.getKind() === SyntaxKind.ObjectLiteralExpression) {
      return arg as ObjectLiteralExpression;
    }
  }
  return undefined;
}

function getOrCreateArrayProperty(
  obj: ObjectLiteralExpression,
  name: "imports" | "controllers" | "providers",
): { array: ArrayLiteralExpression } | { error: string } {
  const prop = obj.getProperty(name);
  if (!prop) {
    const pa = obj.addPropertyAssignment({
      name,
      initializer: "[]",
    });
    const init = pa.getInitializer();
    if (init?.getKind() !== SyntaxKind.ArrayLiteralExpression) {
      return { error: `${name} initializer is not an array literal` };
    }
    return { array: init as ArrayLiteralExpression };
  }
  if (prop.getKind() !== SyntaxKind.PropertyAssignment) {
    return { error: `${name} is not a property assignment` };
  }
  const pa = prop as PropertyAssignment;
  const init = pa.getInitializer();
  if (!init) {
    return { error: `${name} has no initializer` };
  }
  if (init.getKind() !== SyntaxKind.ArrayLiteralExpression) {
    return {
      error: `${name} must be an inline array literal (e.g. [A, B] or [...X, Y]); variable references and function calls are not supported.`,
    };
  }
  return { array: init as ArrayLiteralExpression };
}

function arrayTextHasElement(array: ArrayLiteralExpression, literal: string): boolean {
  const t = array.getText();
  return t.includes(literal);
}

function ensureNamedImport(
  sourceFile: SourceFile,
  moduleSpecifier: string,
  name: string,
): void {
  const decl = sourceFile.getImportDeclaration(
    (d) => d.getModuleSpecifierValue() === moduleSpecifier,
  );
  if (!decl) {
    sourceFile.addImportDeclaration({
      moduleSpecifier,
      namedImports: [{ name }],
    });
    return;
  }
  if (decl.getNamedImports().some((n) => n.getName() === name)) {
    return;
  }
  decl.addNamedImport(name);
}

function applyTypeormModule(
  sourceFile: SourceFile,
  params: PatchNestModuleParams,
): PatchNestModuleResult {
  const { entityName } = params;
  const { entity: entPath, service: svcPath, controller: ctrlPath } =
    resolveImportPaths(params);
  const snippet = buildManualSnippet(params);
  const modObj = getModuleObjectLiteral(sourceFile);
  if (!modObj) {
    return {
      ok: false,
      message: "No @Module({ ... }) with a static object literal found in this file.",
      snippet,
    };
  }
  ensureNamedImport(sourceFile, "@nestjs/typeorm", "TypeOrmModule");
  ensureNamedImport(sourceFile, svcPath, `${entityName}Service`);
  ensureNamedImport(sourceFile, ctrlPath, `${entityName}Controller`);
  ensureNamedImport(sourceFile, entPath, entityName);

  const importsArr = getOrCreateArrayProperty(modObj, "imports");
  if ("error" in importsArr) {
    return { ok: false, message: importsArr.error, snippet };
  }
  const feature = `TypeOrmModule.forFeature([${entityName}])`;
  if (!arrayTextHasElement(importsArr.array, feature)) {
    importsArr.array.addElement(feature);
  }

  const ctrlArr = getOrCreateArrayProperty(modObj, "controllers");
  if ("error" in ctrlArr) {
    return { ok: false, message: ctrlArr.error, snippet };
  }
  const ctrlName = `${entityName}Controller`;
  if (!arrayTextHasElement(ctrlArr.array, ctrlName)) {
    ctrlArr.array.addElement(ctrlName);
  }

  const provArr = getOrCreateArrayProperty(modObj, "providers");
  if ("error" in provArr) {
    return { ok: false, message: provArr.error, snippet };
  }
  const svcName = `${entityName}Service`;
  if (!arrayTextHasElement(provArr.array, svcName)) {
    provArr.array.addElement(svcName);
  }

  return { ok: true };
}

export function patchNestModule(params: PatchNestModuleParams): PatchNestModuleResult {
  const snippet = buildManualSnippet(params);

  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      strict: true,
      esModuleInterop: true,
    },
  });

  let sourceFile: SourceFile;
  try {
    sourceFile = project.addSourceFileAtPath(params.moduleFilePath);
  } catch (e) {
    return {
      ok: false,
      message: `Could not load ${params.moduleFilePath}: ${String(e)}`,
      snippet,
    };
  }

  const r = applyTypeormModule(sourceFile, params);
  if (r.ok) {
    sourceFile.saveSync();
  }
  return r;
}

export type PreviewPatchNestModuleResult =
  | { ok: true; text: string }
  | { ok: false; message: string; snippet: string };

export async function previewPatchNestModule(
  params: PatchNestModuleParams,
): Promise<PreviewPatchNestModuleResult> {
  const snippet = buildManualSnippet(params);
  let content: string;
  try {
    content = await fs.readFile(params.moduleFilePath, "utf8");
  } catch (e) {
    return {
      ok: false,
      message: `Could not load ${params.moduleFilePath}: ${String(e)}`,
      snippet,
    };
  }

  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      strict: true,
      esModuleInterop: true,
    },
  });

  const sourceFile = project.createSourceFile("preview.module.ts", content, {
    overwrite: true,
  });

  const r = applyTypeormModule(sourceFile, params);
  if (!r.ok) {
    return r;
  }
  return { ok: true, text: sourceFile.getFullText() };
}
