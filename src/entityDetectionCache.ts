import * as vscode from "vscode";
import { analyzeTypeormEntityFile } from "./entityParserAst";

type Cached = { version: number; hasEntity: boolean; lines0: number[] };
const cache = new Map<string, Cached>();

/**
 * Caches {@link analyzeTypeormEntityFile} by `document.uri` + `document.version`.
 */
export function getCachedTypeormEntityView(
  document: vscode.TextDocument,
): { hasEntity: boolean; lines0: number[] } {
  const key = document.uri.toString();
  const hit = cache.get(key);
  if (hit && hit.version === document.version) {
    return { hasEntity: hit.hasEntity, lines0: hit.lines0 };
  }
  const { hasEntity, lines0 } = analyzeTypeormEntityFile(document.getText());
  cache.set(key, { version: document.version, hasEntity, lines0 });
  return { hasEntity, lines0 };
}
