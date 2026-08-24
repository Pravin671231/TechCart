import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    env: {
      MONGODB_URI: "mongodb://localhost:27017/techcart-test",
      // Never actually connected to — src/lib/rateLimit.ts skips
      // constructing a real ioredis client under NODE_ENV=test and uses
      // RateLimiterMemory instead. Present only so env.ts's zod schema (which
      // requires REDIS_URL like every other var) is satisfied.
      REDIS_URL: "redis://localhost:6379",
      R2_ACCOUNT_ID: "test-account-id",
      R2_ACCESS_KEY_ID: "test-access-key-id",
      R2_SECRET_ACCESS_KEY: "test-secret-access-key",
      R2_BUCKET_NAME: "test-bucket",
      R2_PUBLIC_URL_BASE: "https://cdn.test.example",
      BETTER_AUTH_SECRET: "test-better-auth-secret",
      BETTER_AUTH_URL: "http://localhost:4000",
      GOOGLE_CLIENT_ID: "test-google-client-id",
      GOOGLE_CLIENT_SECRET: "test-google-client-secret",
      // Never actually connected to — every test mocks
      // "@/externalService/mailer" wholesale, same "dummy value, never
      // dialed" reasoning as REDIS_URL above.
      MAILTRAP_HOST: "test-mailtrap-host",
      MAILTRAP_PORT: "2525",
      MAILTRAP_USER: "test-mailtrap-user",
      MAILTRAP_PASS: "test-mailtrap-pass",
      MAILTRAP_FROM_EMAIL: "noreply@test.example",
    },
    include: ["src/**/tests/**/*.test.ts", "__tests__/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
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
