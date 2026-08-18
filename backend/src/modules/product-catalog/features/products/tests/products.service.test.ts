import { Types } from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BrandRecord } from "@/modules/product-catalog/features/brands/brands.repository";
import type { CategoryRecord } from "@/modules/product-catalog/features/categories/categories.repository";
import type { ProductRecord } from "../products.repository";

vi.mock("../products.repository", () => ({
  create: vi.fn(),
  findById: vi.fn(),
  slugExists: vi.fn(),
  skuInUse: vi.fn(),
  updateById: vi.fn(),
  replaceVariants: vi.fn(),
  listPaginated: vi.fn(),
  findPublishedBySlug: vi.fn(),
  listPublicPaginated: vi.fn(),
  searchPublicPaginated: vi.fn(),
}));

vi.mock("@/modules/uploads/uploads.service", () => ({
  consumeImageKeys: vi.fn(),
  validateImageCount: vi.fn(),
  normalizeImages: vi.fn((images: { isPrimary?: boolean }[]) =>
    images.map((image, index) => ({ ...image, isPrimary: index === 0 })),
  ),
  buildPublicUrl: vi.fn((objectKey: string) => `https://cdn.test/${objectKey}`),
}));

vi.mock("@/modules/product-catalog/features/brands/brands.service", () => ({
  getBrandById: vi.fn(),
}));

vi.mock("@/modules/product-catalog/features/categories/categories.service", () => ({
  getCategoryById: vi.fn(),
  getActiveCategoryBySlug: vi.fn(),
  listActiveSubcategoryIds: vi.fn(),
}));

vi.mock(
  "@/modules/product-catalog/features/categorySpecifications/categorySpecifications.service",
  () => ({
    validateProductSpecifications: vi.fn(),
    getCardFieldsByCategoryIds: vi.fn().mockResolvedValue(new Map()),
    getFilterableFieldsByCategory: vi.fn().mockResolvedValue(new Map()),
  }),
);

import * as productsRepository from "../products.repository";
import * as uploadsService from "@/modules/uploads/uploads.service";
import * as brandsService from "@/modules/product-catalog/features/brands/brands.service";
import * as categoriesService from "@/modules/product-catalog/features/categories/categories.service";
import * as categorySpecificationsService from "@/modules/product-catalog/features/categorySpecifications/categorySpecifications.service";
import {
  createProduct,
  updateProduct,
  getProductById,
  listProductsForAdmin,
  deleteProduct,
  updateProductStatus,
  addVariant,
  updateVariant,
  listPublicProducts,
  listPublicProductsByCategorySlug,
  getPublicProductBySlug,
} from "../products.service";
import type { ProductVariant } from "../products.model";
import type { PublicProductDoc } from "../products.repository";

const productId = new Types.ObjectId();
const brandId = new Types.ObjectId();
const categoryId = new Types.ObjectId();
const otherCategoryId = new Types.ObjectId();
const variantId = new Types.ObjectId();
const otherVariantId = new Types.ObjectId();

const brandStub: BrandRecord = {
  _id: brandId,
  name: "Nova",
  slug: "nova",
  status: true,
  createdBy: null,
  updatedBy: null,
};

const categoryStub: CategoryRecord = {
  _id: categoryId,
  name: "Electronics",
  slug: "electronics",
  parentCategory: null,
  sortOrder: 0,
  status: true,
  createdBy: null,
  updatedBy: null,
};

// Issue #102: sku/images/mrp/discount/sellingPrice/stock/lowStockThreshold
// are gone from the product — every sellable, priced, imaged field lives
// only on a variant now.
const productStub: ProductRecord = {
  _id: productId,
  name: "Phone",
  slug: "phone",
  description: "A phone",
  brand: brandId,
  category: categoryId,
  specifications: [],
  variants: [],
  isFeatured: false,
  status: "draft",
  createdBy: null,
  updatedBy: null,
};

// images is required (1-2), not optional/empty-default, since #102 removed
// the parent product's own images fallback.
const existingVariant: ProductVariant = {
  _id: variantId,
  sku: "SKU-1-RED-L",
  attributes: [
    { name: "Color", value: "Red" },
    { name: "Size", value: "L" },
  ],
  images: [{ url: "https://cdn.test/product-image/red-l.png", isPrimary: true }],
  mrp: 51000,
  discount: 0,
  sellingPrice: 51000,
  active: true,
};

const otherExistingVariant: ProductVariant = {
  _id: otherVariantId,
  sku: "SKU-1-BLUE-M",
  attributes: [
    { name: "Color", value: "Blue" },
    { name: "Size", value: "M" },
  ],
  images: [{ url: "https://cdn.test/product-image/blue-m.png", isPrimary: true }],
  mrp: 51000,
  discount: 0,
  sellingPrice: 51000,
  active: true,
};

const productWithVariants: ProductRecord = {
  ...productStub,
  variants: [existingVariant, otherExistingVariant],
};

// No variants — the documented FR-CAT-102 edge case for buyer-facing mapper
// tests that specifically exercise the "nothing to show" path.
const publicProductStub: PublicProductDoc = {
  ...productStub,
  status: "published",
  brand: { _id: brandId, name: "Nova", slug: "nova" },
  category: { _id: categoryId, name: "Electronics", slug: "electronics" },
};

const publicVariantStub: ProductVariant = {
  _id: variantId,
  sku: "SKU-1-VARIANT",
  attributes: [{ name: "Color", value: "Red" }],
  images: [{ url: "https://cdn.test/product-image/a.png", isPrimary: true }],
  mrp: 50000,
  discount: 0,
  sellingPrice: 50000,
  active: true,
};

