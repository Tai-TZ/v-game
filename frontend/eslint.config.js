import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    // .vercel/ holds the output of `npm run build:vercel`; linting bundled assets buries the
    // real findings under thousands of errors from minified code.
    ignores: [
      "build/",
      ".react-router/",
      ".vercel/",
      "coverage/",
      "playwright-report/",
      "test-results/",
    ],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  jsxA11y.flatConfigs.strict,
  reactHooks.configs.flat.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: {
          allowDefaultProject: ["*.js", "scripts/*.mjs"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-confusing-void-expression": ["error", { ignoreArrowShorthand: true }],
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "no-console": ["error", { allow: ["warn", "error"] }],
      // A region that scrolls must be focusable or a keyboard-only player cannot scroll it
      // (axe scrollable-region-focusable, serious). That is the one case where a tab stop on a
      // non-interactive element is the accessible answer rather than the mistake this rule
      // guards against, so `role="region"` -- which the markup pairs with a label -- is allowed.
      "jsx-a11y/no-noninteractive-tabindex": ["error", { roles: ["region", "tabpanel"] }],
    },
  },
  {
    // A micro lesson is a page's worth of JS: one import from the workbench (a chip's class
    // names) once pulled ~43 kB gzip of its chunks into each lesson. scripts/check-bundle.mjs
    // fails the build on it; this says so at the import.
    files: ["app/features/micro/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["~/features/workbench/*", "../workbench/*"],
              message: "Lessons stay out of the workbench chunks: share it from app/components.",
            },
          ],
        },
      ],
    },
  },
  {
    // Plain Node scripts and config: no tsconfig covers them, so type-aware rules only see `any`.
    files: ["**/*.js", "**/*.mjs"],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
