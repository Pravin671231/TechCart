import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../mocks/server";

const API_URL = "http://localhost:4000";

describe("api slice", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("unwraps a {success:true,data} response into the query's data", async () => {
    server.use(
      http.get(`${API_URL}/ping`, () => HttpResponse.json({ success: true, data: { ok: true } })),
    );

    const { makeStore } = await import("@/store/store");
    const { api } = await import("@/store/api");
    const testApi = api.injectEndpoints({
      endpoints: (builder) => ({
        ping: builder.query<{ ok: boolean }, void>({ query: () => "ping" }),
      }),
    });

    const result = await makeStore().dispatch(testApi.endpoints.ping.initiate());
    expect(result.data).toEqual({ ok: true });
    expect(result.error).toBeUndefined();
  });

  it("surfaces a {success:false,code,message} response as the query's error, intact", async () => {
    server.use(
      http.get(`${API_URL}/ping`, () =>
        HttpResponse.json(
          { success: false, code: "NOT_FOUND", message: "Not found" },
          { status: 404 },
        ),
      ),
    );

    const { makeStore } = await import("@/store/store");
    const { api } = await import("@/store/api");
    const testApi = api.injectEndpoints({
      endpoints: (builder) => ({
        ping: builder.query<{ ok: boolean }, void>({ query: () => "ping" }),
      }),
    });

    const result = await makeStore().dispatch(testApi.endpoints.ping.initiate());
    expect(result.error).toEqual({ code: "NOT_FOUND", message: "Not found" });
  });

  it("synthesizes a message for the {code,errors} validation-error shape", async () => {
    server.use(
      http.get(`${API_URL}/ping`, () =>
        HttpResponse.json(
          { success: false, code: "VALIDATION_ERROR", errors: { name: "Required" } },
          { status: 400 },
        ),
      ),
    );

    const { makeStore } = await import("@/store/store");
    const { api } = await import("@/store/api");
    const testApi = api.injectEndpoints({
      endpoints: (builder) => ({
        ping: builder.query<{ ok: boolean }, void>({ query: () => "ping" }),
      }),
    });

    const result = await makeStore().dispatch(testApi.endpoints.ping.initiate());
    expect(result.error).toMatchObject({ code: "VALIDATION_ERROR" });
    expect((result.error as { message: string }).message).toContain("Required");
  });

  it("throws at import time when NEXT_PUBLIC_API_URL is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    await expect(import("@/store/env")).rejects.toThrow(/NEXT_PUBLIC_API_URL/);
  });
});
