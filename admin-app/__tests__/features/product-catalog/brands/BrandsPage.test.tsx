import { describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../../mocks/server";
import { renderWithStore } from "../../../utils/renderWithStore";
import { BrandsPage } from "@/features/product-catalog/brands/BrandsPage";
import type { BrandListItem } from "@/features/product-catalog/brands/types";

const BASE = "http://localhost:4000/api/admin";

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
      return HttpResponse.json({ success: true, data: filtered });
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

    renderWithStore(<BrandsPage />, { adminKey: "test-key" });

    expect(await screen.findByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("Zenith")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("creates a new brand", async () => {
    setupBrandHandlers([makeBrand({ _id: "brand-1", name: "Acme" })]);

    renderWithStore(<BrandsPage />, { adminKey: "test-key" });
    await screen.findByText("Acme");

    fireEvent.click(screen.getByRole("button", { name: "+ New brand" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Nova" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Nova")).toBeInTheDocument();
  });

  it("edits an existing brand", async () => {
    setupBrandHandlers([makeBrand({ _id: "brand-1", name: "Acme" })]);

    renderWithStore(<BrandsPage />, { adminKey: "test-key" });
    await screen.findByText("Acme");

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const nameInput = await screen.findByLabelText("Name");
    expect(nameInput).toHaveValue("Acme");

    fireEvent.change(nameInput, { target: { value: "Acme Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Acme Renamed")).toBeInTheDocument();
  });

  it("shows the blocked-delete guard inline instead of a generic error", async () => {
    setupBrandHandlers([makeBrand({ _id: "brand-1", name: "Acme", productCount: 3 })]);

    renderWithStore(<BrandsPage />, { adminKey: "test-key" });
    await screen.findByText("Acme");

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/referenced by 3 product\(s\)/)).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
  });

  it("toggles brand status", async () => {
    setupBrandHandlers([makeBrand({ _id: "brand-1", name: "Acme", status: true })]);

    renderWithStore(<BrandsPage />, { adminKey: "test-key" });
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

    renderWithStore(<BrandsPage />, { adminKey: "test-key" });
    await screen.findByText("Acme");

    fireEvent.change(screen.getByLabelText("Search brands"), { target: { value: "zen" } });

    await waitFor(() => {
      expect(screen.queryByText("Acme")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Zenith")).toBeInTheDocument();
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

    renderWithStore(<BrandsPage />, { adminKey: "test-key" });
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
});
