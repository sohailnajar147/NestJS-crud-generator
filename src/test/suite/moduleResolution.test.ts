import * as assert from "assert";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import {
  getDefaultModuleUriForEntity,
  LAST_SELECTED_MODULE_MEMENTO_KEY,
  sortNestModuleUris,
} from "../../resolveNestModule";

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

suite("module resolution (3 *.module.ts)", () => {
  test("sortNestModuleUris returns all 3, sorted by relative path order", () => {
    const root = path.join(os.tmpdir(), "nest-res-a");
    const m1 = path.join(root, "alpha.module.ts");
    const m2 = path.join(root, "zeta.module.ts");
    const m3 = path.join(root, "mid.module.ts");
    const uris = [vscode.Uri.file(m2), vscode.Uri.file(m1), vscode.Uri.file(m3)];
    const sorted = sortNestModuleUris(uris);
    assert.strictEqual(sorted.length, 3);
    const rels = sorted.map((u) => path.basename(u.fsPath));
    const expected = [m1, m2, m3]
      .map((p) => path.basename(p))
      .sort((a, b) => a.localeCompare(b));
    assert.deepStrictEqual(rels, expected);
  });

  test("getDefaultModuleUriForEntity picks last memento when still in the list", async () => {
    const root = path.join(os.tmpdir(), "nest-res-b");
    const a = path.join(root, "a", "a.module.ts");
    const b = path.join(root, "b", "b.module.ts");
    const c = path.join(root, "c", "c.module.ts");
    const list = [a, b, c].map((p) => vscode.Uri.file(p));
    const m = new Mem();
    const pickedUri = list[2];
    assert.ok(pickedUri);
    // Must match vscode.Uri.fsPath (drive letter casing) for lookup in
    // getDefaultModuleUriForEntity.
    await m.update(
      LAST_SELECTED_MODULE_MEMENTO_KEY,
      path.normalize(pickedUri.fsPath),
    );
    const d = getDefaultModuleUriForEntity(
      list,
      path.join(root, "b", "entities", "e.entity.ts"),
      m,
    );
    assert.strictEqual(
      path.normalize(d.fsPath).toLowerCase(),
      path.normalize(pickedUri.fsPath).toLowerCase(),
    );
  });

  test("getDefaultModuleUriForEntity without memento picks closest to entity", () => {
    const root = path.join(os.tmpdir(), "nest-res-c");
    const mFar = path.join(root, "far.module.ts");
    const mNear = path.join(root, "src", "app", "app.module.ts");
    const mOther = path.join(root, "src", "other", "o.module.ts");
    const ent = path.join(
      root,
      "src",
      "app",
      "entities",
      "u.entity.ts",
    );
    const list = [mFar, mNear, mOther].map((p) => vscode.Uri.file(p));
    const d = getDefaultModuleUriForEntity(list, ent, undefined);
    assert.strictEqual(
      path.normalize(d.fsPath).toLowerCase(),
      path.normalize(mNear).toLowerCase(),
      "app.module should be the nearest directory to the entity",
    );
  });
});