// Same as publicProductStub but with one active variant, for tests that
// exercise default-variant-sourced price/image mapping.
const publicProductWithVariantStub: PublicProductDoc = {
  ...publicProductStub,
  variants: [publicVariantStub],
};

const baseAddVariantInput = {
  sku: "SKU-1-GREEN-S",
  attributes: [
    { name: "Color", value: "Green" },
    { name: "Size", value: "S" },
  ],
  images: [{ objectKey: "product-image/variant.png" }],
  mrp: 51000,
  discount: 0,
};

const baseCreateInput = {
  name: "Phone",
  description: "A phone",
  brand: brandId,
  category: categoryId,
  specifications: [],
  isFeatured: false,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("createProduct", () => {
  it("validates the brand and category references before anything else", async () => {
    vi.mocked(brandsService.getBrandById).mockResolvedValue(brandStub);
    vi.mocked(categoriesService.getCategoryById).mockResolvedValue(categoryStub);
    vi.mocked(productsRepository.slugExists).mockResolvedValue(false);
    vi.mocked(productsRepository.create).mockResolvedValue(productStub);

    await createProduct(baseCreateInput);

    expect(brandsService.getBrandById).toHaveBeenCalledWith(brandId);
    expect(categoriesService.getCategoryById).toHaveBeenCalledWith(categoryId);
  });

  it("validates specifications against the category's schema", async () => {
    vi.mocked(brandsService.getBrandById).mockResolvedValue(brandStub);
    vi.mocked(categoriesService.getCategoryById).mockResolvedValue(categoryStub);
    vi.mocked(productsRepository.slugExists).mockResolvedValue(false);
    vi.mocked(productsRepository.create).mockResolvedValue(productStub);
    const specifications = [
      { groupName: "Display", values: [{ name: "Screen Size", value: 6.1 }] },
    ];

    await createProduct({ ...baseCreateInput, specifications });

    expect(categorySpecificationsService.validateProductSpecifications).toHaveBeenCalledWith(
      categoryId,
      specifications,
    );
  });

  it("propagates a specification validation failure without persisting", async () => {
    vi.mocked(brandsService.getBrandById).mockResolvedValue(brandStub);
    vi.mocked(categoriesService.getCategoryById).mockResolvedValue(categoryStub);
    vi.mocked(categorySpecificationsService.validateProductSpecifications).mockRejectedValueOnce(
      Object.assign(new Error("bad specs"), {
        statusCode: 400,
        code: "SPECIFICATION_VALIDATION_FAILED",
      }),
    );

    await expect(createProduct(baseCreateInput)).rejects.toMatchObject({
      code: "SPECIFICATION_VALIDATION_FAILED",
    });
    expect(productsRepository.create).not.toHaveBeenCalled();
  });

  it("generates a slug from the name, appending a suffix on collision", async () => {
    vi.mocked(brandsService.getBrandById).mockResolvedValue(brandStub);
    vi.mocked(categoriesService.getCategoryById).mockResolvedValue(categoryStub);
    vi.mocked(productsRepository.slugExists)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    vi.mocked(productsRepository.create).mockResolvedValue(productStub);

    await createProduct(baseCreateInput);

    expect(productsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "phone-2" }),
    );
  });

  it("creates a product with only metadata fields — no sku, images, price, or stock", async () => {
    vi.mocked(brandsService.getBrandById).mockResolvedValue(brandStub);
    vi.mocked(categoriesService.getCategoryById).mockResolvedValue(categoryStub);
    vi.mocked(productsRepository.slugExists).mockResolvedValue(false);
    vi.mocked(productsRepository.create).mockResolvedValue(productStub);

    await createProduct(baseCreateInput);

    const doc = vi.mocked(productsRepository.create).mock.calls[0]?.[0];
    for (const field of [
      "sku",
      "images",
      "mrp",
      "discount",
      "sellingPrice",
      "stock",
      "lowStockThreshold",
    ]) {
      expect(doc).not.toHaveProperty(field);
    }
    expect(uploadsService.validateImageCount).not.toHaveBeenCalled();
    expect(productsRepository.skuInUse).not.toHaveBeenCalled();
  });

  it("omits metaTitle/metaDescription when not provided", async () => {
    vi.mocked(brandsService.getBrandById).mockResolvedValue(brandStub);
    vi.mocked(categoriesService.getCategoryById).mockResolvedValue(categoryStub);
    vi.mocked(productsRepository.slugExists).mockResolvedValue(false);
    vi.mocked(productsRepository.create).mockResolvedValue(productStub);

    await createProduct(baseCreateInput);

    const doc = vi.mocked(productsRepository.create).mock.calls[0]?.[0];
    expect(doc).not.toHaveProperty("metaTitle");
    expect(doc).not.toHaveProperty("metaDescription");
  });
});

