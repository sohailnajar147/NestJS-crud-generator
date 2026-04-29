/** Resolved from user settings and entity before codegen. */
export type DataSource = "mongodb" | "sql";

export type SqlIdType = "number" | "string" | "auto";

export type RouteStrategy = "rest" | "legacy";

export type RestUpdateMethod = "put" | "patch";

export type PreviewMode = "perFile" | "batch" | "off";

export interface CrudCodeGenOptions {
  addSwagger: boolean;
  useIsEmailForEmailFields: boolean;
  routePrefix: string;
  autoRegisterModule: boolean;
  dataSource: DataSource;
  sqlIdType: SqlIdType;
  /** @default 'id' */
  primaryKeyField: string;
  routeStrategy: RouteStrategy;
  restUpdateMethod: RestUpdateMethod;
  /**
   * `null` or `""` (not set): use built-in string builders. Otherwise a user folder of `*.hbs` files (see README).
   */
  templatesPath: string | null;
  /** When true (built-in codegen only), emit `*.service.spec.ts` with a Jest scaffold. Ignored when using custom Handlebars templates. */
  generateServiceSpec: boolean;
  /** Merge `@Column` fields from same-file base classes into DTOs (TypeScript AST). */
  includeInheritedEntityProperties: boolean;
  /**
   * When true, Create DTO emits class-validator decorators (requires `class-validator` in the app).
   * Default in settings is false so minimal Nest projects compile without extra deps.
   */
  useClassValidatorDecorators: boolean;
}
