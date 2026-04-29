import * as assert from "assert";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { previewPatchNestModule } from "../../nestModulePatcher";

suite("nestModulePatcher", () => {
  const baseNames = { entityName: "Item", entityFile: "item" };

  test("adds required imports to a 3-import module with inline arrays", async () => {
    const withArrays = `import { Module } from '@nestjs/common';
import { ExtA } from 'a';
import { ExtB } from 'b';
import { ExtC } from 'c';

@Module({
  imports: [RootMod],
  controllers: [BaseCtrl],
  providers: [BaseSvc],
})
export class FeatModule {}
`;
    const dir = await fs.mkdtemp(
      path.join(os.tmpdir(), "nest-crud-pmod-"),
    );
    const mp = path.join(dir, "feat.module.ts");
    await fs.writeFile(mp, withArrays, "utf8");
    const paths = {
      entityAbsolutePath: path.join(dir, "entities", "item.entity.ts"),
      serviceAbsolutePath: path.join(dir, "item.service.ts"),
      controllerAbsolutePath: path.join(dir, "item.controller.ts"),
    };
    const r = await previewPatchNestModule({ moduleFilePath: mp, ...baseNames, ...paths });
    assert.ok(r.ok, !r.ok ? r.message : "expected ok");
    if (r.ok) {
      const t = r.text;
      assert.match(t, /TypeOrmModule/);
      assert.match(t, /from ['"]@nestjs\/typeorm['"]/);
      assert.match(t, /from ['"]\.\/item\.service['"]/);
      assert.match(t, /from ['"]\.\/item\.controller['"]/);
      assert.match(t, /from ['"]\.\/entities\/item\.entity['"]/);
      assert.match(t, /TypeOrmModule\.forFeature\(\[Item\]\)/);
    }
  });

  test("adds an imports array when the module has none (edge case)", async () => {
    const noImports = `import { Module } from '@nestjs/common';

@Module({
  controllers: [BaseCtrl],
  providers: [BaseSvc],
})
export class NakedModule {}
`;
    const dir = await fs.mkdtemp(
      path.join(os.tmpdir(), "nest-crud-ni-"),
    );
    const mp = path.join(dir, "naked.module.ts");
    await fs.writeFile(mp, noImports, "utf8");
    const paths = {
      entityAbsolutePath: path.join(dir, "entities", "item.entity.ts"),
      serviceAbsolutePath: path.join(dir, "item.service.ts"),
      controllerAbsolutePath: path.join(dir, "item.controller.ts"),
    };
    const r = await previewPatchNestModule({ moduleFilePath: mp, ...baseNames, ...paths });
    assert.ok(r.ok, !r.ok ? r.message : "expected ok");
    if (r.ok) {
      const t = r.text;
      assert.match(
        t,
        /imports:\s*\[[^\]]*TypeOrmModule\.forFeature\(\[Item\]\)/s,
        "forFeature should be in a new imports array",
      );
    }
  });

  test("import paths from app.module.ts nest beside src/feature layout", async () => {
    const modSrc = `import { Module } from '@nestjs/common';
import { RootMod } from 'root';

@Module({
  imports: [RootMod],
  controllers: [],
  providers: [],
})
export class AppModule {}
`;
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nest-crud-appmod-"));
    const src = path.join(dir, "src");
    await fs.mkdir(src, { recursive: true });
    const appMp = path.join(src, "app.module.ts");
    await fs.writeFile(appMp, modSrc, "utf8");
    const feat = path.join(src, "feature");
    const paths = {
      entityAbsolutePath: path.join(feat, "entities", "item.entity.ts"),
      serviceAbsolutePath: path.join(feat, "item.service.ts"),
      controllerAbsolutePath: path.join(feat, "item.controller.ts"),
    };
    const r = await previewPatchNestModule({
      moduleFilePath: appMp,
      ...baseNames,
      ...paths,
    });
    assert.ok(r.ok, !r.ok ? r.message : "expected ok");
    if (r.ok) {
      const t = r.text;
      assert.match(t, /from ['"]\.\/feature\/entities\/item\.entity['"]/);
      assert.match(t, /from ['"]\.\/feature\/item\.service['"]/);
      assert.match(t, /from ['"]\.\/feature\/item\.controller['"]/);
    }
  });
});
