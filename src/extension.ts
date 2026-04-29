import * as vscode from "vscode";
import {
  getShowWizard,
  readCrudOptions,
  readTrustEntityFileWithoutEntitySuffix,
} from "./crudConfigFromVscode";
import {
  resolveQuickCrudOptions,
  runCrudOptionsWizard,
} from "./crudWizard";
import { resolveAddSwaggerForWizard } from "./nestjsSwaggerCheck";
import { parseModel } from "./modelParser";
import {
  getCrudOutputChannel,
  setCrudOutputChannel,
  NESTJS_CRUD_DOCS_README,
  NESTJS_CRUD_OUTPUT_NAME,
  showCaughtCommandError,
  showEntityParseError,
} from "./crudOutput";
import { getCachedTypeormEntityView } from "./entityDetectionCache";
import { registerCrudGenPreview } from "./crudGenPreviewContent";
import {
  getNestjsWorkspaceState,
  NESTJS_WORKSPACE_NO_FOLDER_MESSAGE,
  NESTJS_WORKSPACE_NO_NEST_MESSAGE,
} from "./nestWorkspaceCheck";
import { runGenerateCrud, runUndoLastCrud } from "./runGenerateCrud";
import { registerHelpView } from "./helpView";

/** Quick Fix–scoped so the action appears in the normal lightbulb / Ctrl+. menu like other file actions. */
const CRUD_ACTION = vscode.CodeActionKind.QuickFix.append("nestjsCrud");

/** Nest and entity files are plain `.ts`; do not use `typescriptreact`. Omit `scheme` so the same document works on `file:`, `vscode-remote:`, and `untitled:` URIs. */
const nestTsSelector: vscode.DocumentSelector = { language: "typescript" };

class GenerateCrudCodeAction implements vscode.CodeActionProvider {
  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection, // eslint-disable-line @typescript-eslint/no-unused-vars -- CodeActionProvider signature
    context: vscode.CodeActionContext,
  ): vscode.ProviderResult<(vscode.Command | vscode.CodeAction)[]> {
    if (!getCachedTypeormEntityView(document).hasEntity) {
      return [];
    }
    if (
      context.only &&
      !context.only.contains(CRUD_ACTION) &&
      !CRUD_ACTION.contains(context.only) &&
      !context.only.contains(vscode.CodeActionKind.QuickFix)
    ) {
      return [];
    }
    const action = new vscode.CodeAction(
      "Generate NestJS CRUD…",
      CRUD_ACTION,
    );
    action.command = {
      command: "nestjs-crud-generator.generateCRUD",
      title: "Generate NestJS CRUD",
      tooltip:
        "Quick or custom options, then scaffold service, controller, and DTOs",
    };
    return [action];
  }
}

class GenerateCrudCodeLensProvider implements vscode.CodeLensProvider {
  provideCodeLenses(
    document: vscode.TextDocument,
  ): vscode.ProviderResult<vscode.CodeLens[]> {
    if (document.languageId !== "typescript") {
      return [];
    }
    const { hasEntity, lines0 } = getCachedTypeormEntityView(document);
    if (!hasEntity) {
      return [];
    }
    const lenses: vscode.CodeLens[] = [];
    for (const line0 of lines0) {
      if (line0 < 0 || line0 >= document.lineCount) {
        continue;
      }
      const range = document.lineAt(line0).range;
      lenses.push(
        new vscode.CodeLens(range, {
          title: "Generate NestJS CRUD…",
          command: "nestjs-crud-generator.generateCRUD",
          tooltip: "Generate CRUD (Quick or custom options) for this file",
        }),
      );
    }
    return lenses;
  }
}

function registerReadmeAndWalkthrough(context: vscode.ExtensionContext): void {
  const walkthroughId = `${context.extension.id}#crud-welcome`;
  context.subscriptions.push(
    vscode.commands.registerCommand("nestjs-crud-generator.openReadme", async () => {
      await vscode.env.openExternal(
        vscode.Uri.parse(NESTJS_CRUD_DOCS_README),
      );
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "nestjs-crud-generator.openWalkthrough",
      async () => {
        await vscode.commands.executeCommand(
          "workbench.action.openWalkthrough",
          walkthroughId,
        );
      },
    ),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "nestjs-crud-generator.openOutputLog",
      () => {
        getCrudOutputChannel().show(true);
      },
    ),
  );
}

