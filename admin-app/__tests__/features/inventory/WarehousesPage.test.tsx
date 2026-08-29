import { describe, expect, it } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../mocks/server";
import { renderWithStore } from "../../utils/renderWithStore";
import { WarehousesPage } from "@/features/inventory/WarehousesPage";
import type { Warehouse } from "@/features/inventory/types";

const BASE = "http://localhost:4000/api/admin";

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

function setupHandlers(initial: Warehouse[]) {
  let warehouses = initial;

  server.use(
    http.get(`${BASE}/warehouses`, () => {
      return HttpResponse.json({ success: true, data: warehouses });
    }),
    http.post(`${BASE}/warehouses`, async ({ request }) => {
      const body = (await request.json()) as { name: string; code: string };
      if (warehouses.some((warehouse) => warehouse.code === body.code)) {
        return HttpResponse.json(
          {
            success: false,
            code: "DUPLICATE_WAREHOUSE_CODE",
            message: `Code "${body.code}" is already in use.`,
          },
          { status: 400 },
        );
      }
      const created = makeWarehouse({
        _id: `warehouse-${warehouses.length + 1}`,
        name: body.name,
        code: body.code,
      });
      warehouses = [...warehouses, created];
      return HttpResponse.json({ success: true, data: created }, { status: 201 });
    }),
  );
}

describe("WarehousesPage", () => {
  it("renders the warehouse list", async () => {
    setupHandlers([makeWarehouse({ _id: "w-1", name: "Mumbai" }), makeWarehouse({ _id: "w-2", name: "Delhi", code: "DEL" })]);

    renderWithStore(<WarehousesPage />);

    expect(await screen.findByText("Mumbai")).toBeInTheDocument();
    expect(screen.getByText("Delhi")).toBeInTheDocument();
  });

  it("creates a new warehouse", async () => {
    setupHandlers([]);

    renderWithStore(<WarehousesPage />);
    await screen.findByText("No warehouses found.");

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Bengaluru" } });
    fireEvent.change(screen.getByLabelText("Code"), { target: { value: "BLR" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("Bengaluru")).toBeInTheDocument();
  });

  it("shows a duplicate-code rejection inline", async () => {
    setupHandlers([makeWarehouse({ _id: "w-1", name: "Mumbai", code: "MUM" })]);

    renderWithStore(<WarehousesPage />);
    await screen.findByText("Mumbai");

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Mumbai 2" } });
    fireEvent.change(screen.getByLabelText("Code"), { target: { value: "MUM" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/already in use/);
  });
});