describe("updateProduct", () => {
  it("throws PRODUCT_NOT_FOUND when the product doesn't exist", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(null);

    await expect(updateProduct(productId, { name: "New" })).rejects.toMatchObject({
      statusCode: 404,
      code: "PRODUCT_NOT_FOUND",
    });
    expect(productsRepository.updateById).not.toHaveBeenCalled();
  });

  it("validates the new brand when brand is provided", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productStub);
    vi.mocked(productsRepository.updateById).mockResolvedValue(productStub);
    vi.mocked(brandsService.getBrandById).mockResolvedValue(brandStub);

    await updateProduct(productId, { brand: brandId });

    expect(brandsService.getBrandById).toHaveBeenCalledWith(brandId);
  });

  it("re-validates existing specifications against the new category when only category changes", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productStub);
    vi.mocked(productsRepository.updateById).mockResolvedValue(productStub);
    vi.mocked(categoriesService.getCategoryById).mockResolvedValue(categoryStub);

    await updateProduct(productId, { category: otherCategoryId });

    expect(categorySpecificationsService.validateProductSpecifications).toHaveBeenCalledWith(
      otherCategoryId,
      productStub.specifications,
    );
  });

  it("validates new specifications against the current category when only specifications change", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productStub);
    vi.mocked(productsRepository.updateById).mockResolvedValue(productStub);
    const specifications = [
      { groupName: "Display", values: [{ name: "Screen Size", value: 6.1 }] },
    ];

    await updateProduct(productId, { specifications });

    expect(categorySpecificationsService.validateProductSpecifications).toHaveBeenCalledWith(
      productStub.category,
      specifications,
    );
  });

  it("skips specification validation entirely when neither category nor specifications change", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productStub);
    vi.mocked(productsRepository.updateById).mockResolvedValue(productStub);

    await updateProduct(productId, { name: "New name" });

    expect(categorySpecificationsService.validateProductSpecifications).not.toHaveBeenCalled();
  });

  it("rejects, propagating the offending-fields error, when specs don't satisfy the new category", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productStub);
    vi.mocked(categoriesService.getCategoryById).mockResolvedValue(categoryStub);
    vi.mocked(categorySpecificationsService.validateProductSpecifications).mockRejectedValueOnce(
      Object.assign(new Error("bad specs"), {
        statusCode: 400,
        code: "SPECIFICATION_VALIDATION_FAILED",
      }),
    );

    await expect(updateProduct(productId, { category: otherCategoryId })).rejects.toMatchObject({
      code: "SPECIFICATION_VALIDATION_FAILED",
    });
    expect(productsRepository.updateById).not.toHaveBeenCalled();
  });

  it("throws PRODUCT_NOT_FOUND when the repository update itself finds nothing", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productStub);
    vi.mocked(productsRepository.updateById).mockResolvedValue(null);

    await expect(updateProduct(productId, { name: "New" })).rejects.toMatchObject({
      statusCode: 404,
      code: "PRODUCT_NOT_FOUND",
    });
  });
});

describe("getProductById", () => {
  it("returns the product when found", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productStub);

    const result = await getProductById(productId);

    expect(result).toEqual(productStub);
  });

  it("throws PRODUCT_NOT_FOUND when missing", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(null);

    await expect(getProductById(productId)).rejects.toMatchObject({
      statusCode: 404,
      code: "PRODUCT_NOT_FOUND",
    });
  });
});

describe("listProductsForAdmin", () => {
  it("computes pagination fields from the repository's total", async () => {
    vi.mocked(productsRepository.listPaginated).mockResolvedValue({
      items: [productStub],
      total: 45,
    });

    const result = await listProductsForAdmin({
      page: 2,
      limit: 20,
      sort: { field: "createdAt", order: -1 },
    });

    expect(result.pagination).toEqual({
      page: 2,
      limit: 20,
      total: 45,
      totalPages: 3,
      hasNextPage: true,
    });
  });

  it("passes the search term through to the repository", async () => {
    vi.mocked(productsRepository.listPaginated).mockResolvedValue({ items: [], total: 0 });

    await listProductsForAdmin({
      page: 1,
      limit: 20,
      sort: { field: "createdAt", order: -1 },
      search: "SKU-1",
    });

    expect(productsRepository.listPaginated).toHaveBeenCalledWith(
      { search: "SKU-1", status: undefined },
      { field: "createdAt", order: -1 },
      { page: 1, limit: 20 },
    );
  });

  it("passes the status filter through to the repository, composed with search", async () => {
    vi.mocked(productsRepository.listPaginated).mockResolvedValue({ items: [], total: 0 });

    await listProductsForAdmin({
      page: 1,
      limit: 20,
      sort: { field: "createdAt", order: -1 },
      search: "phone",
      status: "published",
    });

    expect(productsRepository.listPaginated).toHaveBeenCalledWith(
      { search: "phone", status: "published" },
      { field: "createdAt", order: -1 },
      { page: 1, limit: 20 },
    );
  });

  it("reports hasNextPage: false on the last page", async () => {
    vi.mocked(productsRepository.listPaginated).mockResolvedValue({ items: [], total: 20 });

    const result = await listProductsForAdmin({
      page: 1,
      limit: 20,
      sort: { field: "createdAt", order: -1 },
    });

    expect(result.pagination.hasNextPage).toBe(false);
  });
});

