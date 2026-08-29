import { describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../mocks/server";
import { renderWithStore } from "../../utils/renderWithStore";
import { InventoryPage } from "@/features/inventory/InventoryPage";
import type { InventoryItem, Warehouse } from "@/features/inventory/types";

const BASE = "http://localhost:4000/api/admin";

function buildPagination(items: unknown[], page = 1, limit = 20) {
  return { page, limit, total: items.length, totalPages: 1, hasNextPage: false };
}

function makeWarehouse(overrides: Partial<Warehouse> = {}): Warehouse {
  return {
    _id: "warehouse-1",
    name: "Mumbai",
    code: "MUM",
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    _id: "inv-1",
    productId: "product-1",
    productName: "Nova Phone",
    variantId: "variant-1",
    variantSku: "SKU-NOVA-1",
    warehouseId: "warehouse-1",
    warehouseName: "Mumbai",
    stock: 12,
    ...overrides,
  };
}

function setupHandlers(warehouses: Warehouse[], initialItems: InventoryItem[]) {
  let items = initialItems;

  server.use(
    http.get(`${BASE}/warehouses`, () => {
      return HttpResponse.json({ success: true, data: warehouses });
    }),
    http.get(`${BASE}/inventory`, ({ request }) => {
      const url = new URL(request.url);
      const search = url.searchParams.get("search");
      const warehouseId = url.searchParams.get("warehouseId");
      let filtered = items;
      if (search) {
        const lower = search.toLowerCase();
        filtered = filtered.filter(
          (item) =>
            item.productName.toLowerCase().includes(lower) ||
            item.variantSku.toLowerCase().includes(lower),
        );
      }
      if (warehouseId) {
        filtered = filtered.filter((item) => item.warehouseId === warehouseId);
      }
      return HttpResponse.json({
        success: true,
        data: filtered,
        pagination: buildPagination(filtered),
      });
    }),
    http.patch(`${BASE}/inventory/:id`, async ({ params, request }) => {
      const body = (await request.json()) as { stock: number };
      if (body.stock < 0) {
        return HttpResponse.json(
          { success: false, code: "NEGATIVE_STOCK_REJECTED", message: "Stock cannot be negative." },
          { status: 400 },
        );
      }
      items = items.map((item) =>
        item._id === params.id ? { ...item, stock: body.stock } : item,
      );
      const updated = items.find((item) => item._id === params.id);
      return HttpResponse.json({ success: true, data: updated });
    }),
  );
}

describe("InventoryPage", () => {
  it("renders the inventory table", async () => {
    setupHandlers(
      [makeWarehouse()],
      [makeItem({ _id: "inv-1", productName: "Nova Phone", variantSku: "SKU-NOVA-1", stock: 12 })],
    );

    renderWithStore(<InventoryPage />);

    expect(await screen.findByText("Nova Phone")).toBeInTheDocument();
    expect(screen.getByText("SKU-NOVA-1")).toBeInTheDocument();
    expect(screen.getAllByText("Mumbai").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "12" })).toBeInTheDocument();
  });

  it("filters by warehouse", async () => {
    setupHandlers(
      [makeWarehouse({ _id: "wh-a", name: "Mumbai" }), makeWarehouse({ _id: "wh-b", name: "Delhi" })],
      [
        makeItem({ _id: "inv-1", productName: "Nova Phone", warehouseId: "wh-a", warehouseName: "Mumbai" }),
        makeItem({ _id: "inv-2", productName: "Zen Tablet", warehouseId: "wh-b", warehouseName: "Delhi" }),
      ],
    );

    renderWithStore(<InventoryPage />);
    await screen.findByText("Nova Phone");

    fireEvent.change(screen.getByLabelText("Warehouse"), { target: { value: "wh-b" } });

    await waitFor(() => {
      expect(screen.queryByText("Nova Phone")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Zen Tablet")).toBeInTheDocument();
  });

  it("searches by product/SKU keyword", async () => {
    setupHandlers(
      [makeWarehouse()],
      [
        makeItem({ _id: "inv-1", productName: "Nova Phone", variantSku: "SKU-NOVA-1" }),
        makeItem({ _id: "inv-2", productName: "Zen Tablet", variantSku: "SKU-ZEN-1" }),
      ],
    );

    renderWithStore(<InventoryPage />);
    await screen.findByText("Nova Phone");

    fireEvent.change(screen.getByLabelText("Search inventory"), { target: { value: "zen" } });

    await waitFor(() => {
      expect(screen.queryByText("Nova Phone")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Zen Tablet")).toBeInTheDocument();
  });

  it("edits the stock inline and persists the new value", async () => {
    setupHandlers([makeWarehouse()], [makeItem({ _id: "inv-1", stock: 5 })]);

    renderWithStore(<InventoryPage />);
    fireEvent.click(await screen.findByRole("button", { name: "5" }));

    const input = screen.getByLabelText(/Stock for/);
    fireEvent.change(input, { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("button", { name: "20" })).toBeInTheDocument();
  });

  it("shows NEGATIVE_STOCK_REJECTED inline without navigating away", async () => {
    setupHandlers([makeWarehouse()], [makeItem({ _id: "inv-1", stock: 5 })]);

    renderWithStore(<InventoryPage />);
    fireEvent.click(await screen.findByRole("button", { name: "5" }));

    const input = screen.getByLabelText(/Stock for/);
    fireEvent.change(input, { target: { value: "-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Stock cannot be negative.");
    // Still on the inventory page, still editing — no navigation occurred.
    expect(screen.getByLabelText(/Stock for/)).toBeInTheDocument();
  });
});
