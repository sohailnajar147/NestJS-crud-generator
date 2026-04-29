import * as vscode from "vscode";

export const NESTJS_CRUD_OUTPUT_NAME = "NestJS CRUD Generator";

/** Matches `nestjs-crud-generator.openReadme` */
export const NESTJS_CRUD_DOCS_README =
  "https://github.com/sohailnajar147/nestjs-crud-generator#readme";

let registeredChannel: vscode.OutputChannel | undefined;

export function setCrudOutputChannel(channel: vscode.OutputChannel): void {
  registeredChannel = channel;
}

export function getCrudOutputChannel(): vscode.OutputChannel {
  if (!registeredChannel) {
    registeredChannel = vscode.window.createOutputChannel(NESTJS_CRUD_OUTPUT_NAME);
  }
  return registeredChannel;
}

export function workspaceRelativePathForDisplay(fsPath: string): string {
  if (!vscode.workspace.workspaceFolders?.length) {
    return fsPath;
  }
  return vscode.workspace.asRelativePath(fsPath);
}

/**
 * Non-modal technical log (stack traces only here, never in notification body).
 */
export function logToCrudOutput(context: string, err: unknown): void {
  const ch = getCrudOutputChannel();
  ch.appendLine(`[${new Date().toISOString()}] ${context}`);
  if (err instanceof Error) {
    ch.appendLine(err.message);
    if (err.stack) {
      ch.appendLine(err.stack);
    }
  } else if (err !== undefined && err !== null) {
    ch.appendLine(String(err));
  }
  ch.appendLine("");
}

/**
 * Thrown/unknown command errors: map to a short modal, full detail in the output channel.
 */
export function userMessageForCaughtError(error: unknown): string {
  const m = error instanceof Error ? error.message : String(error);
  const mLower = m.toLowerCase();
  if (
    /parse|syntax|transform failed|ts-morph|expected|unexpected token|unexpected character|decorator/i.test(
      m,
    ) ||
    (mLower.includes("typescript") && mLower.includes("error"))
  ) {
    return `Could not read entity: ${m}. See Output.`;
  }
  if (/enoent|eacces|eperm|eisdir|enospc|emfile/i.test(m)) {
    return "Could not read or write project files. See Output.";
  }
  return "Something went wrong. See the NestJS CRUD Generator output for details.";
}

export function showEntityParseError(reason: string): void {
  logToCrudOutput(
    "Entity parse",
    new Error(`className Unknown: ${reason}`),
  );
  void (async () => {
    const pick = await vscode.window.showErrorMessage(
      `Could not read entity: ${reason}. See Output.`,
      "View Output",
    );
    if (pick === "View Output") {
      getCrudOutputChannel().show(true);
    }
  })();
}

export function showCaughtCommandError(error: unknown): void {
  logToCrudOutput("Command failed", error);
  const msg = userMessageForCaughtError(error);
  void (async () => {
    const pick = await vscode.window.showErrorMessage(msg, "View Output");
    if (pick === "View Output") {
      getCrudOutputChannel().show(true);
    }
  })();
}
