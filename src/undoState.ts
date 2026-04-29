import * as fs from "fs/promises";
import * as path from "path";
import * as vscode from "vscode";

const STORAGE_KEY = "lastCrudUndoV1";

export type UndoFileEntry = { path: string; previousContent: string | null };

type StoredPayload = { version: 1; files: UndoFileEntry[] };

export async function readFileIfExists(
  filePath: string,
): Promise<string | null> {
  try {
    return await fs.readFile(path.normalize(filePath), "utf8");
  } catch {
    return null;
  }
}

/**
 * Returns a snapshot to store after a successful run (call *before* writing).
 * @param includeModule — `true` only when the Nest `*.module.ts` file will be patched
 *   (must match the condition used before writing the module).
 */
export async function capturePreGenerationSnapshot(
  outputPaths: string[],
  modulePath: string | null,
  includeModule: boolean,
): Promise<UndoFileEntry[]> {
  const entries: UndoFileEntry[] = [];
  for (const p of outputPaths) {
    const np = path.normalize(p);
    const c = await readFileIfExists(np);
    entries.push({ path: np, previousContent: c });
  }
  if (includeModule && modulePath) {
    const mp = path.normalize(modulePath);
    const c = await readFileIfExists(mp);
    entries.push({ path: mp, previousContent: c });
  }
  return entries;
}

/**
 * Must be awaited before showing “Undo” UI, or a fast “Undo” can run before
 * `workspaceState` has persisted the snapshot and nothing will be reverted.
 */
export async function saveUndoSnapshot(
  memento: vscode.Memento,
  files: UndoFileEntry[],
): Promise<void> {
  if (files.length === 0) {
    return;
  }
  const payload: StoredPayload = { version: 1, files };
  await memento.update(STORAGE_KEY, JSON.stringify(payload));
}

export async function clearUndo(memento: vscode.Memento): Promise<void> {
  await memento.update(STORAGE_KEY, undefined);
}

export function loadUndo(
  memento: vscode.Memento,
): UndoFileEntry[] | undefined {
  const raw = memento.get<string | undefined>(STORAGE_KEY, undefined);
  if (!raw) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as StoredPayload;
    if (parsed?.version === 1 && Array.isArray(parsed.files)) {
      return parsed.files;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

/**
 * Restores file contents. Deletes file if it did not exist before; writes back if it did.
 */
export async function applyUndo(files: UndoFileEntry[]): Promise<void> {
  for (const { path: p, previousContent } of files) {
    const np = path.normalize(p);
    if (previousContent === null) {
      try {
        await fs.rm(np, { force: true });
      } catch {
        /* may not exist */
      }
    } else {
      await fs.writeFile(np, previousContent, "utf8");
    }
  }
}
