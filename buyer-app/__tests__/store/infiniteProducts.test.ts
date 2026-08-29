import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../mocks/server";

const API_URL = "http://localhost:4000";

function listBody(items: unknown[], page: number, hasNextPage: boolean) {
  return {
    success: true,
    data: items,
    pagination: { page, limit: 24, total: 6, totalPages: 3, hasNextPage },
  };
}

function product(id: string) {
  return {
    _id: id,
    name: `Product ${id}`,
    slug: id,
    brand: { _id: "b1", name: "B", slug: "b" },
    mrp: 100,
    discount: 0,
    sellingPrice: 100,
    isFeatured: false,
    cardSpecifications: [],
  };
}

describe("getProducts infinite-scroll cache", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("merges successive pages into one accumulated cache entry", async () => {
    server.use(
      http.get(`${API_URL}/api/products`, ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get("page") ?? "1");
        return HttpResponse.json(
          listBody([product(`p${page}a`), product(`p${page}b`)], page, page < 3),
        );
      }),
    );

    const { makeStore } = await import("@/store/store");
    const { productsApi } = await import("@/features/products/api");
    const store = makeStore();

    const first = await store.dispatch(
      productsApi.endpoints.getProducts.initiate({ page: 1, sort: "newest" }),
    );
    expect(first.data?.items.map((p) => p._id)).toEqual(["p1a", "p1b"]);

    await store.dispatch(productsApi.endpoints.getProducts.initiate({ page: 2, sort: "newest" }));
    const merged = await store.dispatch(
      productsApi.endpoints.getProducts.initiate({ page: 3, sort: "newest" }),
    );

    expect(merged.data?.items.map((p) => p._id)).toEqual([
      "p1a",
      "p1b",
      "p2a",
      "p2b",
      "p3a",
      "p3b",
    ]);
    expect(merged.data?.pagination).toMatchObject({ page: 3, hasNextPage: false });
  });

  it("starts a fresh accumulated list for a different sort", async () => {
    server.use(
      http.get(`${API_URL}/api/products`, ({ request }) => {
        const url = new URL(request.url);
        const page = Number(url.searchParams.get("page") ?? "1");
        const sort = url.searchParams.get("sort");
        return HttpResponse.json(listBody([product(`${sort}-p${page}`)], page, page < 3));
      }),
    );

    const { makeStore } = await import("@/store/store");
    const { productsApi } = await import("@/features/products/api");
    const store = makeStore();

    await store.dispatch(productsApi.endpoints.getProducts.initiate({ page: 1, sort: "newest" }));
    await store.dispatch(productsApi.endpoints.getProducts.initiate({ page: 2, sort: "newest" }));
    const switched = await store.dispatch(
      productsApi.endpoints.getProducts.initiate({ page: 1, sort: "price_asc" }),
    );

    expect(switched.data?.items.map((p) => p._id)).toEqual(["price_asc-p1"]);
  });
});
