import * as assert from "assert";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import {
  isNestjsSwaggerPackageInstalled,
  resolveAddSwaggerForWizard,
  suggestNestjsSwaggerInstallCommand,
} from "../../nestjsSwaggerCheck";

suite("nestjs swagger package check", () => {
  test("is false when @nestjs/swagger is not installed in tree", async function () {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-sw-"));
    const ent = path.join(root, "src", "a", "entities", "e.entity.ts");
    await fs.mkdir(path.dirname(ent), { recursive: true });
    await fs.writeFile(ent, "export class E {}\n", "utf8");
    const ok = await isNestjsSwaggerPackageInstalled(ent);
    assert.strictEqual(ok, false);
  });

  test("is true when node_modules @nestjs/swagger exists in ancestor", async function () {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-sw-"));
    const mark = path.join(
      root,
      "node_modules",
      "@nestjs",
      "swagger",
      "package.json",
    );
    await fs.mkdir(path.dirname(mark), { recursive: true });
    await fs.writeFile(mark, "{}", "utf8");
    const ent = path.join(
      root,
      "apps",
      "api",
      "src",
      "ents",
      "e.entity.ts",
    );
    await fs.mkdir(path.dirname(ent), { recursive: true });
    await fs.writeFile(ent, "x", "utf8");
    const ok = await isNestjsSwaggerPackageInstalled(ent);
    assert.strictEqual(ok, true);
  });

  test("suggest install prefers pnpm / yarn / npm from nearest lock file", async function () {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-sw-"));
    const ent = path.join(root, "src", "e.entity.ts");
    await fs.mkdir(path.dirname(ent), { recursive: true });
    await fs.writeFile(ent, "x", "utf8");
    assert.strictEqual(
      await suggestNestjsSwaggerInstallCommand(ent),
      "npm i @nestjs/swagger",
    );
    await fs.writeFile(path.join(root, "pnpm-lock.yaml"), "", "utf8");
    assert.strictEqual(
      await suggestNestjsSwaggerInstallCommand(ent),
      "pnpm add @nestjs/swagger",
    );
  });

  test("resolveAddSwaggerForWizard skips UI when user chose skip or package present", async function () {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-sw-"));
    const ent = path.join(root, "e.entity.ts");
    await fs.writeFile(ent, "x", "utf8");
    assert.strictEqual(await resolveAddSwaggerForWizard(ent, false), false);

    const mark = path.join(
      root,
      "node_modules",
      "@nestjs",
      "swagger",
      "package.json",
    );
    await fs.mkdir(path.dirname(mark), { recursive: true });
    await fs.writeFile(mark, "{}", "utf8");
    assert.strictEqual(await resolveAddSwaggerForWizard(ent, true), true);
  });
});
