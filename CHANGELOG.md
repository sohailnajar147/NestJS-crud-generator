# Changelog

All notable changes to this project are documented in this file.

## [0.3.2] — 2026-04-29

### Fixed

- Listed **`typescript`** as a runtime **dependency** so the published VSIX includes it. The extension imports `typescript` for AST work (`ts-morph`); it was previously only under `devDependencies`, so Marketplace installs failed at activation while local debug worked.

[0.3.2]: https://github.com/sohailnajar147/nestjs-crud-generator/compare/v0.3.1...v0.3.2

## [0.3.1] — 2026-04-29

### Changed

- Updated extension icon (`images/icon.png`).

[0.3.1]: https://github.com/sohailnajar147/nestjs-crud-generator

## [0.3.0] — 2026-04-27

First public release on the Visual Studio Marketplace.

### Added

- Generate NestJS CRUD artifacts from a TypeORM entity: create/update DTOs, service, and controller.
- Optional AST-based registration in the nearest `*.module.ts` (controller, service, `TypeOrmModule.forFeature`), with a manual snippet when automatic patching is not possible.
- Preview before write: `perFile`, `batch`, or `off` (`nestjsCrud.previewMode`).
- Options wizard for data source (SQL or MongoDB), routes (REST or legacy), Swagger, module updates, and related choices; quick command without the wizard.
- Undo last generation (files and module snapshot).
- Optional `@nestjs/swagger` on DTOs and controller; optional `@IsEmail()` for email-like fields; optional same-file base class fields in DTOs.
- Custom Handlebars templates via `nestjsCrud.templatesPath`.
- In-editor walkthrough, activity bar help view, output log, and links to README, issues, and generated examples.

[0.3.0]: https://github.com/sohailnajar147/nestjs-crud-generator