function registerStubOnly(
  context: vscode.ExtensionContext,
  kind: "no-workspace-folders" | "no-nest-detected",
): void {
  const msg =
    kind === "no-workspace-folders"
      ? NESTJS_WORKSPACE_NO_FOLDER_MESSAGE
      : NESTJS_WORKSPACE_NO_NEST_MESSAGE;
  const onStub = () => {
    void vscode.window.showInformationMessage(msg);
  };
  for (const id of [
    "nestjs-crud-generator.generateCRUD",
    "nestjs-crud-generator.generateCRUDQuick",
    "nestjs-crud-generator.undoLastCrudGeneration",
  ] as const) {
    context.subscriptions.push(
      vscode.commands.registerCommand(id, onStub),
    );
  }
  setCrudOutputChannel(vscode.window.createOutputChannel(NESTJS_CRUD_OUTPUT_NAME));
  registerReadmeAndWalkthrough(context);
}

function activateMain(context: vscode.ExtensionContext): void {
  const out = vscode.window.createOutputChannel(NESTJS_CRUD_OUTPUT_NAME);
  setCrudOutputChannel(out);
  context.subscriptions.push(out);
  registerCrudGenPreview(context);

  const undoMemento = context.workspaceState;
  registerReadmeAndWalkthrough(context);

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      nestTsSelector,
      new GenerateCrudCodeAction(),
      {
        providedCodeActionKinds: [CRUD_ACTION, vscode.CodeActionKind.QuickFix],
      },
    ),
  );
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      nestTsSelector,
      new GenerateCrudCodeLensProvider(),
    ),
  );

  const run = async (document: vscode.TextDocument, quick: boolean) => {
    const config = vscode.workspace.getConfiguration("nestjsCrud");
    const trust = readTrustEntityFileWithoutEntitySuffix(config);
    if (
      !trust &&
      !document.fileName.includes(".entity.ts") &&
      !getCachedTypeormEntityView(document).hasEntity
    ) {
      const answer = await vscode.window.showWarningMessage(
        "This file does not look like a TypeORM entity. Continue anyway?",
        "Yes",
        "No",
      );
      if (answer !== "Yes") {
        return;
      }
    }
    const parseOpts = {
      includeInheritedEntityProperties: readCrudOptions(config)
        .includeInheritedEntityProperties,
    };
    const mod = await parseModel(document, parseOpts);
    if (mod.className === "Unknown") {
      showEntityParseError(
        "no exported class or entity name could be determined",
      );
      return;
    }
    let opts;
    if (quick) {
      opts = await resolveQuickCrudOptions(
        config,
        undoMemento,
        document.fileName,
      );
    } else if (getShowWizard(config)) {
      opts = await runCrudOptionsWizard(
        config,
        mod.className,
        undoMemento,
        document.fileName,
      );
    } else {
      let next = readCrudOptions(config);
      const swaggerResolved = await resolveAddSwaggerForWizard(
        document.fileName,
        next.addSwagger,
      );
      if (swaggerResolved === undefined) {
        return;
      }
      next = { ...next, addSwagger: swaggerResolved };
      opts = next;
    }
    if (opts === undefined) {
      return;
    }
    await runGenerateCrud(document, opts, { memento: undoMemento }, mod);
  };

  const withEditor = (
    quick: boolean,
  ): (() => Promise<void>) => async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      void vscode.window.showErrorMessage(
        "Open an entity file (.entity.ts) first.",
      );
      return;
    }
    try {
      await run(editor.document, quick);
    } catch (error) {
      showCaughtCommandError(error);
    }
  };

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "nestjs-crud-generator.generateCRUD",
      withEditor(false),
    ),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "nestjs-crud-generator.generateCRUDQuick",
      withEditor(true),
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "nestjs-crud-generator.undoLastCrudGeneration",
      async () => {
        const r = await runUndoLastCrud(undoMemento);
        if (r.ok) {
          void vscode.window.showInformationMessage(
            "Last CRUD generation reverted (open tabs are updated when possible).",
          );
        } else {
          if (r.message === "There is no CRUD generation to undo.") {
            void vscode.window.showWarningMessage(r.message);
          } else {
            getCrudOutputChannel().show(true);
            void vscode.window.showWarningMessage(r.message);
          }
        }
      },
    ),
  );
}

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  registerHelpView(context);
  const state = await getNestjsWorkspaceState();
  if (state.kind !== "ok") {
    registerStubOnly(
      context,
      state.kind === "no-workspace-folders"
        ? "no-workspace-folders"
        : "no-nest-detected",
    );
    return;
  }
  activateMain(context);
}

export function deactivate(): void {
  return;
}
