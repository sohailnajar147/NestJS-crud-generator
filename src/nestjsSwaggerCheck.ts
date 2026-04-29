import * as fs from "fs/promises";
import * as path from "path";
import * as vscode from "vscode";

async function fileExists(f: string): Promise<boolean> {
  try {
    await fs.access(f);
    return true;
  } catch {
    return false;
  }
}

/**
 * True if a parent folder contains `node_modules/@nestjs/swagger` (hoisted or local).
 * Walks up from the entity file directory (capped) so hoisted or workspace-local installs resolve.
 */
export async function isNestjsSwaggerPackageInstalled(
  entityFilePath: string,
): Promise<boolean> {
  let dir = path.resolve(path.dirname(entityFilePath));
  for (let i = 0; i < 40; i++) {
    const marker = path.join(
      dir,
      "node_modules",
      "@nestjs",
      "swagger",
      "package.json",
    );
    if (await fileExists(marker)) {
      return true;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return false;
}

const LOCK_PREFERENCE: [string, string][] = [
  ["pnpm-lock.yaml", "pnpm add @nestjs/swagger"],
  ["yarn.lock", "yarn add @nestjs/swagger"],
  ["package-lock.json", "npm i @nestjs/swagger"],
];

/**
 * Suggests an install line based on a lock file found near the project (walk up with entity file).
 */
export async function suggestNestjsSwaggerInstallCommand(
  entityFilePath: string,
): Promise<string> {
  let dir = path.resolve(path.dirname(entityFilePath));
  for (let i = 0; i < 40; i++) {
    for (const [lock, cmd] of LOCK_PREFERENCE) {
      if (await fileExists(path.join(dir, lock))) {
        return cmd;
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return "npm i @nestjs/swagger";
}

type SwaggerMissingPick = vscode.QuickPickItem & {
  id: "copy" | "continue" | "turn-off";
};

/**
 * In-wizard only: same top-center QuickPick as other steps (not a bottom-right notification).
 */
async function promptWhenNestjsSwaggerMissingInWizard(
  entityFilePath: string,
): Promise<"continue" | "turn-off" | undefined> {
  const installCmd = await suggestNestjsSwaggerInstallCommand(entityFilePath);
  const buildItems = (): SwaggerMissingPick[] => [
    {
      id: "copy",
      label: "$(clippy) Copy install command",
      description: installCmd,
      alwaysShow: true,
    },
    {
      id: "continue",
      label: "$(check) Continue with Swagger (decorators need the package installed)",
      description: "TypeScript will error until you run the install in a terminal",
      alwaysShow: true,
    },
    {
      id: "turn-off",
      label: "$(debug-step-out) Use Skip Swagger for this run instead",
      description: "No @Api* / ApiProperty; no @nestjs/swagger required",
      alwaysShow: true,
    },
  ];
  for (;;) {
    const pick = await vscode.window.showQuickPick<SwaggerMissingPick>(buildItems(), {
      title: "NestJS CRUD — 5/7 OpenAPI: @nestjs/swagger not in node_modules",
      placeHolder:
        "The package was not found under this project. Copy the command, install in a terminal, then re-run, or continue / skip Swagger below.",
    });
    if (pick === undefined) {
      return undefined;
    }
    if (pick.id === "copy") {
      await vscode.env.clipboard.writeText(installCmd);
      continue;
    }
    if (pick.id === "continue") {
      return "continue";
    }
    return "turn-off";
  }
}

/**
 * After the user opts into Swagger, checks `node_modules` and shows an in-wizard quick pick if missing.
 * @returns resolved `addSwagger` flag, or `undefined` if the user cancels (Esc) the sub-step.
 */
export async function resolveAddSwaggerForWizard(
  entityFilePath: string,
  userWantsSwagger: boolean,
): Promise<boolean | undefined> {
  if (!userWantsSwagger) {
    return false;
  }
  if (await isNestjsSwaggerPackageInstalled(entityFilePath)) {
    return true;
  }
  const r = await promptWhenNestjsSwaggerMissingInWizard(entityFilePath);
  if (r === undefined) {
    return undefined;
  }
  if (r === "turn-off") {
    return false;
  }
  return true;
}
