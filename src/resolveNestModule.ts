import * as path from "path";
import * as vscode from "vscode";
import { workspaceRelativePathForDisplay } from "./crudOutput";

/** Stored as absolute fs path, normalized. */
export const LAST_SELECTED_MODULE_MEMENTO_KEY = "nestjsCrud.lastSelectedModulePath.v1";

export type NestModuleSelectionResult =
  | { kind: "no-workspace" }
  | { kind: "no-modules" }
  | { kind: "cancelled" }
  | { kind: "selected"; path: string };

function sortKeyClosestToEntity(
  entityFilePath: string,
  moduleFilePath: string,
): [number, number] {
  const fromDir = path.dirname(entityFilePath);
  const toDir = path.dirname(moduleFilePath);
  const rel = path.relative(fromDir, toDir);
  const parts = rel.split(path.sep);
  const ups = parts.filter((p) => p === "..").length;
  return [ups, parts.length];
}

function compareKey(a: [number, number], b: [number, number]): number {
  if (a[0] !== b[0]) {
    return a[0] - b[0];
  }
  return a[1] - b[1];
}

/**
 * Picks a default: last used path if it exists in the list, else the module
 * file whose directory is closest to the entity file (fewest `..` segments, then path length).
 */
/**
 * Picks the default selection for the module QuickPick: last saved path in
 * `memento` if it appears in `uris`, else the `*.module.ts` whose directory is
 * closest to the entity file. Exported for tests.
 */
/** Sorted list used in the module picker (labels follow this order). */
export function sortNestModuleUris(uris: vscode.Uri[]): vscode.Uri[] {
  const unique = new Map(uris.map((u) => [u.fsPath, u]));
  return [...unique.values()].sort((a, b) =>
    workspaceRelativePathForDisplay(a.fsPath).localeCompare(
      workspaceRelativePathForDisplay(b.fsPath),
    ),
  );
}

export function getDefaultModuleUriForEntity(
  uris: vscode.Uri[],
  entityFilePath: string,
  memento: vscode.Memento | undefined,
): vscode.Uri {
  const last = memento?.get<string | undefined>(LAST_SELECTED_MODULE_MEMENTO_KEY, undefined);
  if (last) {
    const norm = path.normalize(last).toLowerCase();
    const found = uris.find(
      (u) => path.normalize(u.fsPath).toLowerCase() === norm,
    );
    if (found) {
      return found;
    }
  }
  const sorted = uris.slice().sort(
    (a, b) =>
      compareKey(
        sortKeyClosestToEntity(entityFilePath, a.fsPath),
        sortKeyClosestToEntity(entityFilePath, b.fsPath),
      ) || a.fsPath.localeCompare(b.fsPath),
  );
  const first = sorted[0];
  if (first === undefined) {
    throw new Error("getDefaultModuleUriForEntity: non-empty list expected");
  }
  return first;
}

/**
 * `*.module.ts` files, excluding `node_modules`, shown as relative paths. Prefers modules
 * under the same workspace folder as the entity, then other folders in the workspace.
 * Persists the chosen path to workspace `memento`.
 */
export async function selectNestjsModule(
  entityFilePath: string,
  memento: vscode.Memento | undefined,
  token?: vscode.CancellationToken,
): Promise<NestModuleSelectionResult> {
  if (!vscode.workspace.workspaceFolders?.length) {
    return { kind: "no-workspace" };
  }
  const exclude = "**/node_modules/**";
  const maxUris = 2000;
  const all = await vscode.workspace.findFiles(
    "**/*.module.ts",
    exclude,
    maxUris,
    token,
  );
  if (all.length === 0) {
    return { kind: "no-modules" };
  }
  const wf = vscode.workspace.getWorkspaceFolder(
    vscode.Uri.file(entityFilePath),
  );
  const rootNorm = wf ? path.normalize(wf.uri.fsPath) : "";
  const inFolder: vscode.Uri[] = [];
  const outFolder: vscode.Uri[] = [];
  if (wf) {
    for (const u of all) {
      const p = path.normalize(u.fsPath);
      if (p === rootNorm || p.startsWith(rootNorm + path.sep)) {
        inFolder.push(u);
      } else {
        outFolder.push(u);
      }
    }
  } else {
    outFolder.push(...all);
  }
  const list = [
    ...sortNestModuleUris(inFolder),
    ...sortNestModuleUris(outFolder),
  ];
  if (list.length === 0) {
    return { kind: "no-modules" };
  }
  const defaultUri = getDefaultModuleUriForEntity(
    list,
    entityFilePath,
    memento,
  );
  const items: (vscode.QuickPickItem & { fullPath: string })[] = list.map(
    (u) => {
      const rel = workspaceRelativePathForDisplay(u.fsPath);
      const isDefault = u.fsPath === defaultUri.fsPath;
      const p = path.normalize(u.fsPath);
      const inSame =
        wf &&
        (p === rootNorm || p.startsWith(rootNorm + path.sep));
      let description: string | undefined;
      if (isDefault) {
        description = "suggested";
      } else if (wf && !inSame) {
        description = "other workspace folder";
      }
      return {
        label: rel,
        description,
        fullPath: u.fsPath,
      };
    },
  );
  const defaultItem = items.find((i) => i.fullPath === defaultUri.fsPath);
  type Item = vscode.QuickPickItem & { fullPath: string };
  const chosen = await new Promise<Item | undefined>((resolve) => {
    const qp = vscode.window.createQuickPick<Item>();
    qp.items = items;
    qp.placeholder =
      "Select the Nest module to register the entity in (imports, providers, controllers)";
    if (defaultItem) {
      qp.activeItems = [defaultItem];
    }
    let accepted = false;
    const subA = qp.onDidAccept(() => {
      accepted = true;
      resolve(qp.selectedItems[0] as Item | undefined);
      qp.hide();
    });
    const subB = qp.onDidHide(() => {
      if (!accepted) {
        resolve(undefined);
      }
      subA.dispose();
      subB.dispose();
      qp.dispose();
    });
    if (token) {
      token.onCancellationRequested(() => {
        if (!accepted) {
          qp.hide();
        }
      });
    }
    qp.show();
  });
  if (!chosen) {
    return { kind: "cancelled" };
  }
  if (memento) {
    void memento.update(
      LAST_SELECTED_MODULE_MEMENTO_KEY,
      path.normalize(chosen.fullPath),
    );
  }
  return { kind: "selected", path: path.normalize(chosen.fullPath) };
}
