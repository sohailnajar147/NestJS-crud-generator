/* eslint-env node */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  env: {
    node: true,
    es6: true,
  },
  ignorePatterns: ["out/", "node_modules/"],
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
  },
  overrides: [
    {
      files: ["src/test/**/*.ts"],
      env: {
        mocha: true,
      },
    },
  ],
};
