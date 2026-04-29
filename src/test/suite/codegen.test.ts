import * as assert from "assert";
import * as path from "path";
import { generateCrudFileContents } from "../../generateCrudCore";
import type { CrudCodeGenOptions } from "../../crudOptions";

const SAMPLE = `import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('items')
export class Item {
  @PrimaryGeneratedColumn()
  id: number;
  @Column()
  title: string;
}
`;

const base: CrudCodeGenOptions = {
  addSwagger: false,
  useIsEmailForEmailFields: true,
  routePrefix: "",
  autoRegisterModule: true,
  dataSource: "sql",
  sqlIdType: "number",
  primaryKeyField: "id",
  routeStrategy: "rest",
  restUpdateMethod: "patch",
  templatesPath: null,
  generateServiceSpec: false,
  includeInheritedEntityProperties: true,
  useClassValidatorDecorators: true,
};

suite("codegen", () => {
  test("Create DTO omits class-validator when useClassValidatorDecorators is false", () => {
    const { createDto } = generateCrudFileContents(SAMPLE, "item", {
      ...base,
      useClassValidatorDecorators: false,
      addSwagger: false,
    });
    assert.ok(!createDto.includes("class-validator"));
    assert.ok(createDto.includes("export class CreateItemDto"));
    assert.ok(createDto.includes("title: string"));
  });

  test("REST SQL controller has no unused Nest imports and uses ParseIntPipe for number id", () => {
    const { controller } = generateCrudFileContents(SAMPLE, "item", {
      ...base,
      addSwagger: false,
    });
    assert.ok(controller.includes("ParseIntPipe"));
    assert.ok(controller.includes("@Get(':id')"));
    assert.ok(!controller.includes("UseInterceptors"));
    assert.ok(!controller.includes("ApiOperation"));
  });

  test("legacy Mongo controller includes verbose route segment", () => {
    const { controller } = generateCrudFileContents(SAMPLE, "item", {
      ...base,
      dataSource: "mongodb",
      routeStrategy: "legacy",
    });
    assert.ok(controller.includes("@Post('AddItem')"));
    assert.ok(controller.includes("@Get('showItems')"));
  });

  test("stock Handlebars templates match built-in string builders (SQL rest)", () => {
    const templatesDir = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "templates",
    );
    const opts = { ...base };
    const fromBuiltin = generateCrudFileContents(SAMPLE, "item", opts, null);
    const fromHbs = generateCrudFileContents(SAMPLE, "item", opts, templatesDir);
    assert.strictEqual(fromHbs.createDto, fromBuiltin.createDto);
    assert.strictEqual(fromHbs.updateDto, fromBuiltin.updateDto);
    assert.strictEqual(fromHbs.service, fromBuiltin.service);
    assert.strictEqual(fromHbs.controller, fromBuiltin.controller);
  });
});
