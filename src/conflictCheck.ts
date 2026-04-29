import * as fs from "fs/promises";
import * as path from "path";

const controllerRouteRe = /@Controller\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/;

/**
 * Scans the feature module folder for routes or DTO class names that would
 * duplicate what this generation would add (other files only — generated targets are skipped).
 */
export async function findCrudNamingConflicts(
  moduleDir: string,
  opts: {
    finalRoute: string;
    entityName: string;
    entityFile: string;
  },
): Promise<string[]> {
  const { finalRoute, entityName, entityFile } = opts;
  const issues: string[] = [];
  const createDtoClass = `Create${entityName}Dto`;
  const ownFiles = new Set([
    `create-${entityFile}.dto.ts`,
    `update-${entityFile}.dto.ts`,
    `${entityFile}.service.ts`,
    `${entityFile}.service.spec.ts`,
    `${entityFile}.controller.ts`,
  ]);

  const dirs = [moduleDir, path.join(moduleDir, "dto")];
  for (const dir of dirs) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".ts")) {
        continue;
      }
      if (ownFiles.has(e.name)) {
        continue;
      }
      const full = path.join(dir, e.name);
      const text = await fs.readFile(full, "utf8");
      if (e.name.endsWith("controller.ts")) {
        const m = text.match(controllerRouteRe);
        if (m?.[1] === finalRoute) {
          issues.push(
            `Controller path ${JSON.stringify(finalRoute)} is already used in ${e.name}.`,
          );
        }
      }
      const createDtoRe = new RegExp(
        `\\b(export\\s+)?(abstract\\s+)?class\\s+${createDtoClass}\\b`,
        "m",
      );
      if (createDtoRe.test(text)) {
        issues.push(
          `Class ${createDtoClass} is already defined in ${e.name}.`,
        );
      }
    }
  }
  return issues;
}
