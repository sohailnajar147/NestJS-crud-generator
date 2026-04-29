# NestJS CRUD Generator (TypeORM)

**Generate NestJS controller, service, and DTOs from a TypeORM entity—with a diff preview before anything is written.**

[![CI](https://github.com/sohailnajar147/nestjs-crud-generator/actions/workflows/ci.yml/badge.svg)](https://github.com/sohailnajar147/nestjs-crud-generator/actions/workflows/ci.yml)

## 🎥 Demo

![Demo GIF](./media/demo.gif)

*Open the Command Palette and run **NestJS CRUD: Generate CRUD from entity** on a NestJS entity file.*

## ✨ Features

- **Generated files** — `dto/create-*.dto.ts`, `dto/update-*.dto.ts`, `*.service.ts`, and `*.controller.ts` next to your feature; optional `*.service.spec.ts` (built-in templates only)
- **Module wiring** — optional AST-based updates to the chosen `*.module.ts` (`TypeOrmModule.forFeature`, controller, service, imports) when your `@Module()` uses inline arrays; import paths are computed **relative to that module file** (e.g. registering under `app.module.ts` uses `./feature/...`, not `./entities/...`). Manual snippet when patching is not possible
- **Diff before write** — preview modes `perFile`, `batch`, or `off` (see `nestjsCrud.previewMode`)
- **Multiple ways to start** — Command Palette, **CodeLens** on `@Entity`, **Quick Fix** (`Ctrl+.` / `Cmd+.`), editor title bar, or Explorer/context menu on TypeScript files
- **Options wizard** — step-through for data source, routes, Swagger, and more; disable with `nestjsCrud.showOptionsWizard` and rely on settings only
- **Quick generate** — run without the wizard using saved settings merged with your last custom run
- **TypeORM SQL or MongoDB** — `Repository` / SQL drivers or `MongoRepository` + string IDs, chosen in settings or the wizard
- **Routes** — REST-style paths (default) or legacy-style paths; REST updates via **PATCH** or **PUT**
- **Optional @nestjs/swagger** — decorators on DTOs and controller when enabled
- **DTO hints** — optional `@IsEmail()` for email-like string fields; same-file base class fields can be merged into DTOs when enabled
- **Conflict awareness** — warnings for duplicate routes or DTO names in the feature folder, with a path to generate anyway
- **Undo** — one-step revert of the last generation (files + module snapshot)
- **Custom templates** — optional Handlebars folder via `nestjsCrud.templatesPath` instead of built-in codegen
- **In-editor help** — **NestJS CRUD** activity bar view (log, docs link, examples, issue link) and a getting-started walkthrough

## Commands

All commands appear under the **NestJS CRUD** category in the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).

| Command | What it does |
| --- | --- |
| **NestJS CRUD: Generate CRUD from entity** | Main flow: optional options wizard, preview, then generate. |
| **NestJS CRUD: Generate CRUD (quick, saved or last custom options)** | Same generator without the wizard; uses workspace settings and your last wizard choices. |
| **NestJS CRUD: Undo last CRUD generation** | Reverts the previous run once (generated files + last module patch). |
| **NestJS CRUD: Show “NestJS CRUD Generator” output log** | Opens the output channel for template errors and technical detail. |
| **NestJS CRUD: Open extension README on GitHub** | Opens this README in the browser. |
| **NestJS CRUD: Open “Getting started” walkthrough** | Opens the in-editor walkthrough. |
| **NestJS CRUD: Open extension issue tracker (GitHub)** | Opens the repository issues page. |
| **NestJS CRUD: Open or browse generated code examples** | Sample generated files (or GitHub) for reference. |

## 🚀 How to use

1. Open a **NestJS** project in VS Code.
2. Open a **TypeORM entity** file (e.g. `*.entity.ts`).
3. Open the **Command Palette** (`Ctrl+Shift+P` on Windows/Linux, `Cmd+Shift+P` on macOS).
4. Run **NestJS CRUD: Generate CRUD from entity** (you can type `Generate CRUD` to find it).
5. Follow the prompts, **review the diffs**, and confirm to write files.

You can also start from the **CodeLens** on `@Entity`, **Quick Fix** (`Ctrl+.` / `Cmd+.`), or the editor **title bar** when a TypeScript file is active.

## ⚙️ Requirements

- A **NestJS** application
- **TypeORM** entities the extension can parse (`.ts` entity files with `@Entity()`)
- **VS Code 1.80** or newer
- When **`nestjsCrud.useClassValidatorDecorators`** is **true**, install **`class-validator`** (and usually **`class-transformer`** for `ValidationPipe`) in the project: `npm i class-validator class-transformer`. With the default **`useClassValidatorDecorators`: false**, generated Create DTOs are plain TypeScript fields (no `class-validator` import).

## ⚠️ Limitations

- Built for **TypeORM** — not a generic multi-ORM scaffold tool.
- Assumes a **common NestJS layout** (e.g. feature module next to an `entities/` folder). If your repo is structured differently, you may need to tweak imports or module registration by hand.
- **Non-standard or highly custom setups** (unusual module patterns, variable-based `@Module()` arrays, etc.) may need manual follow-up; the extension focuses on everyday projects, not every edge case. If AST-based module patching fails, **DTOs, service, and controller are still written** — register them in `@Module()` yourself using the offered snippet or Output panel.

## 🛠️ Extension settings

Settings are grouped under **`nestjsCrud.*`** in VS Code (search “nestjs crud” in Settings). Use them to tune Swagger, preview mode, SQL vs Mongo, route style, module auto-registration, and more. Additional options may ship in future releases—check the Settings UI for the latest list.

## 📌 Why this extension?

- **Safer than blind CLI runs** — you see diffs before files change.
- **Preview-first** — fewer surprises in real codebases.
- **Built for day-to-day Nest apps** — not a heavyweight “scaffold everything” platform.

## 🧪 Status

Actively maintained. Feedback and issues are welcome on [GitHub Issues](https://github.com/sohailnajar147/nestjs-crud-generator/issues).

## License

MIT — see [LICENSE](LICENSE).
