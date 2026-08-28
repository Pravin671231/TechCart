import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    env: {
      MONGODB_URI: "mongodb://localhost:27017/techcart-test",
      // REDIS_URL is deliberately omitted — it's optional (env.ts) and
      // src/lib/rateLimit.ts uses RateLimiterMemory under NODE_ENV=test
      // regardless. RATE_LIMITING_ENABLED defaults to "true", so the
      // rate-limiting suites still exercise the real sliding-window logic.
      R2_ACCOUNT_ID: "test-account-id",
      R2_ACCESS_KEY_ID: "test-access-key-id",
      R2_SECRET_ACCESS_KEY: "test-secret-access-key",
      R2_BUCKET_NAME: "test-bucket",
      R2_PUBLIC_URL_BASE: "https://cdn.test.example",
      APP_BASE_URL: "http://localhost:4000",
      JWT_SECRET: "test-jwt-secret-at-least-32-characters-long",
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
    // Each real-DB suite spins up its own full mongod process
    // (mongodb-memory-server) via bootstrapMemoryMongo(). With the default
    // fork pool running as many files in parallel as there are CPU cores,
    // enough of these suites landing on the same CI run can starve each
    // other's mongod startup badly enough to blow past even a 60s
    // connection timeout (observed directly in CI: repeatable
    // MongooseServerSelectionError / hook-timeout failures that don't
    // reproduce running a single suite in isolation). Capping concurrent
    // test files caps concurrent mongod processes, trading some wall-clock
    // time for reliability — the actual fix for this class of contention,
    // not a bigger timeout number.
    poolOptions: {
      forks: {
        maxForks: 2,
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
