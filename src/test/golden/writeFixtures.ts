import * as fs from "fs/promises";
import * as path from "path";
import type { CrudCodeGenOptions } from "../../crudOptions";
import { generateCrudFileContents } from "../../generateCrudCore";

const SAMPLE_USER_ENTITY = `import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;
  @Column()
  name: string;
}
`;

const baseOptions: CrudCodeGenOptions = {
  addSwagger: true,
  useIsEmailForEmailFields: true,
  routePrefix: "",
  autoRegisterModule: true,
  dataSource: "mongodb",
  sqlIdType: "auto",
  primaryKeyField: "id",
  routeStrategy: "rest",
  restUpdateMethod: "patch",
  templatesPath: null,
  generateServiceSpec: false,
  includeInheritedEntityProperties: true,
  useClassValidatorDecorators: true,
};

async function writeScenario(
  scenarioName: string,
  opts: CrudCodeGenOptions,
): Promise<void> {
  const files = generateCrudFileContents(SAMPLE_USER_ENTITY, "user", opts);
  // From out/test/golden: repo root is three levels up
  const repoRoot = path.join(__dirname, "..", "..", "..");
  const root = path.join(
    repoRoot,
    "src",
    "test",
    "fixtures",
    "generated",
    scenarioName,
  );
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(path.join(root, "create-user.dto.ts"), files.createDto);
  await fs.writeFile(path.join(root, "update-user.dto.ts"), files.updateDto);
  await fs.writeFile(path.join(root, "user.service.ts"), files.service);
  await fs.writeFile(
    path.join(root, "user.controller.ts"),
    files.controller,
  );
}

export async function writeAllFixtures(): Promise<void> {
  await writeScenario("mongo-rest", {
    ...baseOptions,
    dataSource: "mongodb",
    routeStrategy: "rest",
  });
  await writeScenario("mongo-legacy", {
    ...baseOptions,
    dataSource: "mongodb",
    routeStrategy: "legacy",
  });
  await writeScenario("sql-rest", {
    ...baseOptions,
    dataSource: "sql",
    sqlIdType: "number",
    routeStrategy: "rest",
  });
  await writeScenario("sql-legacy", {
    ...baseOptions,
    dataSource: "sql",
    sqlIdType: "number",
    routeStrategy: "legacy",
  });
}

void writeAllFixtures().catch((err) => {
  console.error(err);
  process.exit(1);
});
