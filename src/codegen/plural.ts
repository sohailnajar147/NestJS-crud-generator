import pluralize from "pluralize";

export function pluralPascalForRoutes(className: string): string {
  const w = pluralize(className);
  return w.charAt(0).toUpperCase() + w.slice(1);
}
