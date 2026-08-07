import { describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../../mocks/server";
import { renderWithStore } from "../../../utils/renderWithStore";
import { CategoryVariantsPage } from "@/features/product-catalog/categoryVariants/CategoryVariantsPage";
import type { VariantAxis } from "@/features/product-catalog/categoryVariants/types";

const BASE = "http://localhost:4000/api/admin";
const CATEGORY_ID = "cat-1";

function setupHandlers(initialAxes: VariantAxis[]) {
  let variants = initialAxes;
  let lastPutBody: unknown;
  let lastPatchBody: unknown;
  let deleteCallCount = 0;

  server.use(
    http.get(`${BASE}/categories`, () =>
      HttpResponse.json({
        success: true,
        data: [
          {
            _id: CATEGORY_ID,
            name: "Smartphones",
            slug: "smartphones",
            parentCategory: null,
            sortOrder: 1,
            status: true,
            productCount: 0,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
    ),
    http.get(`${BASE}/categories/:id/variant-types`, () =>
      HttpResponse.json({ success: true, data: { category: CATEGORY_ID, variants } }),
    ),
    http.put(`${BASE}/categories/:id/variant-types`, async ({ request }) => {
      const body = (await request.json()) as { variants: VariantAxis[] };
      lastPutBody = body;
      variants = body.variants;
      return HttpResponse.json({ success: true, data: { category: CATEGORY_ID, variants } });
    }),
    http.patch(`${BASE}/categories/:id/variant-types`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      lastPatchBody = body;

      if (body.op === "deleteAxis") {
        deleteCallCount += 1;
        variants = variants.filter((axis) => axis.code !== body.code);
      } else if (body.op === "updateAxis") {
        variants = variants.map((axis) =>
          axis.code === body.code ? (body.axis as VariantAxis) : axis,
        );
      }

      return HttpResponse.json({ success: true, data: { category: CATEGORY_ID, variants } });
    }),
  );

  return {
    getLastPutBody: () => lastPutBody,
    getLastPatchBody: () => lastPatchBody,
    getDeleteCallCount: () => deleteCallCount,
  };
}

describe("CategoryVariantsPage", () => {
  it("renders the synthetic empty state before any PUT", async () => {
    setupHandlers([]);

    renderWithStore(<CategoryVariantsPage />, { adminKey: "test-key" });

    expect(await screen.findByRole("button", { name: "Save axes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Add axis" })).toBeInTheDocument();
    expect(screen.queryByText(/unable to load/i)).not.toBeInTheDocument();
  });

  it("adds an axis locally, then persists it via one full-replace PUT", async () => {
    const handlers = setupHandlers([]);
    renderWithStore(<CategoryVariantsPage />, { adminKey: "test-key" });
    await screen.findByRole("button", { name: "Save axes" });

    fireEvent.click(screen.getByRole("button", { name: "+ Add axis" }));
    const nameInput = await screen.findByLabelText("Axis name");
    fireEvent.change(nameInput, { target: { value: "Colour" } });

    fireEvent.click(screen.getByRole("button", { name: "Save axes" }));

    await waitFor(() => {
      const body = handlers.getLastPutBody() as { variants: VariantAxis[] };
      expect(body.variants).toHaveLength(1);
      expect(body.variants[0]!.name).toBe("Colour");
    });
  });

  it("deletes a persisted axis with no in-use guard, matching backend", async () => {
    const handlers = setupHandlers([
      { name: "Colour", code: "color", type: "color", required: true, options: [{ label: "Black", value: "#000" }] },
    ]);
    renderWithStore(<CategoryVariantsPage />, { adminKey: "test-key" });

    await screen.findByDisplayValue("Colour");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(handlers.getDeleteCallCount()).toBe(1));
    await waitFor(() => expect(screen.queryByDisplayValue("Colour")).not.toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("toggles required on a persisted axis via PATCH updateAxis", async () => {
    const handlers = setupHandlers([
      { name: "Bundle Size", code: "bundle", type: "number", required: false },
    ]);
    renderWithStore(<CategoryVariantsPage />, { adminKey: "test-key" });

    const checkbox = await screen.findByLabelText("Required: Bundle Size");
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(handlers.getLastPatchBody()).toMatchObject({
        op: "updateAxis",
        code: "bundle",
        axis: { required: true },
      });
    });
    await waitFor(() => expect(checkbox).toBeChecked());
  });

  it("hides the options editor for text and number axis types", async () => {
    setupHandlers([{ name: "Engraving", code: "engraving", type: "text", required: false }]);
    renderWithStore(<CategoryVariantsPage />, { adminKey: "test-key" });

    await screen.findByDisplayValue("Engraving");
    expect(screen.getByText("— not used for text")).toBeInTheDocument();
    expect(screen.queryByLabelText("Options for Engraving")).not.toBeInTheDocument();
  });
});