describe("updateProductStatus", () => {
  it("sets the requested status for a non-publish transition without checking variants", async () => {
    vi.mocked(productsRepository.updateById).mockResolvedValue({
      ...productStub,
      status: "archived",
    });

    await updateProductStatus(productId, "archived");

    expect(productsRepository.findById).not.toHaveBeenCalled();
    expect(productsRepository.updateById).toHaveBeenCalledWith(productId, { status: "archived" });
  });

  it("throws PRODUCT_NOT_FOUND when the id doesn't match any product", async () => {
    vi.mocked(productsRepository.updateById).mockResolvedValue(null);

    await expect(updateProductStatus(productId, "archived")).rejects.toMatchObject({
      statusCode: 404,
      code: "PRODUCT_NOT_FOUND",
    });
  });

  // FR-CAT-043 (#102): publishing requires at least one active variant, since
  // the product itself has no sku/price of its own to sell on anymore.
  it("publishes successfully when the product has an active variant", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productWithVariants);
    vi.mocked(productsRepository.updateById).mockResolvedValue({
      ...productWithVariants,
      status: "published",
    });

    await updateProductStatus(productId, "published");

    expect(productsRepository.updateById).toHaveBeenCalledWith(productId, {
      status: "published",
    });
  });

  it("rejects publishing with PRODUCT_HAS_NO_VARIANTS when the product has zero variants", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productStub);

    await expect(updateProductStatus(productId, "published")).rejects.toMatchObject({
      statusCode: 400,
      code: "PRODUCT_HAS_NO_VARIANTS",
    });
    expect(productsRepository.updateById).not.toHaveBeenCalled();
  });

  it("rejects publishing with PRODUCT_HAS_NO_VARIANTS when every variant is inactive", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue({
      ...productWithVariants,
      variants: [
        { ...existingVariant, active: false },
        { ...otherExistingVariant, active: false },
      ],
    });

    await expect(updateProductStatus(productId, "published")).rejects.toMatchObject({
      statusCode: 400,
      code: "PRODUCT_HAS_NO_VARIANTS",
    });
    expect(productsRepository.updateById).not.toHaveBeenCalled();
  });

  it("throws PRODUCT_NOT_FOUND when publishing an id that doesn't match any product", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(null);

    await expect(updateProductStatus(productId, "published")).rejects.toMatchObject({
      statusCode: 404,
      code: "PRODUCT_NOT_FOUND",
    });
  });
});

describe("deleteProduct", () => {
  it("soft-deletes by flipping status to archived", async () => {
    vi.mocked(productsRepository.updateById).mockResolvedValue(productStub);

    await deleteProduct(productId);

    expect(productsRepository.updateById).toHaveBeenCalledWith(productId, { status: "archived" });
  });

  it("throws PRODUCT_NOT_FOUND when the id doesn't match any product", async () => {
    vi.mocked(productsRepository.updateById).mockResolvedValue(null);

    await expect(deleteProduct(productId)).rejects.toMatchObject({
      statusCode: 404,
      code: "PRODUCT_NOT_FOUND",
    });
  });
});

describe("addVariant", () => {
  it("throws PRODUCT_NOT_FOUND when the product doesn't exist", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(null);

    await expect(addVariant(productId, baseAddVariantInput)).rejects.toMatchObject({
      statusCode: 404,
      code: "PRODUCT_NOT_FOUND",
    });
    expect(productsRepository.replaceVariants).not.toHaveBeenCalled();
  });

  it("rejects a sku matching an existing sibling variant's sku", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productWithVariants);

    await expect(
      addVariant(productId, { ...baseAddVariantInput, sku: existingVariant.sku }),
    ).rejects.toMatchObject({ statusCode: 400, code: "DUPLICATE_SKU" });
    expect(productsRepository.replaceVariants).not.toHaveBeenCalled();
  });

  it("rejects a sku already in use elsewhere, checked via skuInUse excluding this product", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productWithVariants);
    vi.mocked(productsRepository.skuInUse).mockResolvedValue(true);

    await expect(addVariant(productId, baseAddVariantInput)).rejects.toMatchObject({
      statusCode: 400,
      code: "DUPLICATE_SKU",
    });
    expect(productsRepository.skuInUse).toHaveBeenCalledWith(baseAddVariantInput.sku, productId);
    expect(productsRepository.replaceVariants).not.toHaveBeenCalled();
  });

  it("rejects an attribute combination that duplicates an existing variant's, regardless of pair order", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productWithVariants);
    vi.mocked(productsRepository.skuInUse).mockResolvedValue(false);

    await expect(
      addVariant(productId, {
        ...baseAddVariantInput,
        sku: "SKU-1-UNIQUE",
        // Same pairs as existingVariant, reversed order.
        attributes: [
          { name: "Size", value: "L" },
          { name: "Color", value: "Red" },
        ],
      }),
    ).rejects.toMatchObject({ statusCode: 400, code: "DUPLICATE_VARIANT_ATTRIBUTES" });
    expect(productsRepository.replaceVariants).not.toHaveBeenCalled();
  });

  it("adds the variant, active by default, with a server-computed sellingPrice", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productWithVariants);
    vi.mocked(productsRepository.skuInUse).mockResolvedValue(false);
    vi.mocked(productsRepository.replaceVariants).mockResolvedValue(productWithVariants);

    await addVariant(productId, { ...baseAddVariantInput, mrp: 60000, discount: 10 });

    const persisted = vi.mocked(productsRepository.replaceVariants).mock.calls[0]?.[1];
    expect(persisted).toHaveLength(3);
    const added = persisted?.[2];
    expect(added).toMatchObject({
      sku: "SKU-1-GREEN-S",
      active: true,
      mrp: 60000,
      discount: 10,
      sellingPrice: 54000,
    });
    expect(added).not.toHaveProperty("stock");
    expect(added?._id).toBeDefined();
  });

  it("omits weight when not provided and includes it when provided", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productWithVariants);
    vi.mocked(productsRepository.skuInUse).mockResolvedValue(false);
    vi.mocked(productsRepository.replaceVariants).mockResolvedValue(productWithVariants);

    await addVariant(productId, baseAddVariantInput);
    let added = vi.mocked(productsRepository.replaceVariants).mock.calls[0]?.[1]?.[2];
    expect(added).not.toHaveProperty("weight");

    await addVariant(productId, { ...baseAddVariantInput, sku: "SKU-1-OTHER", weight: 1.5 });
    added = vi.mocked(productsRepository.replaceVariants).mock.calls[1]?.[1]?.[2];
    expect(added).toHaveProperty("weight", 1.5);
  });

  // #102: images are required, 1-2 — there's no more "skip validation when
  // empty" short-circuit, since a variant's images are the only images
  // anywhere on the product now.
  it("always validates image count and consumes keys, for every variant", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productWithVariants);
    vi.mocked(productsRepository.skuInUse).mockResolvedValue(false);
    vi.mocked(productsRepository.replaceVariants).mockResolvedValue(productWithVariants);

    await addVariant(productId, baseAddVariantInput);

    expect(uploadsService.validateImageCount).toHaveBeenCalledWith(baseAddVariantInput.images, {
      min: 1,
      max: 2,
    });
    expect(uploadsService.consumeImageKeys).toHaveBeenCalledWith(["product-image/variant.png"]);
  });
});

