import * as assert from "assert";
import * as vscode from "vscode";

suite("nestjs-crud-generator extension", () => {
  test("extension is registered", function () {
    this.timeout(10000);
    const ext = vscode.extensions.getExtension("sohail.nestjs-crud-generator");
    assert.ok(ext, "Extension sohail.nestjs-crud-generator should be available");
  });

  test("extension activates", async function () {
    this.timeout(20000);
    const ext = vscode.extensions.getExtension("sohail.nestjs-crud-generator");
    assert.ok(ext);
    if (ext) {
      await ext.activate();
    }
  });

  test("core commands are available after activation", async function () {
    this.timeout(20000);
    const ext = vscode.extensions.getExtension("sohail.nestjs-crud-generator");
    assert.ok(ext);
    await ext?.activate();
    const all = await vscode.commands.getCommands();
    for (const c of [
      "nestjs-crud-generator.generateCRUD",
      "nestjs-crud-generator.generateCRUDQuick",
      "nestjs-crud-generator.openOutputLog",
    ]) {
      assert.ok(all.includes(c), `Command ${c} should be registered`);
    }
  });
});
