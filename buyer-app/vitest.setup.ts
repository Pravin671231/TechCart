import { config } from "dotenv";
import path from "path";
import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { server } from "./__tests__/mocks/server";

config({
  path: path.resolve(__dirname, ".env.local"),
});

if (!process.env.NEXT_PUBLIC_API_URL) {
  vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:4000");
}
if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
  vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com");
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());