describe("updateVariant", () => {
  it("throws PRODUCT_NOT_FOUND when the product doesn't exist", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(null);

    await expect(updateVariant(productId, variantId, { weight: 1.5 })).rejects.toMatchObject({
      statusCode: 404,
      code: "PRODUCT_NOT_FOUND",
    });
  });

  it("throws VARIANT_NOT_FOUND when the variantId doesn't match any variant on this product", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productWithVariants);

    await expect(
      updateVariant(productId, new Types.ObjectId(), { weight: 1.5 }),
    ).rejects.toMatchObject({ statusCode: 404, code: "VARIANT_NOT_FOUND" });
    expect(productsRepository.replaceVariants).not.toHaveBeenCalled();
  });

  it("deactivates a variant via active: false without touching its other fields", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productWithVariants);
    vi.mocked(productsRepository.replaceVariants).mockResolvedValue(productWithVariants);

    await updateVariant(productId, variantId, { active: false });

    const persisted = vi.mocked(productsRepository.replaceVariants).mock.calls[0]?.[1];
    expect(persisted).toHaveLength(2);
    expect(persisted?.[0]).toMatchObject({ ...existingVariant, active: false });
    // Never removed — the array length is unchanged, matching FR-CAT-040's
    // "variants are never hard-removed" rule.
    expect(persisted?.[1]).toEqual(otherExistingVariant);
  });

  it("does not re-check sku uniqueness when sku is resubmitted unchanged", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productWithVariants);
    vi.mocked(productsRepository.replaceVariants).mockResolvedValue(productWithVariants);

    await updateVariant(productId, variantId, { sku: existingVariant.sku, weight: 2 });

    expect(productsRepository.skuInUse).not.toHaveBeenCalled();
  });

  it("rejects recoding sku to collide with a sibling variant", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productWithVariants);

    await expect(
      updateVariant(productId, variantId, { sku: otherExistingVariant.sku }),
    ).rejects.toMatchObject({ statusCode: 400, code: "DUPLICATE_SKU" });
    expect(productsRepository.replaceVariants).not.toHaveBeenCalled();
  });

  it("accepts a new, globally-unique sku", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productWithVariants);
    vi.mocked(productsRepository.skuInUse).mockResolvedValue(false);
    vi.mocked(productsRepository.replaceVariants).mockResolvedValue(productWithVariants);

    await updateVariant(productId, variantId, { sku: "SKU-1-RECODED" });

    expect(productsRepository.skuInUse).toHaveBeenCalledWith("SKU-1-RECODED", productId);
    const persisted = vi.mocked(productsRepository.replaceVariants).mock.calls[0]?.[1];
    expect(persisted?.[0]).toMatchObject({ sku: "SKU-1-RECODED" });
  });

  it("rejects attributes duplicating a sibling variant's set", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productWithVariants);

    await expect(
      updateVariant(productId, variantId, { attributes: otherExistingVariant.attributes }),
    ).rejects.toMatchObject({ statusCode: 400, code: "DUPLICATE_VARIANT_ATTRIBUTES" });
    expect(productsRepository.replaceVariants).not.toHaveBeenCalled();
  });

  it("recomputes sellingPrice from the new mrp and the existing discount when only mrp changes", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productWithVariants);
    vi.mocked(productsRepository.replaceVariants).mockResolvedValue(productWithVariants);

    await updateVariant(productId, variantId, { mrp: 60000 });

    const persisted = vi.mocked(productsRepository.replaceVariants).mock.calls[0]?.[1];
    expect(persisted?.[0]).toMatchObject({
      mrp: 60000,
      discount: existingVariant.discount,
      sellingPrice: 60000,
    });
  });

  it("does not touch pricing fields when neither mrp nor discount changes", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productWithVariants);
    vi.mocked(productsRepository.replaceVariants).mockResolvedValue(productWithVariants);

    await updateVariant(productId, variantId, { weight: 2 });

    const persisted = vi.mocked(productsRepository.replaceVariants).mock.calls[0]?.[1];
    expect(persisted?.[0]).toMatchObject({
      mrp: existingVariant.mrp,
      discount: existingVariant.discount,
      sellingPrice: existingVariant.sellingPrice,
      weight: 2,
    });
  });

  it("throws PRODUCT_NOT_FOUND when the repository update itself finds nothing", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productWithVariants);
    vi.mocked(productsRepository.replaceVariants).mockResolvedValue(null);

    await expect(updateVariant(productId, variantId, { weight: 1 })).rejects.toMatchObject({
      statusCode: 404,
      code: "PRODUCT_NOT_FOUND",
    });
  });
});

