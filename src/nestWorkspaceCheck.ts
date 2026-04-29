import * as vscode from "vscode";

const EXCLUDE_NODE = "**/node_modules/**";

/**
 * Resolves when the open workspace looks like a NestJS project:
 * - `nest-cli.json` on disk, or
 * - `node_modules/@nestjs/core` present, or
 * - any `package.json` (outside `node_modules`) lists `@nestjs/core` in
 *   dependencies, devDependencies, or peerDependencies.
 */
export async function isNestjsLikeWorkspace(
  token?: vscode.CancellationToken,
): Promise<boolean> {
  if (!vscode.workspace.workspaceFolders?.length) {
    return false;
  }
  return resolveNestjsLikeWorkspaceBody(token);
}

async function resolveNestjsLikeWorkspaceBody(
  token?: vscode.CancellationToken,
): Promise<boolean> {
  const nestCli = await vscode.workspace.findFiles(
    "**/nest-cli.json",
    EXCLUDE_NODE,
    1,
    token,
  );
  if (nestCli.length > 0) {
    return true;
  }
  const coreOnDisk = await vscode.workspace.findFiles(
    "**/node_modules/@nestjs/core/package.json",
    null,
    1,
    token,
  );
  if (coreOnDisk.length > 0) {
    return true;
  }
  const pkgUris = await vscode.workspace.findFiles(
    "**/package.json",
    EXCLUDE_NODE,
    150,
    token,
  );
  for (const uri of pkgUris) {
    if (token?.isCancellationRequested) {
      return false;
    }
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      const text = new TextDecoder("utf-8").decode(bytes);
      const j = JSON.parse(text) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        peerDependencies?: Record<string, string>;
      };
      if (
        j.dependencies?.["@nestjs/core"] ||
        j.devDependencies?.["@nestjs/core"] ||
        j.peerDependencies?.["@nestjs/core"]
      ) {
        return true;
      }
    } catch {
      /* ignore */
    }
  }
  return false;
}

export type NestjsWorkspaceState =
  | { kind: "ok" }
  | { kind: "no-workspace-folders" }
  | { kind: "no-nest-detected" };

/**
 * Distinguishes “nothing open” from “no Nest in this tree” for clearer stub UX.
 */
export async function getNestjsWorkspaceState(
  token?: vscode.CancellationToken,
): Promise<NestjsWorkspaceState> {
  if (!vscode.workspace.workspaceFolders?.length) {
    return { kind: "no-workspace-folders" };
  }
  if (await resolveNestjsLikeWorkspaceBody(token)) {
    return { kind: "ok" };
  }
  return { kind: "no-nest-detected" };
}

export const NESTJS_WORKSPACE_ONLY_MESSAGE =
  "This extension is designed for NestJS workspaces. Add nest-cli.json, install dependencies so @nestjs/core is present, or add @nestjs/core to a package.json in the workspace, then try again.";

export const NESTJS_WORKSPACE_NO_FOLDER_MESSAGE =
  "Add a folder to the workspace (File > Add Folder to Workspace… or open a folder), then open a Nest app so this extension can run.";

/**
 * When a folder is open but no Nest app is detected: common fixes for monorepos and fresh clones.
 */
export const NESTJS_WORKSPACE_NO_NEST_MESSAGE =
  "No NestJS app was detected. Try: (1) Open the subfolder that contains your app’s `package.json` and `nest-cli.json` (in monorepos, the workspace root is often the wrong folder). (2) Run `npm install` / `yarn` / `pnpm install` so `node_modules/@nestjs/core` exists. (3) Keep `@nestjs/core` in dependencies or devDependencies in that `package.json`.";
