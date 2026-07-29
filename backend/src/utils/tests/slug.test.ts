import { describe, expect, it, vi } from "vitest";
import { generateUniqueSlug, slugify } from "../slug";

describe("slugify", () => {
  it("lowercases and hyphenates non-alphanumeric runs", () => {
    expect(slugify("Nova Electronics & Co.")).toBe("nova-electronics-co");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  --Nova--  ")).toBe("nova");
  });
});

describe("generateUniqueSlug", () => {
  it("returns the base slug when it doesn't exist yet", async () => {
    const slugExists = vi.fn().mockResolvedValue(false);

    const slug = await generateUniqueSlug("Nova", slugExists);

    expect(slug).toBe("nova");
    expect(slugExists).toHaveBeenCalledWith("nova");
  });

  it("appends -2 on the first collision", async () => {
    const slugExists = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const slug = await generateUniqueSlug("Nova", slugExists);

    expect(slug).toBe("nova-2");
  });

  it("keeps incrementing the suffix until a free slug is found", async () => {
    const slugExists = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const slug = await generateUniqueSlug("Nova", slugExists);

    expect(slug).toBe("nova-3");
  });
});
