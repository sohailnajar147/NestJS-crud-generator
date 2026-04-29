import * as vscode from "vscode";

const SCHEME = "nestjsCrudGenPreview";
const store = new Map<string, string>();

class CrudGenPreviewProvider implements vscode.TextDocumentContentProvider {
  provideTextDocumentContent(uri: vscode.Uri): string {
    return store.get(uri.toString()) ?? "";
  }
}

let idSeq = 0;

/**
 * In-memory only; diff right-hand / empty left uses these URIs.
 * Clear between runs with {@link clearCrudGenPreviewCache}.
 */
export function registerCrudGenPreview(
  context: vscode.ExtensionContext,
): void {
  const p = new CrudGenPreviewProvider();
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(SCHEME, p),
  );
}

function nextVirtualUri(suffix: string): vscode.Uri {
  idSeq += 1;
  return vscode.Uri.parse(`${SCHEME}:/p/${idSeq}/${suffix}`);
}

/**
 * Pairs a before/after for `vscode.diff` when neither side is a real file, or
 * when the right side is generated text (left may still be a `file:` URI).
 */
export function setPairPreviewContent(
  beforeText: string,
  afterText: string,
): { beforeUri: vscode.Uri; afterUri: vscode.Uri } {
  const beforeUri = nextVirtualUri("left");
  const afterUri = nextVirtualUri("right");
  store.set(beforeUri.toString(), beforeText);
  store.set(afterUri.toString(), afterText);
  return { beforeUri, afterUri };
}

/** Single read-only preview document (e.g. generated right side of a diff). */
export function virtualDocumentForText(part: string, text: string): vscode.Uri {
  const u = nextVirtualUri(part);
  store.set(u.toString(), text);
  return u;
}

export function clearCrudGenPreviewCache(): void {
  store.clear();
}
