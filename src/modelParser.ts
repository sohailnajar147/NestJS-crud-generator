import * as vscode from "vscode";
import { tryParseModelFromAst } from "./entityParserAst";

export function parseModelFromText(
  text: string,
  options?: ParseModelOptions,
): ModelInfo {
  return parseModelContent(text, options);
}

export interface ModelProperty {
  name: string;
  type: string;
  decorators: string[];
  isOptional: boolean;
  isArray: boolean;
}

export interface ModelInfo {
  className: string;
  collectionName: string;
  properties: ModelProperty[];
}

export interface ParseModelOptions {
  /** When true (default), same-file base class properties are merged into the model. */
  includeInheritedEntityProperties?: boolean;
}

export async function parseModel(
  document: vscode.TextDocument,
  options?: ParseModelOptions,
): Promise<ModelInfo> {
  return parseModelContent(document.getText(), options);
}

function parseModelContent(text: string, options?: ParseModelOptions): ModelInfo {
  const ast = tryParseModelFromAst(text, {
    includeInheritedEntityProperties: options?.includeInheritedEntityProperties,
  });
  if (ast) {
    if (ast.properties.length > 0) {
      return ast;
    }
    const line = parseModelContentLine(text);
    if (line.properties.length > 0) {
      return {
        className: ast.className,
        collectionName: ast.collectionName,
        properties: line.properties,
      };
    }
    return ast;
  }
  return parseModelContentLine(text);
}

/** Line-based fallback for unusual AST shapes or when the AST path yields no properties. */
function parseModelContentLine(text: string): ModelInfo {
  const classMatch = text.match(/export class (\w+)/);
  const className = classMatch ? classMatch[1] : "Unknown";

  const entityMatch = text.match(/@Entity\(['"]([^'"]+)['"]\)/);
  const collectionName = entityMatch
    ? entityMatch[1]
    : className.toLowerCase() + "s";

  const properties: ModelProperty[] = [];
  const lines = text.split("\n");

  let currentDecorators: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("@")) {
      currentDecorators.push(trimmed);
    } else if (
      trimmed.includes(":") &&
      !trimmed.startsWith("constructor") &&
      !trimmed.startsWith("_id")
    ) {
      const parts = trimmed.split(":");
      let namePart = parts[0].trim();
      const typePart = parts[1].replace(";", "").trim();

      const isOptional = namePart.endsWith("?");
      if (isOptional) {
        namePart = namePart.slice(0, -1);
      }

      const isArray = typePart.endsWith("[]") || typePart.startsWith("Array<");

      if (namePart && typePart) {
        properties.push({
          name: namePart,
          type: typePart,
          decorators: currentDecorators,
          isOptional,
          isArray,
        });
      }
      currentDecorators = [];
    } else if (trimmed === "") {
      // leave decorators
    } else {
      if (!trimmed.startsWith("@") && currentDecorators.length > 0) {
        // may be multiline; keep decorators for line parser limitations
      }
    }
  }

  return {
    className,
    collectionName,
    properties,
  };
}
