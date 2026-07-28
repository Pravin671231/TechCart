import { describe, expect, it } from "vitest";
import { successResponse } from "../apiResponse";

describe("successResponse", () => {
  it("returns a detail shape with no pagination key", () => {
    const result = successResponse({ id: "1", name: "Widget" });

    expect(result).toEqual({ success: true, data: { id: "1", name: "Widget" } });
    expect("pagination" in result).toBe(false);
  });

  it("returns a list shape with pagination fully populated", () => {
    const pagination = { page: 1, limit: 24, total: 137, totalPages: 6, hasNextPage: true };
    const result = successResponse([{ id: "1" }, { id: "2" }], pagination);

    expect(result).toEqual({
      success: true,
      data: [{ id: "1" }, { id: "2" }],
      pagination,
    });
  });
});
