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
    // (mongodb-memory-server) via bootstrapMemoryMongo(). A subset of these
    // suites has failed identically and repeatably in CI (Mongoose/Vitest
    // connection timeouts) regardless of concurrency level — maxForks:2 was
    // tried first and made no measurable difference (near-identical
    // duration and the exact same failing files), so this pins to a single
    // fork to fully rule concurrency in or out as the cause before treating
    // it as something else entirely.
    poolOptions: {
      forks: {
        maxForks: 1,
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
