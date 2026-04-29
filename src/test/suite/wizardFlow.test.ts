import * as assert from "assert";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { readCrudOptions } from "../../crudConfigFromVscode";
import { runGenerateCrud } from "../../runGenerateCrud";
import {
  runCrudOptionsWizard,
  WIZARD_PRESET_MEMENTO_KEY,
} from "../../crudWizard";
import type { CrudCodeGenOptions } from "../../crudOptions";

class Mem implements vscode.Memento {
  private store = new Map<string, string>();
  keys(): readonly string[] {
    return [...this.store.keys()];
  }
  get<T>(k: string, defaultValue?: T): T {
    if (this.store.has(k)) {
      return this.store.get(k) as T;
    }
    return defaultValue as T;
  }
  update(k: string, v: unknown): Thenable<void> {
    this.store.set(k, String(v));
    return Promise.resolve();
  }
}

suite("wizard flow (Quick + generate to temp)", () => {
  test("Quick path with preset yields SQL options from memento", async function () {
    this.timeout(60000);
    const ext = vscode.extensions.getExtension("sohailnajar.nestjs-crud-generator");
    assert.ok(ext);
    await ext?.activate();

    const mem = new Mem();
    const preset: CrudCodeGenOptions = {
      ...readCrudOptions(vscode.workspace.getConfiguration("nestjsCrud")),
      dataSource: "sql",
      sqlIdType: "number",
      routeStrategy: "rest",
      restUpdateMethod: "patch",
      addSwagger: false,
      autoRegisterModule: false,
      useIsEmailForEmailFields: false,
      routePrefix: "api",
      primaryKeyField: "id",
      templatesPath: null,
      generateServiceSpec: false,
      includeInheritedEntityProperties: true,
    };
    await mem.update(WIZARD_PRESET_MEMENTO_KEY, JSON.stringify(preset));

    const origQp = vscode.window.showQuickPick;
    const origIm = vscode.window.showInformationMessage;

    vscode.window.showQuickPick = (async () => {
      return { label: "Quick", value: "quick" } as vscode.QuickPickItem;
    }) as unknown as typeof vscode.window.showQuickPick;

    vscode.window.showInformationMessage = (async () => {
      return { title: "Generate" } as vscode.MessageItem;
    }) as unknown as typeof vscode.window.showInformationMessage;

    try {
      const config = vscode.workspace.getConfiguration("nestjsCrud");
      const r = await runCrudOptionsWizard(
        config,
        "Sample",
        mem,
        path.join(os.tmpdir(), "sample.entity.ts"),
      );
      assert.ok(r);
      assert.strictEqual(r?.dataSource, "sql");
      assert.strictEqual(r?.sqlIdType, "number");
      assert.strictEqual(r?.addSwagger, false);
    } finally {
      vscode.window.showQuickPick = origQp;
      vscode.window.showInformationMessage = origIm;
    }
  });

  test("runGenerateCrud writes four files when previews are auto-confirmed", async function () {
    this.timeout(120000);
    const ext = vscode.extensions.getExtension("sohailnajar.nestjs-crud-generator");
    assert.ok(ext);
    await ext?.activate();

    const root = await fs.mkdtemp(path.join(os.tmpdir(), "nest-crud-wiz-"));
    const entDir = path.join(root, "src", "feat", "entities");
    await fs.mkdir(entDir, { recursive: true });
    const entityPath = path.join(entDir, "thing.entity.ts");
    const entitySrc = `import { Entity, Column } from 'typeorm';

@Entity('things')
export class Thing {
  @Column() name: string;
}
`;
    await fs.writeFile(entityPath, entitySrc, "utf8");
    const doc = await vscode.workspace.openTextDocument(entityPath);

    const origQp = vscode.window.showQuickPick;
    const origIm = vscode.window.showInformationMessage;
    const origEx = vscode.commands.executeCommand;

    vscode.window.showQuickPick = (async (
      items: readonly vscode.QuickPickItem[],
    ) => {
      const first = items[0] as { id?: string; action?: string } | undefined;
      if (first?.id === "go") {
        return { id: "go", label: "Start" } as vscode.QuickPickItem;
      }
      if (first?.action === "write") {
        return items[0] as vscode.QuickPickItem;
      }
      return origQp(items, {});
    }) as unknown as typeof vscode.window.showQuickPick;

    /** Success toast has actions; the real API would wait for a click. */
    vscode.window.showInformationMessage = (async () => {
      return undefined;
    }) as unknown as typeof vscode.window.showInformationMessage;

    vscode.commands.executeCommand = ((
      cmd: string,
      ..._rest: unknown[]
    ) => {
      if (cmd === "vscode.diff") {
        return Promise.resolve(undefined);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call -- test stub
      return (origEx as any)(...([cmd, ..._rest] as [string, ...unknown[]]));
    }) as unknown as typeof vscode.commands.executeCommand;

    try {
      const base = readCrudOptions(
        vscode.workspace.getConfiguration("nestjsCrud"),
      );
      const opts: CrudCodeGenOptions = {
        ...base,
        dataSource: "mongodb",
        autoRegisterModule: false,
        addSwagger: false,
      };
      await runGenerateCrud(doc, opts, { memento: new Mem() });
    } finally {
      vscode.window.showQuickPick = origQp;
      vscode.window.showInformationMessage = origIm;
      vscode.commands.executeCommand = origEx;
    }

    const dtoDir = path.join(path.dirname(entDir), "dto");
    const outBase = path.join(path.dirname(entDir), "thing");
    for (const p of [
      path.join(dtoDir, "create-thing.dto.ts"),
      path.join(dtoDir, "update-thing.dto.ts"),
      `${outBase}.service.ts`,
      `${outBase}.controller.ts`,
    ]) {
      const st = await fs.stat(p);
      assert.ok(st.isFile(), `expected ${p}`);
    }
    const svc = await fs.readFile(`${outBase}.service.ts`, "utf8");
    assert.match(svc, /ThingService/);
  });
});