describe("listPublicProducts", () => {
  it("uses listPublicPaginated when q is absent", async () => {
    vi.mocked(productsRepository.listPublicPaginated).mockResolvedValue({
      items: [publicProductStub],
      total: 1,
    });

    await listPublicProducts({ page: 1, limit: 24 });

    expect(productsRepository.listPublicPaginated).toHaveBeenCalledWith({}, "newest", {
      page: 1,
      limit: 24,
    });
    expect(productsRepository.searchPublicPaginated).not.toHaveBeenCalled();
  });

  it("uses searchPublicPaginated when q is present", async () => {
    vi.mocked(productsRepository.searchPublicPaginated).mockResolvedValue({
      items: [publicProductStub],
      total: 1,
    });

    await listPublicProducts({ page: 1, limit: 24, q: "phone" });

    expect(productsRepository.searchPublicPaginated).toHaveBeenCalledWith(
      "phone",
      {},
      "relevance",
      { page: 1, limit: 24 },
    );
    expect(productsRepository.listPublicPaginated).not.toHaveBeenCalled();
  });

  it("computes pagination from the repository's total", async () => {
    vi.mocked(productsRepository.listPublicPaginated).mockResolvedValue({
      items: [],
      total: 50,
    });

    const result = await listPublicProducts({ page: 2, limit: 24 });

    expect(result.pagination).toEqual({
      page: 2,
      limit: 24,
      total: 50,
      totalPages: 3,
      hasNextPage: true,
    });
  });

  it("maps each item to the public shape, sourcing price/image from the default variant", async () => {
    vi.mocked(productsRepository.listPublicPaginated).mockResolvedValue({
      items: [publicProductWithVariantStub],
      total: 1,
    });

    const result = await listPublicProducts({ page: 1, limit: 24 });

    expect(result.items[0]).toMatchObject({
      _id: productId,
      name: "Phone",
      slug: "phone",
      brand: { _id: brandId, name: "Nova", slug: "nova" },
      primaryImage: { url: "https://cdn.test/product-image/a.png" },
      mrp: 50000,
      discount: 0,
      sellingPrice: 50000,
      isFeatured: false,
    });
    for (const field of ["status", "createdBy", "updatedBy"]) {
      expect(result.items[0]).not.toHaveProperty(field);
    }
  });

  it("omits price/image fields when the product has no active variant (FR-CAT-102 edge case)", async () => {
    vi.mocked(productsRepository.listPublicPaginated).mockResolvedValue({
      items: [publicProductStub],
      total: 1,
    });

    const result = await listPublicProducts({ page: 1, limit: 24 });

    expect(result.items[0]?.mrp).toBeUndefined();
    expect(result.items[0]?.discount).toBeUndefined();
    expect(result.items[0]?.sellingPrice).toBeUndefined();
    expect(result.items[0]?.primaryImage).toBeUndefined();
  });

  it("passes price/brand/on-sale filters and an explicit sort through to the repository", async () => {
    vi.mocked(productsRepository.listPublicPaginated).mockResolvedValue({ items: [], total: 0 });
    const otherBrandId = new Types.ObjectId();

    await listPublicProducts({
      page: 1,
      limit: 24,
      brandIds: [brandId, otherBrandId],
      minPrice: 1000,
      maxPrice: 5000,
      onSaleOnly: true,
      sort: "price_desc",
    });

    expect(productsRepository.listPublicPaginated).toHaveBeenCalledWith(
      {
        brandIds: [brandId, otherBrandId],
        minPrice: 1000,
        maxPrice: 5000,
        onSaleOnly: true,
      },
      "price_desc",
      { page: 1, limit: 24 },
    );
  });

  it("resolves categorySlug (FR-CAT-070's flat-listing category filter) the same way the nested route does", async () => {
    const subcategoryId = new Types.ObjectId();
    vi.mocked(categoriesService.getActiveCategoryBySlug).mockResolvedValue(categoryStub);
    vi.mocked(categoriesService.listActiveSubcategoryIds).mockResolvedValue([subcategoryId]);
    vi.mocked(productsRepository.listPublicPaginated).mockResolvedValue({ items: [], total: 0 });

    await listPublicProducts({ page: 1, limit: 24, categorySlug: "electronics" });

    expect(categoriesService.getActiveCategoryBySlug).toHaveBeenCalledWith("electronics");
    expect(productsRepository.listPublicPaginated).toHaveBeenCalledWith(
      { categoryIds: [categoryId, subcategoryId] },
      "newest",
      { page: 1, limit: 24 },
    );
  });

  it("routes a variant-attribute filter through Atlas Search even with no q", async () => {
    vi.mocked(productsRepository.searchPublicPaginated).mockResolvedValue({ items: [], total: 0 });

    await listPublicProducts({
      page: 1,
      limit: 24,
      variantAttribute: { name: "Color", value: "Red" },
    });

    expect(productsRepository.searchPublicPaginated).toHaveBeenCalledWith(
      undefined,
      { variantAttribute: { name: "Color", value: "Red" } },
      "newest",
      { page: 1, limit: 24 },
    );
    expect(productsRepository.listPublicPaginated).not.toHaveBeenCalled();
  });

  it("routes a specification filter through Atlas Search even with no q, once validated against the category", async () => {
    vi.mocked(categoriesService.getActiveCategoryBySlug).mockResolvedValue(categoryStub);
    vi.mocked(categoriesService.listActiveSubcategoryIds).mockResolvedValue([]);
    vi.mocked(categorySpecificationsService.getFilterableFieldsByCategory).mockResolvedValue(
      new Map([
        ["RAM", { name: "RAM", type: "enum", options: ["8GB"], required: false, filterable: true }],
      ]),
    );
    vi.mocked(productsRepository.searchPublicPaginated).mockResolvedValue({ items: [], total: 0 });

    await listPublicProducts({
      page: 1,
      limit: 24,
      categorySlug: "electronics",
      specFilters: [{ name: "RAM", kind: "value", value: "8GB" }],
    });

    expect(productsRepository.searchPublicPaginated).toHaveBeenCalledWith(
      undefined,
      {
        categoryIds: [categoryId],
        specFilters: [{ name: "RAM", kind: "value", value: "8GB" }],
      },
      "newest",
      { page: 1, limit: 24 },
    );
  });

  it("rejects a specification filter on a field that isn't filterable for the resolved category", async () => {
    vi.mocked(categoriesService.getActiveCategoryBySlug).mockResolvedValue(categoryStub);
    vi.mocked(categoriesService.listActiveSubcategoryIds).mockResolvedValue([]);
    vi.mocked(categorySpecificationsService.getFilterableFieldsByCategory).mockResolvedValue(
      new Map(),
    );

    await expect(
      listPublicProducts({
        page: 1,
        limit: 24,
        categorySlug: "electronics",
        specFilters: [{ name: "NotFilterable", kind: "value", value: "x" }],
      }),
    ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_SPECIFICATION_FILTER" });
    expect(productsRepository.searchPublicPaginated).not.toHaveBeenCalled();
  });

  it("rejects a range filter submitted against a non-number filterable field", async () => {
    vi.mocked(categoriesService.getActiveCategoryBySlug).mockResolvedValue(categoryStub);
    vi.mocked(categoriesService.listActiveSubcategoryIds).mockResolvedValue([]);
    vi.mocked(categorySpecificationsService.getFilterableFieldsByCategory).mockResolvedValue(
      new Map([
        ["RAM", { name: "RAM", type: "enum", options: ["8GB"], required: false, filterable: true }],
      ]),
    );

    await expect(
      listPublicProducts({
        page: 1,
        limit: 24,
        categorySlug: "electronics",
        specFilters: [{ name: "RAM", kind: "range", min: 1 }],
      }),
    ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_SPECIFICATION_FILTER" });
  });

  it("does not validate spec filters against any schema on an unscoped (no category) listing", async () => {
    vi.mocked(productsRepository.searchPublicPaginated).mockResolvedValue({ items: [], total: 0 });

    await listPublicProducts({
      page: 1,
      limit: 24,
      specFilters: [{ name: "Anything", kind: "value", value: "x" }],
    });

    expect(categorySpecificationsService.getFilterableFieldsByCategory).not.toHaveBeenCalled();
    expect(productsRepository.searchPublicPaginated).toHaveBeenCalledWith(
      undefined,
      { specFilters: [{ name: "Anything", kind: "value", value: "x" }] },
      "newest",
      { page: 1, limit: 24 },
    );
  });

  it("computes cardSpecifications from the product's own category's filterable fields", async () => {
    vi.mocked(productsRepository.listPublicPaginated).mockResolvedValue({
      items: [
        {
          ...publicProductStub,
          specifications: [{ groupName: "Display", values: [{ name: "Screen Size", value: 6.1 }] }],
        },
      ],
      total: 1,
    });
    vi.mocked(categorySpecificationsService.getCardFieldsByCategoryIds).mockResolvedValue(
      new Map([[categoryId.toString(), [{ name: "Screen Size", unit: "inch" }]]]),
    );

    const result = await listPublicProducts({ page: 1, limit: 24 });

    expect(result.items[0]?.cardSpecifications).toEqual([
      { name: "Screen Size", value: 6.1, unit: "inch" },
    ]);
    expect(categorySpecificationsService.getCardFieldsByCategoryIds).toHaveBeenCalledWith([
      categoryId,
    ]);
  });

  it("skips a card field the product has no stored value for, rather than padding with null", async () => {
    vi.mocked(productsRepository.listPublicPaginated).mockResolvedValue({
      items: [{ ...publicProductStub, specifications: [] }],
      total: 1,
    });
    vi.mocked(categorySpecificationsService.getCardFieldsByCategoryIds).mockResolvedValue(
      new Map([[categoryId.toString(), [{ name: "Screen Size", unit: "inch" }]]]),
    );

    const result = await listPublicProducts({ page: 1, limit: 24 });

    expect(result.items[0]?.cardSpecifications).toEqual([]);
  });

  it("defaults unit to null when the filterable field has none", async () => {
    vi.mocked(productsRepository.listPublicPaginated).mockResolvedValue({
      items: [
        {
          ...publicProductStub,
          specifications: [{ groupName: "G", values: [{ name: "RAM", value: "8GB" }] }],
        },
      ],
      total: 1,
    });
    vi.mocked(categorySpecificationsService.getCardFieldsByCategoryIds).mockResolvedValue(
      new Map([[categoryId.toString(), [{ name: "RAM" }]]]),
    );

    const result = await listPublicProducts({ page: 1, limit: 24 });

    expect(result.items[0]?.cardSpecifications).toEqual([
      { name: "RAM", value: "8GB", unit: null },
    ]);
  });
});

describe("listPublicProductsByCategorySlug", () => {
  it("scopes the listing to the category and its active subcategories", async () => {
    const subcategoryId = new Types.ObjectId();
    vi.mocked(categoriesService.getActiveCategoryBySlug).mockResolvedValue(categoryStub);
    vi.mocked(categoriesService.listActiveSubcategoryIds).mockResolvedValue([subcategoryId]);
    vi.mocked(productsRepository.listPublicPaginated).mockResolvedValue({ items: [], total: 0 });

    await listPublicProductsByCategorySlug("electronics", { page: 1, limit: 24 });

    expect(categoriesService.getActiveCategoryBySlug).toHaveBeenCalledWith("electronics");
    expect(productsRepository.listPublicPaginated).toHaveBeenCalledWith(
      { categoryIds: [categoryId, subcategoryId] },
      "newest",
      { page: 1, limit: 24 },
    );
  });

  it("propagates CATEGORY_NOT_FOUND when the slug doesn't resolve to an active category", async () => {
    vi.mocked(categoriesService.getActiveCategoryBySlug).mockRejectedValueOnce(
      Object.assign(new Error("not found"), { statusCode: 404, code: "CATEGORY_NOT_FOUND" }),
    );

    await expect(
      listPublicProductsByCategorySlug("missing", { page: 1, limit: 24 }),
    ).rejects.toMatchObject({ statusCode: 404, code: "CATEGORY_NOT_FOUND" });
    expect(productsRepository.listPublicPaginated).not.toHaveBeenCalled();
  });

  it("composes brand/price/on-sale/sort with the category scope, same as the flat listing", async () => {
    vi.mocked(categoriesService.getActiveCategoryBySlug).mockResolvedValue(categoryStub);
    vi.mocked(categoriesService.listActiveSubcategoryIds).mockResolvedValue([]);
    vi.mocked(productsRepository.listPublicPaginated).mockResolvedValue({ items: [], total: 0 });

    await listPublicProductsByCategorySlug("electronics", {
      page: 1,
      limit: 24,
      brandIds: [brandId],
      minPrice: 1000,
      onSaleOnly: true,
      sort: "price_asc",
    });

    expect(productsRepository.listPublicPaginated).toHaveBeenCalledWith(
      {
        categoryIds: [categoryId],
        brandIds: [brandId],
        minPrice: 1000,
        onSaleOnly: true,
      },
      "price_asc",
      { page: 1, limit: 24 },
    );
  });
});

describe("getPublicProductBySlug", () => {
  it("throws PRODUCT_NOT_FOUND when the slug doesn't match a published product", async () => {
    vi.mocked(productsRepository.findPublishedBySlug).mockResolvedValue(null);

    await expect(getPublicProductBySlug("missing")).rejects.toMatchObject({
      statusCode: 404,
      code: "PRODUCT_NOT_FOUND",
    });
  });

  it("returns the detail shape, stripping every admin-only field", async () => {
    vi.mocked(productsRepository.findPublishedBySlug).mockResolvedValue(publicProductStub);

    const result = await getPublicProductBySlug("phone");

    expect(result).toMatchObject({
      _id: productId,
      name: "Phone",
      slug: "phone",
      description: "A phone",
      brand: { _id: brandId, name: "Nova", slug: "nova" },
      category: { _id: categoryId, name: "Electronics", slug: "electronics" },
      hasVariants: false,
      variants: [],
    });
    for (const field of ["status", "createdBy", "updatedBy"]) {
      expect(result).not.toHaveProperty(field);
    }
  });

  it("omits price fields and defaultVariantId when there is no active variant (FR-CAT-102 edge case)", async () => {
    vi.mocked(productsRepository.findPublishedBySlug).mockResolvedValue(publicProductStub);

    const result = await getPublicProductBySlug("phone");

    expect(result.mrp).toBeUndefined();
    expect(result.discount).toBeUndefined();
    expect(result.sellingPrice).toBeUndefined();
    expect(result.defaultVariantId).toBeUndefined();
  });

  it("defaults to the lowest-sellingPrice active variant, excluding inactive ones", async () => {
    const cheaperVariant: ProductVariant = {
      ...existingVariant,
      sellingPrice: 40000,
      active: true,
    };
    const pricierVariant: ProductVariant = {
      ...otherExistingVariant,
      sellingPrice: 60000,
      active: true,
    };
    const inactiveCheapest: ProductVariant = {
      ...existingVariant,
      _id: new Types.ObjectId(),
      sku: "SKU-1-INACTIVE",
      sellingPrice: 10000,
      active: false,
    };
    vi.mocked(productsRepository.findPublishedBySlug).mockResolvedValue({
      ...publicProductStub,
      variants: [pricierVariant, cheaperVariant, inactiveCheapest],
    });

    const result = await getPublicProductBySlug("phone");

    expect(result.hasVariants).toBe(true);
    expect(result.defaultVariantId).toEqual(cheaperVariant._id);
    expect(result.sellingPrice).toBe(40000);
    expect(result.variants).toHaveLength(2);
    expect(result.variants.map((v) => v.sku)).not.toContain(inactiveCheapest.sku);
  });

  // #102: no parent-images fallback exists anymore — a variant's own images
  // pass through unchanged, since they're always required (1-2).
  it("passes each variant's own images through unchanged", async () => {
    vi.mocked(productsRepository.findPublishedBySlug).mockResolvedValue({
      ...publicProductStub,
      variants: [existingVariant],
    });

    const result = await getPublicProductBySlug("phone");

    expect(result.variants[0]?.images).toEqual([
      { url: "https://cdn.test/product-image/red-l.png" },
    ]);
  });

  it("falls back metaTitle to name and metaDescription to a truncation of description when unset", async () => {
    vi.mocked(productsRepository.findPublishedBySlug).mockResolvedValue({
      ...publicProductStub,
      description: "a".repeat(200),
    });

    const result = await getPublicProductBySlug("phone");

    expect(result.metaTitle).toBe("Phone");
    expect(result.metaDescription).toBe(`${"a".repeat(160)}...`);
  });

  it("includes every specification group regardless of filterable", async () => {
    const specifications = [
      { groupName: "Display", values: [{ name: "Screen Size", value: 6.1 }] },
    ];
    vi.mocked(productsRepository.findPublishedBySlug).mockResolvedValue({
      ...publicProductStub,
      specifications,
    });

    const result = await getPublicProductBySlug("phone");

    expect(result.specifications).toEqual(specifications);
  });
});
