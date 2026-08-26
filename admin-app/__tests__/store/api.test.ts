import { afterEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../mocks/server";
import { api } from "@/app/api/baseApi";
import { createStore } from "@/app/store/store";
import { setToken, clearToken } from "@/features/authentication/auth/tokenStorage";

const PING_URL = "http://localhost:4000/api/admin/ping";

const testApi = api.injectEndpoints({
  endpoints: (build) => ({
    ping: build.query<unknown, void>({ query: () => "/ping" }),
  }),
});

describe("api", () => {
  afterEach(() => {
    clearToken();
  });

  it("attaches Authorization: Bearer when a token is present", async () => {
    let capturedHeader: string | null = null;
    server.use(
      http.get(PING_URL, ({ request }) => {
        capturedHeader = request.headers.get("Authorization");
        return HttpResponse.json({ success: true, data: {} });
      }),
    );

    setToken("secret123");
    const store = createStore();
    await store.dispatch(testApi.endpoints.ping.initiate());

    expect(capturedHeader).toBe("Bearer secret123");
  });

  it("never sends an Authorization header when no token is set", async () => {
    let capturedHeader: string | null = "unset";
    server.use(
      http.get(PING_URL, ({ request }) => {
        capturedHeader = request.headers.get("Authorization");
        return HttpResponse.json({ success: true, data: {} });
      }),
    );

    const store = createStore();
    await store.dispatch(testApi.endpoints.ping.initiate());

    expect(capturedHeader).toBeNull();
  });
});
