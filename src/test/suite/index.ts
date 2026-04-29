import * as path from "path";
import Mocha from "mocha";
import { glob } from "glob";

/**
 * Test runner entry loaded by VS Code via --extensionTestsPath (compiled to out/test/suite/index.js).
 * Picks up glob test files under out/test/.
 */
export function run(): Promise<void> {
  const mocha = new Mocha({ ui: "tdd", color: true });
  const testsRoot = path.resolve(__dirname, "..");

  return new Promise((resolve, reject) => {
    glob("**/*.test.js", { cwd: testsRoot }, (err, files) => {
      if (err) {
        reject(err);
        return;
      }
      for (const f of files) {
        mocha.addFile(path.resolve(testsRoot, f));
      }
      mocha.run((failures) => {
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`));
        } else {
          resolve();
        }
      });
    });
  });
}
