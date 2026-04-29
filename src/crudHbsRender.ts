import * as fs from "fs";
import * as path from "path";
import Handlebars from "handlebars";

const REQUIRED_OUTPUTS = [
  "create-dto.hbs",
  "update-dto.hbs",
  "service.hbs",
  "controller.hbs",
] as const;

/**
 * Load all `*.hbs` from `templateRoot`, register `_*.hbs` as partials, and render the four required templates.
 */
export function renderCrudFromHandlebarsTemplatesSync(
  templateRoot: string,
  view: Record<string, unknown>,
): {
  createDto: string;
  updateDto: string;
  service: string;
  controller: string;
} {
  const hbs = Handlebars.create();
  hbs.registerHelper("eq", (a: unknown, b: unknown) => a === b);

  let names: string[];
  try {
    names = fs.readdirSync(templateRoot);
  } catch (e) {
    throw new Error(
      `Custom templates: cannot read folder "${templateRoot}": ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const hbsFiles = names.filter((n) => n.endsWith(".hbs"));
  for (const req of REQUIRED_OUTPUTS) {
    if (!hbsFiles.includes(req)) {
      throw new Error(
        `Custom templates: required file "${req}" is missing in "${templateRoot}". Add it or clear nestjsCrud.templatesPath.`,
      );
    }
  }

  for (const f of hbsFiles) {
    if (f.startsWith("_")) {
      const partialName = f.replace(/\.hbs$/, "");
      const src = fs.readFileSync(path.join(templateRoot, f), "utf8");
      hbs.registerPartial(partialName, src);
    }
  }

  function compileAndRun(name: string): string {
    const src = fs.readFileSync(path.join(templateRoot, name), "utf8");
    const t = hbs.compile(src, { strict: false });
    return t(view) as string;
  }

  return {
    createDto: compileAndRun("create-dto.hbs"),
    updateDto: compileAndRun("update-dto.hbs"),
    service: compileAndRun("service.hbs"),
    controller: compileAndRun("controller.hbs"),
  };
}
