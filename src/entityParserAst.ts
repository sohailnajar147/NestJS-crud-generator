import { Node, Project, type ClassDeclaration, type SourceFile } from "ts-morph";
import * as ts from "typescript";
import type { ModelInfo, ModelProperty } from "./modelParser";

const IN_MEMORY_ENTITY_NAME = "entity.in-memory.ts";

function createInMemoryEntityProject(): Project {
  return new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      strict: true,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
    },
  });
}

/**
 * Shared with {@link tryParseModelFromAst} and CodeLens/Quick Fix detection
 * (same in-memory project options).
 */
function createInMemorySourceFileForEntity(text: string): SourceFile | undefined {
  const project = createInMemoryEntityProject();
  try {
    return project.createSourceFile(IN_MEMORY_ENTITY_NAME, text, {
      overwrite: true,
    });
  } catch {
    return undefined;
  }
}

/**
 * One AST pass: whether any class has `@Entity` and 0-based line numbers of each
 * `@Entity` decorator (for CodeLens placement), consistent with
 * {@link tryParseModelFromAst} selection rules for decorated classes.
 */
export function analyzeTypeormEntityFile(text: string): {
  hasEntity: boolean;
  lines0: number[];
} {
  const sourceFile = createInMemorySourceFileForEntity(text);
  if (!sourceFile) {
    return { hasEntity: false, lines0: [] };
  }
  const lines0: number[] = [];
  for (const cls of sourceFile.getClasses()) {
    const entityDeco = cls
      .getDecorators()
      .find((d) => d.getName() === "Entity");
    if (entityDeco) {
      lines0.push(entityDeco.getStartLineNumber() - 1);
    }
  }
  return { hasEntity: lines0.length > 0, lines0 };
}

/**
 * Parse a TypeORM entity using the TypeScript AST (handles multiline types,
 * wrapped property lines, and normal class fields). Falls back to caller if this returns undefined.
 */
export function tryParseModelFromAst(
  text: string,
  options?: { includeInheritedEntityProperties?: boolean },
): ModelInfo | undefined {
  const includeInheritedEntityProperties =
    options?.includeInheritedEntityProperties !== false;
  const sourceFile = createInMemorySourceFileForEntity(text);
  if (!sourceFile) {
    return undefined;
  }

  const classes = sourceFile.getClasses();
  if (classes.length === 0) {
    return undefined;
  }

  const entityClass: ClassDeclaration | undefined =
    classes.find((c) => c.getDecorators().some((d) => d.getName() === "Entity")) ??
    classes[0];

  const className = entityClass.getName();
  if (!className) {
    return undefined;
  }

  const entityDeco = entityClass
    .getDecorators()
    .find((d) => d.getName() === "Entity");
  let collectionName = className.toLowerCase() + "s";
  if (entityDeco) {
    const firstArg = entityDeco.getArguments()[0];
    if (firstArg) {
      if (Node.isStringLiteral(firstArg)) {
        const v = firstArg.getLiteralValue();
        if (v) {
          collectionName = v;
        }
      } else {
        // @Entity(() => 'x') or non-literal
        const t = firstArg.getText();
        const m = t.match(/['"]([^'"]+)['"]/);
        if (m) {
          collectionName = m[1];
        }
      }
    }
  }

  const properties: ModelProperty[] = collectModelProperties(
    entityClass,
    includeInheritedEntityProperties,
  );

  return { className, collectionName, properties };
}

/**
 * When `includeInherited` is true, includes property declarations from same-file
 * base classes (ts-morph `getBaseClass()`), with derived members overriding by name.
 */
function collectModelProperties(
  entityClass: ClassDeclaration,
  includeInherited: boolean,
): ModelProperty[] {
  const byName = new Map<string, ModelProperty>();
  const chain: ClassDeclaration[] = [];
  if (includeInherited) {
    const seen = new Set<string>();
    let cur: ClassDeclaration | undefined = entityClass;
    while (cur) {
      const n = cur.getName() ?? "";
      if (seen.has(n) || !n) {
        break;
      }
      seen.add(n);
      chain.unshift(cur);
      const base = cur.getBaseClass();
      cur = base ?? undefined;
    }
  } else {
    chain.push(entityClass);
  }

  for (const cls of chain) {
    for (const prop of cls.getProperties()) {
      if (!Node.isPropertyDeclaration(prop)) {
        continue;
      }
      if (prop.isStatic()) {
        continue;
      }
      const name = prop.getName();
      if (name.startsWith("_")) {
        continue;
      }
      const isOptional = prop.hasQuestionToken();
      const typeNode = prop.getTypeNode();
      const typeText = typeNode ? typeNode.getText().trim() : "unknown";
      const isArray =
        typeText.endsWith("[]") || typeText.startsWith("Array<");
      const decorators = prop
        .getDecorators()
        .map((d) => d.getText().split("\n").map((l) => l.trim()).join(" "));

      byName.set(name, {
        name,
        type: typeText,
        decorators,
        isOptional,
        isArray,
      });
    }
  }
  return Array.from(byName.values());
}
