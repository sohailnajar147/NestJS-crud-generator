import type { ModelInfo } from "./modelParser";
import type { SqlIdType } from "./crudOptions";

export type ResolvedSqlIdType = "number" | "string";

/**
 * Resolves `sql` primary key type for generated Repository code.
 * `auto` uses the `id` property type when present, else heuristics on raw text.
 */
export function resolveSqlIdType(
  mode: SqlIdType,
  entityText: string,
  model: ModelInfo,
  primaryKeyField: string,
): ResolvedSqlIdType {
  if (mode === "number" || mode === "string") {
    return mode;
  }
  const pk = model.properties.find((p) => p.name === primaryKeyField);
  if (pk) {
    const t = pk.type.trim();
    if (t === "number" || t === "bigint" || t === "int") {
      return "number";
    }
    if (t === "string" || t.includes("String")) {
      return "string";
    }
  }
  if (/@PrimaryGeneratedColumn\s*\(\s*['"]uuid['"]/m.test(entityText)) {
    return "string";
  }
  if (new RegExp(`\\b${primaryKeyField}\\s*:\\s*number\\b`).test(entityText)) {
    return "number";
  }
  if (new RegExp(`\\b${primaryKeyField}\\s*:\\s*string\\b`).test(entityText)) {
    return "string";
  }
  return "string";
}
