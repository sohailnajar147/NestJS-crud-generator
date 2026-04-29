import * as path from "path";
import { runTests } from "@vscode/test-electron";

async function main() {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, "../../");
    const extensionTestsPath = path.resolve(__dirname, "./suite/index");
    const fixtureApp = path.join(
      extensionDevelopmentPath,
      "src",
      "test",
      "fixtures",
      "nest-app",
    );
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [fixtureApp],
    });
  } catch (err) {
    console.error("Failed to run tests", err);
    process.exit(1);
  }
}

void main();
