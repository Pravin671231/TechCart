import { afterEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../mocks/server";
import { api } from "@/store/api";
import { createStore } from "@/store/store";
import { ADMIN_KEY_STORAGE_KEY } from "@/store/authSlice";

const PING_URL = "http://localhost:4000/api/admin/ping";

const testApi = api.injectEndpoints({
  endpoints: (build) => ({
    ping: build.query<unknown, void>({ query: () => "/ping" }),
  }),
});

describe("api", () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it("attaches X-Admin-Key when an admin key is present", async () => {
    let capturedHeader: string | null = null;
    server.use(
      http.get(PING_URL, ({ request }) => {
        capturedHeader = request.headers.get("X-Admin-Key");
        return HttpResponse.json({ success: true, data: {} });
      }),
    );

    const store = createStore({ auth: { adminKey: "secret123" } });
    await store.dispatch(testApi.endpoints.ping.initiate());

    expect(capturedHeader).toBe("secret123");
  });

  it("never sends X-Admin-Key when no admin key is set", async () => {
    let capturedHeader: string | null = "unset";
    server.use(
      http.get(PING_URL, ({ request }) => {
        capturedHeader = request.headers.get("X-Admin-Key");
        return HttpResponse.json({ success: true, data: {} });
      }),
    );

    const store = createStore({ auth: { adminKey: null } });
    await store.dispatch(testApi.endpoints.ping.initiate());

    expect(capturedHeader).toBeNull();
  });

  it("clears the stored admin key on a 401 response", async () => {
    server.use(
      http.get(PING_URL, () =>
        HttpResponse.json(
          { success: false, code: "UNAUTHORIZED", message: "Missing or invalid admin credentials" },
          { status: 401 },
        ),
      ),
    );

    sessionStorage.setItem(ADMIN_KEY_STORAGE_KEY, "secret123");
    const store = createStore({ auth: { adminKey: "secret123" } });
    await store.dispatch(testApi.endpoints.ping.initiate());

    expect(store.getState().auth.adminKey).toBeNull();
    expect(sessionStorage.getItem(ADMIN_KEY_STORAGE_KEY)).toBeNull();
  });
});
