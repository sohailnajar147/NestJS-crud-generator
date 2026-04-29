export function toPascalCase(str: string): string {
  return str.replace(/(\w)(\w*)/g, function (g0, g1, g2) {
    return g1.toUpperCase() + g2.toLowerCase();
  });
}

export function toCamelCase(str: string): string {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    })
    .replace(/\s+/g, "");
}

export function getEntityName(fileName: string): string {
  return fileName.split(".")[0]; // Assuming file name is like 'employe.entity.ts' -> 'employe'
}
