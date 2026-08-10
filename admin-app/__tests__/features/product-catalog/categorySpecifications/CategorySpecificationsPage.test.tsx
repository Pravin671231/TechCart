import { describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../../mocks/server";
import { renderWithStore } from "../../../utils/renderWithStore";
import { CategorySpecificationsPage } from "@/features/product-catalog/categorySpecifications/CategorySpecificationsPage";
import type { SpecificationGroup } from "@/features/product-catalog/categorySpecifications/types";

const BASE = "http://localhost:4000/api/admin";
const CATEGORY_ID = "cat-1";

function setupHandlers(
  initialGroups: SpecificationGroup[],
  options: { patchError?: { status: number; code: string; message: string } } = {},
) {
  let specificationGroups = initialGroups;
  let lastPutBody: unknown;
  let lastPatchBody: unknown;

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
    http.get(`${BASE}/categories/:id/specifications`, () =>
      HttpResponse.json({ success: true, data: { category: CATEGORY_ID, specificationGroups } }),
    ),
    http.put(`${BASE}/categories/:id/specifications`, async ({ request }) => {
      const body = (await request.json()) as { specificationGroups: SpecificationGroup[] };
      lastPutBody = body;
      specificationGroups = body.specificationGroups;
      return HttpResponse.json({
        success: true,
        data: { category: CATEGORY_ID, specificationGroups },
      });
    }),
    http.patch(`${BASE}/categories/:id/specifications`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      lastPatchBody = body;
      if (options.patchError) {
        return HttpResponse.json(
          { success: false, code: options.patchError.code, message: options.patchError.message },
          { status: options.patchError.status },
        );
      }

      if (body.op === "renameGroup") {
        specificationGroups = specificationGroups.map((g) =>
          g.groupName === body.groupName ? { ...g, groupName: body.newGroupName as string } : g,
        );
      } else if (body.op === "deleteGroup") {
        specificationGroups = specificationGroups.filter((g) => g.groupName !== body.groupName);
      } else if (body.op === "updateField") {
        specificationGroups = specificationGroups.map((g) =>
          g.groupName === body.groupName
            ? {
                ...g,
                specifications: g.specifications.map((f) =>
                  f.name === body.name ? (body.field as SpecificationGroup["specifications"][number]) : f,
                ),
              }
            : g,
        );
      } else if (body.op === "deleteField") {
        specificationGroups = specificationGroups.map((g) =>
          g.groupName === body.groupName
            ? { ...g, specifications: g.specifications.filter((f) => f.name !== body.name) }
            : g,
        );
      }

      return HttpResponse.json({
        success: true,
        data: { category: CATEGORY_ID, specificationGroups },
      });
    }),
  );

  return {
    getLastPutBody: () => lastPutBody,
    getLastPatchBody: () => lastPatchBody,
  };
}

describe("CategorySpecificationsPage", () => {
  it("renders the synthetic empty state before any PUT, not an error", async () => {
    setupHandlers([]);

    renderWithStore(<CategorySpecificationsPage />, { adminKey: "test-key" });

    expect(await screen.findByRole("button", { name: "Save schema" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Add group" })).toBeInTheDocument();
    expect(screen.queryByText(/unable to load/i)).not.toBeInTheDocument();
  });

  it("adds a group and field locally, then persists both via one full-replace PUT", async () => {
    const handlers = setupHandlers([]);
    renderWithStore(<CategorySpecificationsPage />, { adminKey: "test-key" });
    await screen.findByRole("button", { name: "Save schema" });

    fireEvent.click(screen.getByRole("button", { name: "+ Add group" }));
    const groupNameInput = await screen.findByLabelText("Group name for New group 1");
    fireEvent.change(groupNameInput, { target: { value: "Display" } });
    fireEvent.blur(groupNameInput);

    fireEvent.click(screen.getByRole("button", { name: "+ Add field" }));
    const fieldNameInput = await screen.findByLabelText("Field name");
    fireEvent.change(fieldNameInput, { target: { value: "Screen Size" } });

    fireEvent.click(screen.getByRole("button", { name: "Save schema" }));

    await waitFor(() => {
      const body = handlers.getLastPutBody() as { specificationGroups: SpecificationGroup[] };
      expect(body.specificationGroups).toHaveLength(1);
      expect(body.specificationGroups[0]!.groupName).toBe("Display");
      expect(body.specificationGroups[0]!.specifications[0]!.name).toBe("Screen Size");
    });
  });

  it("renames a persisted group via PATCH renameGroup", async () => {
    const handlers = setupHandlers([{ groupName: "Display", specifications: [] }]);
    renderWithStore(<CategorySpecificationsPage />, { adminKey: "test-key" });

    const groupNameInput = await screen.findByLabelText("Group name for Display");
    fireEvent.change(groupNameInput, { target: { value: "Screen" } });
    fireEvent.blur(groupNameInput);

    await waitFor(() => {
      expect(handlers.getLastPatchBody()).toMatchObject({
        op: "renameGroup",
        groupName: "Display",
        newGroupName: "Screen",
      });
    });
    expect(await screen.findByLabelText("Group name for Screen")).toBeInTheDocument();
  });

  it("toggles filterable on a persisted field via PATCH updateField", async () => {
    const handlers = setupHandlers([
      {
        groupName: "Performance",
        specifications: [
          { name: "Battery Capacity", type: "number", unit: "mAh", required: false, filterable: false },
        ],
      },
    ]);
    renderWithStore(<CategorySpecificationsPage />, { adminKey: "test-key" });

    const checkbox = await screen.findByLabelText("Filterable: Battery Capacity");
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(handlers.getLastPatchBody()).toMatchObject({
        op: "updateField",
        groupName: "Performance",
        name: "Battery Capacity",
        field: { filterable: true },
      });
    });
    await waitFor(() => expect(checkbox).toBeChecked());
  });

  it("shows the in-use guard, naming the blocking count, when deleting a referenced field", async () => {
    setupHandlers(
      [
        {
          groupName: "Performance",
          specifications: [{ name: "RAM", type: "enum", options: ["8GB"], required: false, filterable: true }],
        },
      ],
      {
        patchError: {
          status: 409,
          code: "SPECIFICATION_FIELD_IN_USE",
          message: 'Cannot delete field "RAM": referenced by 36 product(s).',
        },
      },
    );
    renderWithStore(<CategorySpecificationsPage />, { adminKey: "test-key" });

    const nameInput = await screen.findByDisplayValue("RAM");
    const row = nameInput.closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: "Delete" }));

    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      'Cannot delete field "RAM": referenced by 36 product(s).',
    );
  });

  it("shows the in-use guard, naming every blocking field, when deleting a referenced group", async () => {
    setupHandlers(
      [
        {
          groupName: "Performance",
          specifications: [{ name: "RAM", type: "enum", options: ["8GB"], required: false, filterable: true }],
        },
      ],
      {
        patchError: {
          status: 409,
          code: "SPECIFICATION_FIELD_IN_USE",
          message: 'Cannot delete group "Performance": "RAM" referenced by 36 product(s).',
        },
      },
    );
    renderWithStore(<CategorySpecificationsPage />, { adminKey: "test-key" });

    await screen.findByDisplayValue("RAM");
    fireEvent.click(screen.getByRole("button", { name: "Delete group" }));

    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      'Cannot delete group "Performance": "RAM" referenced by 36 product(s).',
    );
  });
});
