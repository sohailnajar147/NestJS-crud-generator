import * as fs from "fs/promises";
import * as path from "path";
import * as vscode from "vscode";
import type { CrudCodeGenOptions } from "./crudOptions";
import {
  getCrudOutputChannel,
  logToCrudOutput,
  NESTJS_CRUD_DOCS_README,
  showEntityParseError,
  workspaceRelativePathForDisplay,
} from "./crudOutput";
import { findCrudNamingConflicts } from "./conflictCheck";
import {
  clearCrudGenPreviewCache,
  setPairPreviewContent,
  virtualDocumentForText,
} from "./crudGenPreviewContent";
import { readPreviewMode, resolveCrudTemplateRoot } from "./crudConfigFromVscode";
import { selectNestjsModule } from "./resolveNestModule";
import { buildAllFileContents } from "./generateCrudCore";
import { parseModel, type ModelInfo } from "./modelParser";
import { previewPatchNestModule } from "./nestModulePatcher";
import { syncOpenEditorsAfterCrudUndo } from "./undoEditors";
import {
  applyUndo,
  capturePreGenerationSnapshot,
  clearUndo,
  loadUndo,
  saveUndoSnapshot,
} from "./undoState";

export async function runGenerateCrud(
  document: vscode.TextDocument,
  opts: CrudCodeGenOptions,
  undo: { memento: vscode.Memento } | undefined,
  preParsedModel?: ModelInfo,
): Promise<void> {
  const modelPath = document.fileName;
  const modelDir = path.dirname(modelPath);
  const moduleDir = path.dirname(modelDir);
  const previewMode = readPreviewMode(
    vscode.workspace.getConfiguration("nestjsCrud"),
  );

  const modelInfo = preParsedModel ?? (await parseModel(document));
  const entityText = document.getText();

  if (modelInfo.className === "Unknown") {
    showEntityParseError("no exported class or entity name could be determined");
    return;
  }

  let modulePath: string | null = null;
  if (opts.autoRegisterModule) {
    const modSel = await selectNestjsModule(modelPath, undo?.memento);
    if (modSel.kind === "cancelled") {
      return;
    }
    if (modSel.kind === "no-workspace") {
      const act = await vscode.window.showWarningMessage(
        "Add a folder to the workspace to list Nest module files, or turn off auto-register in settings. Generation will run without module registration.",
        "Open documentation",
      );
      if (act === "Open documentation") {
        void vscode.env.openExternal(vscode.Uri.parse(NESTJS_CRUD_DOCS_README));
      }
    } else if (modSel.kind === "no-modules") {
      const w = "No *.module.ts found in this workspace. See docs.";
      const act = await vscode.window.showWarningMessage(w, "Open documentation");
      if (act === "Open documentation") {
        void vscode.env.openExternal(vscode.Uri.parse(NESTJS_CRUD_DOCS_README));
      }
    } else {
      modulePath = modSel.path;
    }
  }
  const willPatchModule = Boolean(modulePath);

  let entityFile = path.basename(modelPath);
  entityFile = entityFile
    .replace(/\.entity\.ts$/, "")
    .replace(/\.ts$/, "");

  const finalRoute = opts.routePrefix
    ? `${opts.routePrefix}/${modelInfo.collectionName}`
    : modelInfo.collectionName;
  const conflicts = await findCrudNamingConflicts(moduleDir, {
    finalRoute,
    entityName: modelInfo.className,
    entityFile,
  });
  if (conflicts.length > 0) {
    const detail = conflicts.join(" ");
    const itemGenerate: vscode.MessageItem = { title: "Generate anyway" };
    const itemAbort: vscode.MessageItem = { title: "Abort", isCloseAffordance: true };
    const go = await vscode.window.showWarningMessage(
      `Possible name or route conflict: ${detail}`,
      { modal: true },
      itemGenerate,
      itemAbort,
    );
    if (go?.title !== "Generate anyway") {
      return;
    }
  }

  const folder = vscode.workspace.getWorkspaceFolder(
    vscode.Uri.file(modelPath),
  );
  const rawT =
    opts.templatesPath == null
      ? ""
      : String(opts.templatesPath).trim();
  if (rawT.length > 0 && !path.isAbsolute(rawT) && !folder) {
    const w =
      "nestjsCrud.templatesPath is a relative path but the entity file is not in a workspace folder. Use an absolute path, or add the project folder to the workspace.";
    logToCrudOutput("resolve templatesPath", new Error(w));
    getCrudOutputChannel().show(true);
    void vscode.window.showErrorMessage(w);
    return;
  }
  const templateRoot = resolveCrudTemplateRoot(opts.templatesPath, folder);

  let createDto: string;
  let updateDto: string;
  let service: string;
  let controller: string;
  let serviceSpec: string | null;
  try {
    const out = buildAllFileContents(
      modelInfo,
      entityFile,
      entityText,
      opts,
      templateRoot,
    );
    createDto = out.createDto;
    updateDto = out.updateDto;
    service = out.service;
    controller = out.controller;
    serviceSpec = out.serviceSpec;
  } catch (e) {
    logToCrudOutput("CRUD code generation (built-in or Handlebars templates)", e);
    getCrudOutputChannel().show(true);
    const msg = e instanceof Error ? e.message : String(e);
    const action = await vscode.window.showErrorMessage(
      `Could not generate code: ${msg}`,
      "View Output",
    );
    if (action === "View Output") {
      getCrudOutputChannel().show(true);
    }
    return;
  }

  const dtoDir = path.join(moduleDir, "dto");

  const createDtoPath = path.join(dtoDir, `create-${entityFile}.dto.ts`);
  const updateDtoPath = path.join(dtoDir, `update-${entityFile}.dto.ts`);
  const servicePath = path.join(moduleDir, `${entityFile}.service.ts`);
  const serviceSpecPath = path.join(moduleDir, `${entityFile}.service.spec.ts`);
  const controllerPath = path.join(moduleDir, `${entityFile}.controller.ts`);

  const pathsToWrite = [
    createDtoPath,
    updateDtoPath,
    servicePath,
    controllerPath,
  ];
  if (serviceSpec != null) {
    pathsToWrite.push(serviceSpecPath);
  }
  const existing: string[] = [];
  for (const p of pathsToWrite) {
    try {
      await fs.access(p);
      existing.push(p);
    } catch {
      /* missing */
    }
  }

  let modulePreviewText: string | undefined;
  let modulePatchAttemptFailed = false;
  if (willPatchModule && modulePath) {
    const modPrev = await previewPatchNestModule({
      moduleFilePath: modulePath,
      entityName: modelInfo.className,
      entityFile,
      entityAbsolutePath: modelPath,
      serviceAbsolutePath: servicePath,
      controllerAbsolutePath: controllerPath,
    });
    if (!modPrev.ok) {
      modulePatchAttemptFailed = true;
      logToCrudOutput("previewPatchNestModule", new Error(modPrev.message));
      const action = await vscode.window.showWarningMessage(
        "Automatic module registration failed — the selected *.module.ts could not be updated (see Output). CRUD files will still be generated; wire TypeOrmModule.forFeature / controller / service yourself using the snippet or docs.",
        "View Output",
        "Copy module snippet",
      );
      if (action === "View Output") {
        getCrudOutputChannel().show(true);
      } else if (action === "Copy module snippet") {
        await vscode.env.clipboard.writeText(modPrev.snippet);
      }
    } else {
      modulePreviewText = modPrev.text;
    }
  }

  const nCreate = pathsToWrite.filter((p) => !existing.includes(p)).length;
  const nModify = existing.length;
  const nModule = willPatchModule && modulePreviewText ? 1 : 0;
  const summaryParts: string[] = [];
  if (nCreate > 0) {
    summaryParts.push(`${nCreate} file(s) will be created`);
  }
  if (nModify > 0) {
    summaryParts.push(`${nModify} file(s) will be modified`);
  }
  if (nModule > 0) {
    summaryParts.push(`${nModule} Nest module file will be modified`);
  }
  const summaryLine = summaryParts.join(", ");
  const detailLines: string[] = [];
  for (const p of pathsToWrite) {
    detailLines.push(
      `${workspaceRelativePathForDisplay(p)} (${existing.includes(p) ? "modify" : "create"})`,
    );
  }
  if (nModule > 0 && modulePath) {
    detailLines.push(
      `${workspaceRelativePathForDisplay(modulePath)} (modify module)`,
    );
  }

  if (previewMode === "off") {
    const offPick = await vscode.window.showQuickPick<
      vscode.QuickPickItem & { id: "go" | "cancel" }
    >(
      [
        { label: "$(save-all)  Write all files (no diff preview)", id: "go" },
        { label: "Cancel", id: "cancel" },
      ],
      {
        title: summaryLine,
        placeHolder: detailLines.join(" · "),
      },
    );
    if (!offPick || offPick.id === "cancel") {
      return;
    }
  } else if (previewMode === "batch") {
    const batchPick = await vscode.window.showQuickPick<
      vscode.QuickPickItem & { id: "go" | "cancel" }
    >(
      [
        {
          label: "$(check)  Confirm and write all (single step, no per-file diffs)",
          id: "go",
        },
        { label: "Cancel", id: "cancel" },
      ],
      {
        title: summaryLine,
        placeHolder: detailLines.join(" · "),
      },
    );
    if (!batchPick || batchPick.id === "cancel") {
      return;
    }
  } else {
    const start = await vscode.window.showQuickPick<
      vscode.QuickPickItem & { id: "go" | "cancel" }
    >(
      [
        { label: "$(diff) Start preview", id: "go" },
        { label: "Cancel", id: "cancel" },
      ],
      {
        title: summaryLine,
        placeHolder: detailLines.join(" · "),
      },
    );
    if (!start || start.id === "cancel") {
      return;
    }

    clearCrudGenPreviewCache();

    type FileStep = { abs: string; after: string; isNew: boolean };
    const steps: FileStep[] = [
      { abs: createDtoPath, after: createDto, isNew: !existing.includes(createDtoPath) },
      { abs: updateDtoPath, after: updateDto, isNew: !existing.includes(updateDtoPath) },
      { abs: servicePath, after: service, isNew: !existing.includes(servicePath) },
      { abs: controllerPath, after: controller, isNew: !existing.includes(controllerPath) },
    ];
    if (serviceSpec != null) {
      steps.push({
        abs: serviceSpecPath,
        after: serviceSpec,
        isNew: !existing.includes(serviceSpecPath),
      });
    }
    if (willPatchModule && modulePath && modulePreviewText !== undefined) {
      steps.push({
        abs: modulePath,
        after: modulePreviewText,
        isNew: false,
      });
    }

    type PreviewAction = "write" | "abort";
    for (const step of steps) {
      const rel = workspaceRelativePathForDisplay(step.abs);
      let leftUri: vscode.Uri;
      let rightUri: vscode.Uri;
      if (step.isNew) {
        const pair = setPairPreviewContent("", step.after);
        leftUri = pair.beforeUri;
        rightUri = pair.afterUri;
      } else {
        leftUri = vscode.Uri.file(step.abs);
        rightUri = virtualDocumentForText("next", step.after);
      }
      await vscode.commands.executeCommand(
        "vscode.diff",
        leftUri,
        rightUri,
        `NestJS CRUD: ${rel}`,
      );
      await new Promise((resolve) => setTimeout(resolve, 50));

      const shortHint = step.isNew
        ? "New file — use ↑↓ or click; Enter confirms"
        : "On disk will be replaced — use ↑↓ or click; Enter confirms";
      const itemWrite: vscode.QuickPickItem & { action: PreviewAction } = {
        label: "$(check)  Confirm & write",
        action: "write",
        alwaysShow: true,
        description: "Apply this file and continue (or finish on the last step).",
      };
      const itemAbort: vscode.QuickPickItem & { action: PreviewAction } = {
        label: "$(close)  Abort",
        action: "abort",
        alwaysShow: true,
        description: "Stops the whole run; no files are written until every step is confirmed.",
      };
      const pick = await vscode.window.showQuickPick(
        [itemWrite, itemAbort],
        {
          title: `Preview: ${rel}`,
          placeHolder: shortHint,
          ignoreFocusOut: true,
        },
      );
      if (!pick || pick.action === "abort") {
        await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
        return;
      }
    }
  }

  if (previewMode === "off" || previewMode === "batch") {
    clearCrudGenPreviewCache();
  }

  await fs.mkdir(dtoDir, { recursive: true });

  const includeModuleInUndo =
    Boolean(modulePath) && modulePreviewText !== undefined;
  const snapshot = await capturePreGenerationSnapshot(
    pathsToWrite,
    modulePath,
    includeModuleInUndo,
  );

  await fs.writeFile(createDtoPath, createDto, "utf8");
  await fs.writeFile(updateDtoPath, updateDto, "utf8");
  await fs.writeFile(servicePath, service, "utf8");
  await fs.writeFile(controllerPath, controller, "utf8");
  if (serviceSpec != null) {
    await fs.writeFile(serviceSpecPath, serviceSpec, "utf8");
  }

  if (willPatchModule && modulePath && modulePreviewText !== undefined) {
    await fs.writeFile(modulePath, modulePreviewText, "utf8");
  }

  if (undo?.memento) {
    await saveUndoSnapshot(undo.memento, snapshot);
  }

  const entityName = modelInfo.className;
  const doneHint = modulePatchAttemptFailed
    ? ` The Nest module file was not changed — finish wiring manually (Output / snippet). Undo restores generated files only.`
    : ` (Undo removes new files and restores the previous module if it was changed.)`;
  const res = await vscode.window.showInformationMessage(
    `CRUD generated for ${entityName}.${doneHint}`,
    "Undo now",
  );
  if (res === "Undo now") {
    await vscode.commands.executeCommand(
      "nestjs-crud-generator.undoLastCrudGeneration",
    );
  }
}

/**
 * Reverts the last successful generation in this workspace folder.
 */
export async function runUndoLastCrud(
  memento: vscode.Memento,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const files = loadUndo(memento);
  if (!files || files.length === 0) {
    return { ok: false, message: "There is no CRUD generation to undo." };
  }
  try {
    await applyUndo(files);
  } catch (e) {
    logToCrudOutput("runUndoLastCrud", e);
    return { ok: false, message: "Could not complete undo. See the NestJS CRUD Generator output for details." };
  }
  try {
    await syncOpenEditorsAfterCrudUndo(files);
  } catch (e) {
    logToCrudOutput("syncOpenEditorsAfterCrudUndo", e);
    void vscode.window.showWarningMessage(
      "CRUD undo updated files on disk. If a tab still shows old content, close it or use Revert File.",
    );
  }
  await clearUndo(memento);
  return { ok: true };
}
