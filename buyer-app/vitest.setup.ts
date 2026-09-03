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

// jsdom has no IntersectionObserver. A minimal controllable stub: every
// live observer is tracked, and `triggerIntersection()` (below) fires their
// callbacks as if their target scrolled into view — used by the
// infinite-scroll tests (Issue #326).
type ObserverCallback = (entries: { isIntersecting: boolean }[]) => void;
const observerCallbacks = new Set<ObserverCallback>();

class MockIntersectionObserver {
  private readonly callback: ObserverCallback;
  constructor(callback: ObserverCallback) {
    this.callback = callback;
    observerCallbacks.add(callback);
  }
  observe(): void {}
  unobserve(): void {}
  takeRecords(): [] {
    return [];
  }
  disconnect(): void {
    observerCallbacks.delete(this.callback);
  }
}

vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

// jsdom implements neither — `Pagination` calls both on a page change.
window.scrollTo = vi.fn();
window.matchMedia ??= vi.fn().mockReturnValue({
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}) as unknown as typeof window.matchMedia;

export function triggerIntersection(): void {
  for (const callback of observerCallbacks) {
    callback([{ isIntersecting: true }]);
  }
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
  observerCallbacks.clear();
  vi.mocked(window.scrollTo).mockClear();
});
afterAll(() => server.close());
