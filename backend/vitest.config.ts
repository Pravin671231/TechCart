import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/tests/**/*.test.ts", "__tests__/**/*.test.ts"],
  },
});
