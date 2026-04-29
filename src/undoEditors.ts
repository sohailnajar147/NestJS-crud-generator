import * as path from "path";
import * as vscode from "vscode";
import type { UndoFileEntry } from "./undoState";

function sameFsPath(a: string, b: string): boolean {
  return path.normalize(a).toLowerCase() === path.normalize(b).toLowerCase();
}

/**
 * After reverting files on disk, update open editors so they match (VS Code does
 * not auto-refresh everything written via Node `fs` for already-open documents).
 */
export async function syncOpenEditorsAfterCrudUndo(
  files: UndoFileEntry[],
): Promise<void> {
  for (const { path: p, previousContent } of files) {
    const norm = path.normalize(p);
    const targetUri = vscode.Uri.file(norm);

    const matchDocs = vscode.workspace.textDocuments.filter((d) =>
      d.uri.scheme === "file" && sameFsPath(d.uri.fsPath, targetUri.fsPath),
    );
    for (const doc of matchDocs) {
      if (previousContent === null) {
        const tab = findTabForUri(doc.uri);
        if (tab) {
          await vscode.window.tabGroups.close(tab);
        } else {
          try {
            await vscode.window.showTextDocument(doc, { preview: true });
            await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
          } catch {
            /* tab gone */
          }
        }
        continue;
      }
      if (doc.isDirty) {
        void vscode.window.showWarningMessage(
          `Undo updated "${path.basename(norm)}" on disk, but the editor has unsaved changes. Revert the tab (or close without saving) to match the undo.`,
        );
        continue;
      }
      await vscode.window.showTextDocument(doc, { preview: true });
      try {
        await vscode.commands.executeCommand("workbench.action.files.revert");
      } catch {
        const d = await vscode.workspace.openTextDocument(targetUri);
        await vscode.window.showTextDocument(d, { preview: true });
      }
    }
  }
}

function findTabForUri(uri: vscode.Uri): vscode.Tab | undefined {
  for (const g of vscode.window.tabGroups.all) {
    for (const tab of g.tabs) {
      const inpt = tab.input;
      if (inpt && typeof inpt === "object" && "uri" in inpt) {
        const u = (inpt as { uri: vscode.Uri }).uri;
        if (u instanceof vscode.Uri && u.fsPath.length > 0 && sameFsPath(u.fsPath, uri.fsPath)) {
          return tab;
        }
      }
    }
  }
  return undefined;
}
