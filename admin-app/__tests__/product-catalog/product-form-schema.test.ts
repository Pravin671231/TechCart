import { describe, expect, it } from "vitest";
import {
  buildProductFormSchema,
  type ProductFormValues,
} from "@/features/product-catalog/product-form/productFormSchema";
import { mockCategorySchema } from "@/features/product-catalog/product-form/mockCategorySchema";

const schema = buildProductFormSchema(mockCategorySchema);

function validFixture(): ProductFormValues {
  return {
    info: {
      name: "Aurora X12 Smartphone",
      sku: "TC-SP-0001",
      brand: "Brand A",
      category: mockCategorySchema.id,
      isFeatured: false,
      description: "A smartphone.",
    },
    media: {
      images: [{ id: "img-1", url: "", alt: "", isPrimary: true }],
    },
    pricing: { mrp: 49900, discount: 10, stock: 5, lowStockThreshold: 0 },
    specs: {
      "Screen Size": 6.1,
      Resolution: "",
      RAM: "4GB",
      Processor: "",
      "5G": false,
    },
    variants: { rows: [] },
    seo: { metaTitle: "", metaDescription: "" },
  };
}

describe("productFormSchema", () => {
  it("accepts a fully valid fixture", () => {
    const result = schema.safeParse(validFixture());
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const fixture = validFixture();
    fixture.info.name = "";
    const result = schema.safeParse(fixture);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message === "Name is required")).toBe(true);
    }
  });

  it("rejects mrp of 0", () => {
    const fixture = validFixture();
    fixture.pricing.mrp = 0;
    const result = schema.safeParse(fixture);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.message === "MRP must be greater than 0"),
      ).toBe(true);
    }
  });

  it("rejects a discount of 100 (out of the 0-99 range)", () => {
    const fixture = validFixture();
    fixture.pricing.discount = 100;
    const result = schema.safeParse(fixture);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message === "Discount must be 0-99")).toBe(
        true,
      );
    }
  });

  it("rejects negative stock", () => {
    const fixture = validFixture();
    fixture.pricing.stock = -1;
    const result = schema.safeParse(fixture);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.message === "Stock must be 0 or more"),
      ).toBe(true);
    }
  });

  it("rejects zero images", () => {
    const fixture = validFixture();
    fixture.media.images = [];
    const result = schema.safeParse(fixture);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.message === "At least 1 image is required"),
      ).toBe(true);
    }
  });

  it("rejects more than 8 images", () => {
    const fixture = validFixture();
    fixture.media.images = Array.from({ length: 9 }, (_, i) => ({
      id: `img-${i}`,
      url: "",
      alt: "",
      isPrimary: i === 0,
    }));
    const result = schema.safeParse(fixture);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.message === "At most 8 images allowed"),
      ).toBe(true);
    }
  });

  it("rejects images with no primary or more than one primary", () => {
    const noPrimary = validFixture();
    noPrimary.media.images = [{ id: "img-1", url: "", alt: "", isPrimary: false }];
    const noPrimaryResult = schema.safeParse(noPrimary);
    expect(noPrimaryResult.success).toBe(false);

    const twoPrimary = validFixture();
    twoPrimary.media.images = [
      { id: "img-1", url: "", alt: "", isPrimary: true },
      { id: "img-2", url: "", alt: "", isPrimary: true },
    ];
    const twoPrimaryResult = schema.safeParse(twoPrimary);
    expect(twoPrimaryResult.success).toBe(false);
  });

  it("rejects two variants sharing an identical attribute combination", () => {
    const fixture = validFixture();
    fixture.variants.rows = [
      {
        id: "v1",
        attributes: { Colour: "Black", Storage: "128GB" },
        sku: "TC-SP-0001-BLK-128",
        mrp: 49900,
        discount: 0,
        stock: 10,
        weight: undefined,
        active: true,
        images: [],
      },
      {
        id: "v2",
        attributes: { Colour: "Black", Storage: "128GB" },
        sku: "TC-SP-0001-BLK-128B",
        mrp: 49900,
        discount: 0,
        stock: 5,
        weight: undefined,
        active: true,
        images: [],
      },
    ];
    const result = schema.safeParse(fixture);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.message.includes("already exists on this product")),
      ).toBe(true);
    }
  });

  it("accepts two variants with different attribute combinations", () => {
    const fixture = validFixture();
    fixture.variants.rows = [
      {
        id: "v1",
        attributes: { Colour: "Black", Storage: "128GB" },
        sku: "TC-SP-0001-BLK-128",
        mrp: 49900,
        discount: 0,
        stock: 10,
        weight: undefined,
        active: true,
        images: [],
      },
      {
        id: "v2",
        attributes: { Colour: "Silver", Storage: "256GB" },
        sku: "TC-SP-0001-SLV-256",
        mrp: 54900,
        discount: 0,
        stock: 5,
        weight: undefined,
        active: true,
        images: [],
      },
    ];
    const result = schema.safeParse(fixture);
    expect(result.success).toBe(true);
  });
});
