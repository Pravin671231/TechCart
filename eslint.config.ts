import js from "@eslint/js";
import tseslint from "typescript-eslint";
import type { Linter } from "eslint";

const config: Linter.Config[] = tseslint.config(
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.next/**", "**/coverage/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);

export default config;
