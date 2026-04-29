import type { ModelInfo } from "../modelParser";

export function collectValidatorsForProperty(
  prop: {
    name: string;
    type: string;
    isOptional: boolean;
    isArray: boolean;
  },
  useIsEmailForEmailFields: boolean,
): string[] {
  const names: string[] = [];
  if (prop.isOptional) {
    names.push("IsOptional");
  } else {
    names.push("IsNotEmpty");
  }
  if (prop.isArray) {
    names.push("IsArray");
  } else if (prop.type === "number") {
    names.push("IsNumber");
  } else if (prop.type === "boolean") {
    names.push("IsBoolean");
  } else if (prop.type === "Date") {
    names.push("IsDateString");
  } else {
    if (useIsEmailForEmailFields && /email/i.test(prop.name)) {
      names.push("IsEmail");
    } else {
      names.push("IsString");
    }
  }
  return names;
}

export function buildCreateDtoFile(params: {
  model: ModelInfo;
  entityName: string;
  addSwagger: boolean;
  useIsEmailForEmailFields: boolean;
  useClassValidatorDecorators: boolean;
}): { content: string; usedClassValidatorImports: string[] } {
  const {
    model,
    entityName,
    addSwagger,
    useIsEmailForEmailFields,
    useClassValidatorDecorators,
  } = params;
  const usedValidators = new Set<string>();

  let body = "";
  for (const prop of model.properties) {
    const vNames = useClassValidatorDecorators
      ? collectValidatorsForProperty(prop, useIsEmailForEmailFields)
      : [];
    vNames.forEach((n) => usedValidators.add(n));

    const decoratorLines: string[] = [];
    for (const name of vNames) {
      decoratorLines.push(`@${name}()`);
    }
    if (addSwagger) {
      let example = "example";
      if (prop.type === "number") {
        example = "1";
      } else if (prop.type === "boolean") {
        example = "true";
      } else if (prop.type === "Date") {
        example = "2024-01-01";
      }
      decoratorLines.push(
        `@ApiProperty({ example: ${JSON.stringify(example)}, description: 'The ${prop.name} of the ${entityName}' })`,
      );
    }
    const inner = "  ";
    const decoBlock =
      decoratorLines.length > 0
        ? `${inner}${decoratorLines.join(`\n${inner}`)}\n`
        : "";
    body += `${decoBlock}${inner}${prop.name}: ${prop.type};\n\n`;
  }

  const headerLines: string[] = [];
  if (useClassValidatorDecorators) {
    const sortedValidators = Array.from(usedValidators).sort();
    headerLines.push(
      `import { ${sortedValidators.join(", ")} } from 'class-validator';`,
    );
  }
  if (addSwagger) {
    headerLines.push("import { ApiProperty } from '@nestjs/swagger';");
  }
  const header =
    headerLines.length > 0 ? `${headerLines.join("\n")}\n\n` : "";

  const content = `${header}export class Create${entityName}Dto {
${body}}
`;
  return {
    content,
    usedClassValidatorImports: Array.from(usedValidators).sort(),
  };
}

export function buildUpdateDtoFile(
  entityName: string,
  entityFile: string,
): string {
  return `import { PartialType } from '@nestjs/mapped-types';
import { Create${entityName}Dto } from './create-${entityFile}.dto';

export class Update${entityName}Dto extends PartialType(Create${entityName}Dto) {}
`;
}
