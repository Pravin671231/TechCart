import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    env: {
      MONGODB_URI: "mongodb://localhost:27017/techcart-test",
      ADMIN_API_KEY: "test-admin-key",
      R2_ACCOUNT_ID: "test-account-id",
      R2_ACCESS_KEY_ID: "test-access-key-id",
      R2_SECRET_ACCESS_KEY: "test-secret-access-key",
      R2_BUCKET_NAME: "test-bucket",
      R2_PUBLIC_URL_BASE: "https://cdn.test.example",
    },
    include: ["src/**/tests/**/*.test.ts", "__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
