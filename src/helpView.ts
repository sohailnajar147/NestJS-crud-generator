import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

const HELP_VIEW_ID = "nestjsCrudGenerator.help";

/**
 * TreeView "NestJS CRUD Generator" in the side bar: documentation, issues, and sample output.
 */
export class HelpViewProvider
  implements vscode.TreeDataProvider<HelpTreeItem>
{
  getTreeItem(element: HelpTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): vscode.ProviderResult<HelpTreeItem[]> {
    return [
      new HelpTreeItem({
        id: "output",
        label: "Output log",
        iconId: "output",
        commandId: "nestjs-crud-generator.openOutputLog",
      }),
      new HelpTreeItem({
        id: "docs",
        label: "Docs",
        iconId: "book",
        commandId: "nestjs-crud-generator.openReadme",
      }),
      new HelpTreeItem({
        id: "issues",
        label: "Report issue",
        iconId: "github",
        commandId: "nestjs-crud-generator.openIssues",
      }),
      new HelpTreeItem({
        id: "examples",
        label: "Generated examples",
        iconId: "file-code",
        commandId: "nestjs-crud-generator.openGeneratedExamples",
      }),
    ];
  }
}

class HelpTreeItem extends vscode.TreeItem {
  constructor(options: {
    id: string;
    label: string;
    iconId: string;
    commandId: string;
  }) {
    super(options.label, vscode.TreeItemCollapsibleState.None);
    this.id = options.id;
    this.iconPath = new vscode.ThemeIcon(options.iconId);
    this.command = { command: options.commandId, title: options.label };
  }
}

/**
 * Resolves `bugs.url` from extension package.json.
 */
function readBugsUrl(context: vscode.ExtensionContext): string {
  const pkg = context.extension.packageJSON as { bugs?: { url?: string } };
  if (pkg.bugs?.url && typeof pkg.bugs.url === "string") {
    return pkg.bugs.url;
  }
  return "https://github.com/sohailnajar147/nestjs-crud-generator/issues";
}

/**
 * Bundled `media/generated-examples` (in published VSIX), or dev clone `src/test/fixtures/generated`.
 */
function getExamplesPaths(context: vscode.ExtensionContext): {
  localDir: string;
  remoteTreeUrl: string;
} {
  const extRoot = context.extensionPath;
  const shipped = path.join(extRoot, "media", "generated-examples");
  const dev = path.join(extRoot, "src", "test", "fixtures", "generated");
  const localDir = fs.existsSync(shipped) && fs.statSync(shipped).isDirectory()
    ? shipped
    : dev;
  return {
    localDir,
    remoteTreeUrl:
      "https://github.com/sohailnajar147/nestjs-crud-generator/tree/main/src/test/fixtures/generated",
  };
}

/**
 * All `*.ts` under each first-level subfolder of `generatedRoot` (e.g. `mongo-rest/create-user.dto.ts`).
 */
function collectGeneratedExampleFiles(generatedRoot: string): {
  absPath: string;
  fileName: string;
  group: string;
}[] {
  if (!fs.existsSync(generatedRoot)) {
    return [];
  }
  const out: { absPath: string; fileName: string; group: string }[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(generatedRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  const subdirs = entries
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b));
  for (const sub of subdirs) {
    const dir = path.join(generatedRoot, sub);
    let files: string[];
    try {
      files = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const f of files.filter((n) => n.endsWith(".ts")).sort((a, b) =>
      a.localeCompare(b),
    )) {
      out.push({
        absPath: path.join(dir, f),
        fileName: f,
        group: sub,
      });
    }
  }
  return out;
}

/**
 * Open GitHub issues from `package.json` → `bugs.url`.
 */
function registerOpenIssues(
  context: vscode.ExtensionContext,
  issuesUrl: string,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "nestjs-crud-generator.openIssues",
      async () => {
        await vscode.env.openExternal(vscode.Uri.parse(issuesUrl));
      },
    ),
  );
}

type ExampleQuickPick = vscode.QuickPickItem & {
  action: "openFolder" | "file";
  absPath?: string;
};

/**
 * If fixture files exist (extension run from a clone), offer every sample + open folder.
 * Otherwise open the `generated` tree on GitHub.
 */
function registerOpenGeneratedExamples(
  context: vscode.ExtensionContext,
  paths: { localDir: string; remoteTreeUrl: string },
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "nestjs-crud-generator.openGeneratedExamples",
      async () => {
        const samples = collectGeneratedExampleFiles(paths.localDir);
        if (samples.length === 0) {
          await vscode.env.openExternal(vscode.Uri.parse(paths.remoteTreeUrl));
          return;
        }
        const folderItem: ExampleQuickPick = {
          action: "openFolder",
          label: "Open \"generated\" folder in file manager",
          description: "Samples shipped with the extension or from the repo (dev)",
          detail: paths.localDir,
        };
        const fileItems: ExampleQuickPick[] = samples.map((s) => ({
          action: "file",
          label: s.fileName,
          description: s.group,
          absPath: s.absPath,
        }));
        const chosen = await vscode.window.showQuickPick<ExampleQuickPick>(
          [folderItem, ...fileItems],
          {
            placeHolder: "Open a sample file or the folder of golden test output",
            matchOnDescription: true,
            matchOnDetail: true,
          },
        );
        if (!chosen) {
          return;
        }
        if (chosen.action === "openFolder") {
          await vscode.env.openExternal(vscode.Uri.file(paths.localDir));
          return;
        }
        if (chosen.action === "file" && chosen.absPath) {
          const doc = await vscode.workspace.openTextDocument(
            vscode.Uri.file(chosen.absPath),
          );
          await vscode.window.showTextDocument(doc, { preview: true });
        }
      },
    ),
  );
}

/**
 * Register Help TreeView, optional commands, and disposables. Safe to call from stub and full activation.
 */
export function registerHelpView(context: vscode.ExtensionContext): void {
  const issuesUrl = readBugsUrl(context);
  const { localDir, remoteTreeUrl } = getExamplesPaths(context);

  registerOpenIssues(context, issuesUrl);
  registerOpenGeneratedExamples(context, { localDir, remoteTreeUrl });

  const provider = new HelpViewProvider();

  const tree = vscode.window.createTreeView(HELP_VIEW_ID, {
    treeDataProvider: provider,
  });
  context.subscriptions.push(tree);
}