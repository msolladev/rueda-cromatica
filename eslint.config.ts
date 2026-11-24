import { builtinModules } from "node:module";
import js from "@eslint/js";
import prettier from "eslint-config-prettier/flat";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Every module of Node, with and without its `node:` prefix, but `crypto`,
 * which only computes hashes: what the pure logic of `catalog-builder` may
 * not import (ADR-0037).
 */
const nodeModulesButCrypto = builtinModules
  .flatMap((name) =>
    name.startsWith("node:") ? [name] : [name, `node:${name}`],
  )
  .filter((name) => name !== "crypto" && name !== "node:crypto");

const PURE_MESSAGE =
  "The pure logic of catalog-builder does not reach the disk, the network, git or PDF files (ADR-0037): do it in src/cli/ and pass the data in.";

export default defineConfig(
  globalIgnores(["**/dist/", "**/dev-dist/", "**/coverage/"]),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    extends: [
      reactHooks.configs.flat["recommended-latest"],
      reactRefresh.configs.vite,
    ],
    languageOptions: { globals: globals.browser },
  },
  {
    // Entry points, not components: they are never hot-reloaded.
    files: ["apps/web/src/entry-*.tsx"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  {
    files: ["packages/catalog-builder/**/*.ts"],
    languageOptions: { globals: globals.node },
  },
  {
    // The pure logic of catalog-builder, which apps/api will use (ADR-0037).
    files: ["packages/catalog-builder/src/**/*.ts"],
    ignores: ["packages/catalog-builder/src/cli/**", "**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: nodeModulesButCrypto.map((name) => ({
            name,
            message: PURE_MESSAGE,
          })),
          patterns: [
            {
              group: ["**/cli/*", "pdfjs-dist", "pdfjs-dist/*", "prettier"],
              message: PURE_MESSAGE,
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        { name: "fetch", message: PURE_MESSAGE },
        { name: "process", message: PURE_MESSAGE },
      ],
      // The messages are returned, and the CLI prints them.
      "no-console": "error",
    },
  },
  {
    // The CLI uses the package as apps/api will: through its public API.
    files: ["packages/catalog-builder/src/cli/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../*", "!../index.ts"],
              message:
                "The CLI only uses the public API of the package, src/index.ts (ADR-0037).",
            },
          ],
        },
      ],
    },
  },
  prettier,
);
