import { describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { server } from "../../../mocks/server";
import { renderWithStore } from "../../../utils/renderWithStore";
import { BrandsPage } from "@/features/product-catalog/brands/BrandsPage";
import type { BrandListItem } from "@/features/product-catalog/brands/types";

const BASE = "http://localhost:4000/api/admin";

function buildPagination(items: unknown[], page = 1, limit = 20) {
  return { page, limit, total: items.length, totalPages: 1, hasNextPage: false };
}

function makeBrand(overrides: Partial<BrandListItem> = {}): BrandListItem {
  return {
    _id: "brand-1",
    name: "Acme",
    slug: "acme",
    status: true,
    productCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function setupBrandHandlers(initial: BrandListItem[]) {
  let brands = initial;

  server.use(
    http.get(`${BASE}/brands`, ({ request }) => {
      const url = new URL(request.url);
      const search = url.searchParams.get("search");
      const filtered = search
        ? brands.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()))
        : brands;
      return HttpResponse.json({ success: true, data: filtered, pagination: buildPagination(filtered) });
    }),
    http.post(`${BASE}/brands`, async ({ request }) => {
      const body = (await request.json()) as { name: string; description?: string };
      const newBrand = makeBrand({
        _id: `brand-${brands.length + 1}`,
        name: body.name,
        slug: body.name.toLowerCase().replace(/\s+/g, "-"),
        ...(body.description ? { description: body.description } : {}),
      });
      brands = [...brands, newBrand];
      return HttpResponse.json({ success: true, data: newBrand }, { status: 201 });
    }),
    http.patch(`${BASE}/brands/:id`, async ({ params, request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      brands = brands.map((b) => (b._id === params.id ? { ...b, ...body } : b));
      const updated = brands.find((b) => b._id === params.id);
      return HttpResponse.json({ success: true, data: updated });
    }),
    http.patch(`${BASE}/brands/:id/status`, async ({ params, request }) => {
      const body = (await request.json()) as { status: boolean };
      brands = brands.map((b) => (b._id === params.id ? { ...b, status: body.status } : b));
      const updated = brands.find((b) => b._id === params.id);
      return HttpResponse.json({ success: true, data: updated });
    }),
    http.delete(`${BASE}/brands/:id`, ({ params }) => {
      const target = brands.find((b) => b._id === params.id);
      if (target && target.productCount > 0) {
        return HttpResponse.json(
          {
            success: false,
            code: "BRAND_IN_USE",
            message: `Cannot delete brand: referenced by ${target.productCount} product(s).`,
          },
          { status: 409 },
        );
      }
      brands = brands.filter((b) => b._id !== params.id);
      return HttpResponse.json({ success: true, data: null });
    }),
  );
}

describe("BrandsPage", () => {
  it("renders the brand list", async () => {
    setupBrandHandlers([
      makeBrand({ _id: "brand-1", name: "Acme", productCount: 0 }),
      makeBrand({ _id: "brand-2", name: "Zenith", productCount: 3 }),
    ]);

    renderWithStore(<BrandsPage />);

    expect(await screen.findByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("Zenith")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("creates a new brand", async () => {
    setupBrandHandlers([makeBrand({ _id: "brand-1", name: "Acme" })]);

    renderWithStore(<BrandsPage />);
    await screen.findByText("Acme");

    fireEvent.click(screen.getByRole("button", { name: "+ New brand" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Nova" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Nova")).toBeInTheDocument();
  });

  it("edits an existing brand", async () => {
    setupBrandHandlers([makeBrand({ _id: "brand-1", name: "Acme" })]);

    renderWithStore(<BrandsPage />);
    await screen.findByText("Acme");

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const nameInput = await screen.findByLabelText("Name");
    expect(nameInput).toHaveValue("Acme");

    fireEvent.change(nameInput, { target: { value: "Acme Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Acme Renamed")).toBeInTheDocument();
  });

  it("shows the blocked-delete guard in a modal instead of a generic error", async () => {
    setupBrandHandlers([makeBrand({ _id: "brand-1", name: "Acme", productCount: 3 })]);

    renderWithStore(<BrandsPage />);
    await screen.findByText("Acme");

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    const confirmDialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(confirmDialog).getByRole("button", { name: "Delete" }));

    const guardDialog = await screen.findByRole("alertdialog");
    expect(within(guardDialog).getByText("Cannot delete brand")).toBeInTheDocument();
    expect(within(guardDialog).getByText(/referenced by 3 product\(s\)/)).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();

    fireEvent.click(within(guardDialog).getByRole("button", { name: "OK" }));
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
  });

  it("toggles brand status", async () => {
    setupBrandHandlers([makeBrand({ _id: "brand-1", name: "Acme", status: true })]);

    renderWithStore(<BrandsPage />);
    const statusButton = await screen.findByRole("button", { name: "Active" });

    fireEvent.click(statusButton);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Inactive" })).toBeInTheDocument();
    });
  });

  it("filters the list via search", async () => {
    setupBrandHandlers([
      makeBrand({ _id: "brand-1", name: "Acme" }),
      makeBrand({ _id: "brand-2", name: "Zenith" }),
    ]);

    renderWithStore(<BrandsPage />);
    await screen.findByText("Acme");

    fireEvent.change(screen.getByLabelText("Search brands"), { target: { value: "zen" } });

    await waitFor(() => {
      expect(screen.queryByText("Acme")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Zenith")).toBeInTheDocument();
  });

  it("debounces rapid search keystrokes into a single request", async () => {
    setupBrandHandlers([
      makeBrand({ _id: "brand-1", name: "Acme" }),
      makeBrand({ _id: "brand-2", name: "Zenith" }),
    ]);
    const requestedSearches: (string | null)[] = [];
    server.use(
      http.get(`${BASE}/brands`, ({ request }) => {
        const url = new URL(request.url);
        requestedSearches.push(url.searchParams.get("search"));
        return HttpResponse.json({ success: true, data: [], pagination: buildPagination([]) });
      }),
    );

    renderWithStore(<BrandsPage />);
    await waitFor(() => expect(requestedSearches.length).toBeGreaterThan(0));
    const requestsBeforeTyping = requestedSearches.length;

    const searchInput = screen.getByLabelText("Search brands");
    fireEvent.change(searchInput, { target: { value: "z" } });
    fireEvent.change(searchInput, { target: { value: "ze" } });
    fireEvent.change(searchInput, { target: { value: "zen" } });

    await waitFor(() => {
      expect(requestedSearches.slice(requestsBeforeTyping)).toEqual(["zen"]);
    });
  });

  it("shows an in-body indicator while a search refetch is in flight", async () => {
    setupBrandHandlers([
      makeBrand({ _id: "brand-1", name: "Acme" }),
      makeBrand({ _id: "brand-2", name: "Zenith" }),
    ]);
    server.use(
      http.get(`${BASE}/brands`, async ({ request }) => {
        const url = new URL(request.url);
        const search = url.searchParams.get("search");
        if (search) await delay(50);
        const data = search
          ? [makeBrand({ _id: "brand-2", name: "Zenith" })]
          : [makeBrand({ _id: "brand-1", name: "Acme" }), makeBrand({ _id: "brand-2", name: "Zenith" })];
        return HttpResponse.json({ success: true, data, pagination: buildPagination(data) });
      }),
    );

    renderWithStore(<BrandsPage />);
    await screen.findByText("Acme");

    fireEvent.change(screen.getByLabelText("Search brands"), { target: { value: "zen" } });

    expect(await screen.findByRole("status")).toHaveTextContent("Updating…");
    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  it("uploads a logo via the presigned-upload flow and includes it on save", async () => {
    setupBrandHandlers([makeBrand({ _id: "brand-1", name: "Acme" })]);
    server.use(
      http.post(`${BASE}/uploads/presign`, () =>
        HttpResponse.json({
          success: true,
          data: {
            uploadUrl: "https://mock-r2.local/signed-put",
            objectKey: "brand-logo/test.png",
            publicUrl: "https://cdn.example.com/brand-logo/test.png",
            expiresAt: "2026-01-01T00:05:00.000Z",
          },
        }),
      ),
      http.put("https://mock-r2.local/signed-put", () => new HttpResponse(null, { status: 200 })),
    );

    renderWithStore(<BrandsPage />);
    await screen.findByText("Acme");

    fireEvent.click(screen.getByRole("button", { name: "+ New brand" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Nova" } });

    const file = new File(["binary"], "logo.png", { type: "image/png" });
    const fileInput = screen.getByLabelText("Upload") as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByAltText("Logo preview")).toHaveAttribute(
        "src",
        "https://cdn.example.com/brand-logo/test.png",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Nova")).toBeInTheDocument();
  });

  it("pages past the first page and renders the DataTable footer from the response", async () => {
    const requestedPages: (string | null)[] = [];
    server.use(
      http.get(`${BASE}/brands`, ({ request }) => {
        const url = new URL(request.url);
        requestedPages.push(url.searchParams.get("page"));
        return HttpResponse.json({
          success: true,
          data: [makeBrand({ _id: "brand-1", name: "Acme" })],
          pagination: { page: 1, limit: 20, total: 47, totalPages: 3, hasNextPage: true },
        });
      }),
    );

    renderWithStore(<BrandsPage />);
    await screen.findByText("Acme");

    expect(screen.getByText(/Showing 1–20 of 47/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    await waitFor(() => {
      expect(requestedPages).toContain("2");
    });
  });
});
