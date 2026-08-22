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
      BETTER_AUTH_SECRET: "test-better-auth-secret",
      BETTER_AUTH_URL: "http://localhost:4000",
      GOOGLE_CLIENT_ID: "test-google-client-id",
      GOOGLE_CLIENT_SECRET: "test-google-client-secret",
      RESEND_API_KEY: "test-resend-api-key",
      RESEND_FROM_EMAIL: "noreply@test.example",
    },
    include: ["src/**/tests/**/*.test.ts", "__tests__/**/*.test.ts"],
    // mongodb-memory-server's binary download + startup (__tests__/auth)
    // blows past Vitest's 5s default.
    testTimeout: 30000,
    hookTimeout: 30000,
    // Vitest externalizes node_modules packages by default (loaded via
    // Node's own require/import, bypassing Vite's SSR module graph) — a
    // vi.mock() of a package only intercepts imports Vitest itself
    // resolves. better-auth's plugins import Google token verification from
    // @better-auth/core deep inside their own dist files, so those packages
    // need to be inlined for __tests__/auth's mocks to actually reach them.
    server: {
      deps: {
        inline: ["better-auth", "@better-auth/core", "@better-auth/mongo-adapter"],
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
