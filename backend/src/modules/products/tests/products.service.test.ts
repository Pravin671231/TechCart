import { Types } from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BrandRecord } from "@/modules/brands/brands.repository";
import type { CategoryRecord } from "@/modules/categories/categories.repository";
import type { ProductRecord } from "../products.repository";

vi.mock("../products.repository", () => ({
  create: vi.fn(),
  findById: vi.fn(),
  slugExists: vi.fn(),
  skuInUse: vi.fn(),
  updateById: vi.fn(),
  replaceVariants: vi.fn(),
  listPaginated: vi.fn(),
}));

vi.mock("@/modules/uploads/uploads.service", () => ({
  consumeImageKeys: vi.fn(),
  validateImageCount: vi.fn(),
  normalizeImages: vi.fn((images: { isPrimary?: boolean }[]) =>
    images.map((image, index) => ({ ...image, isPrimary: index === 0 })),
  ),
  buildPublicUrl: vi.fn((objectKey: string) => `https://cdn.test/${objectKey}`),
}));

vi.mock("@/modules/brands/brands.service", () => ({
  getBrandById: vi.fn(),
}));

vi.mock("@/modules/categories/categories.service", () => ({
  getCategoryById: vi.fn(),
}));

vi.mock("@/modules/categorySpecifications/categorySpecifications.service", () => ({
  validateProductSpecifications: vi.fn(),
}));

import * as productsRepository from "../products.repository";
import * as uploadsService from "@/modules/uploads/uploads.service";
import * as brandsService from "@/modules/brands/brands.service";
import * as categoriesService from "@/modules/categories/categories.service";
import * as categorySpecificationsService from "@/modules/categorySpecifications/categorySpecifications.service";
import {
  createProduct,
  updateProduct,
  getProductById,
  listProductsForAdmin,
  deleteProduct,
  updateStock,
  updateProductStatus,
  addVariant,
  updateVariant,
} from "../products.service";
import type { ProductVariant } from "../products.model";

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

const productStub: ProductRecord = {
  _id: productId,
  name: "Phone",
  slug: "phone",
  sku: "SKU-1",
  description: "A phone",
  brand: brandId,
  category: categoryId,
  images: [{ url: "https://cdn.test/product-image/a.png", isPrimary: true }],
  specifications: [],
  variants: [],
  mrp: 50000,
  discount: 0,
  sellingPrice: 50000,
  stock: 10,
  lowStockThreshold: 0,
  isFeatured: false,
  status: "draft",
  createdBy: null,
  updatedBy: null,
};

const existingVariant: ProductVariant = {
  _id: variantId,
  sku: "SKU-1-RED-L",
  attributes: [
    { name: "Color", value: "Red" },
    { name: "Size", value: "L" },
  ],
  images: [],
  mrp: 51000,
  discount: 0,
  sellingPrice: 51000,
  stock: 5,
  active: true,
};

const otherExistingVariant: ProductVariant = {
  _id: otherVariantId,
  sku: "SKU-1-BLUE-M",
  attributes: [
    { name: "Color", value: "Blue" },
    { name: "Size", value: "M" },
  ],
  images: [],
  mrp: 51000,
  discount: 0,
  sellingPrice: 51000,
  stock: 3,
  active: true,
};

const productWithVariants: ProductRecord = {
  ...productStub,
  variants: [existingVariant, otherExistingVariant],
};

const baseAddVariantInput = {
  sku: "SKU-1-GREEN-S",
  attributes: [
    { name: "Color", value: "Green" },
    { name: "Size", value: "S" },
  ],
  images: [] as { objectKey: string }[],
  mrp: 51000,
  discount: 0,
  stock: 4,
};

const baseCreateInput = {
  name: "Phone",
  description: "A phone",
  sku: "SKU-1",
  brand: brandId,
  category: categoryId,
  images: [{ objectKey: "product-image/a.png" }],
  specifications: [],
  mrp: 99900,
  discount: 10,
  stock: 10,
  lowStockThreshold: 0,
  isFeatured: false,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("createProduct", () => {
  it("validates the brand and category references before anything else", async () => {
    vi.mocked(brandsService.getBrandById).mockResolvedValue(brandStub);
    vi.mocked(categoriesService.getCategoryById).mockResolvedValue(categoryStub);
    vi.mocked(productsRepository.skuInUse).mockResolvedValue(false);
    vi.mocked(productsRepository.slugExists).mockResolvedValue(false);
    vi.mocked(productsRepository.create).mockResolvedValue(productStub);

    await createProduct(baseCreateInput);

    expect(brandsService.getBrandById).toHaveBeenCalledWith(brandId);
    expect(categoriesService.getCategoryById).toHaveBeenCalledWith(categoryId);
  });

  it("rejects a duplicate SKU without persisting", async () => {
    vi.mocked(brandsService.getBrandById).mockResolvedValue(brandStub);
    vi.mocked(categoriesService.getCategoryById).mockResolvedValue(categoryStub);
    vi.mocked(productsRepository.skuInUse).mockResolvedValue(true);

    await expect(createProduct(baseCreateInput)).rejects.toMatchObject({
      statusCode: 400,
      code: "DUPLICATE_SKU",
    });
    expect(productsRepository.create).not.toHaveBeenCalled();
  });

  it("validates specifications against the category's schema", async () => {
    vi.mocked(brandsService.getBrandById).mockResolvedValue(brandStub);
    vi.mocked(categoriesService.getCategoryById).mockResolvedValue(categoryStub);
    vi.mocked(productsRepository.skuInUse).mockResolvedValue(false);
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
    vi.mocked(productsRepository.skuInUse).mockResolvedValue(false);
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
    vi.mocked(productsRepository.skuInUse).mockResolvedValue(false);
    vi.mocked(productsRepository.slugExists)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    vi.mocked(productsRepository.create).mockResolvedValue(productStub);

    await createProduct(baseCreateInput);

    expect(productsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "phone-2" }),
    );
  });

  it("validates image count, consumes keys, and normalizes the resolved images", async () => {
    vi.mocked(brandsService.getBrandById).mockResolvedValue(brandStub);
    vi.mocked(categoriesService.getCategoryById).mockResolvedValue(categoryStub);
    vi.mocked(productsRepository.skuInUse).mockResolvedValue(false);
    vi.mocked(productsRepository.slugExists).mockResolvedValue(false);
    vi.mocked(productsRepository.create).mockResolvedValue(productStub);
    const images = [{ objectKey: "product-image/a.png" }, { objectKey: "product-image/b.png" }];

    await createProduct({ ...baseCreateInput, images });

    expect(uploadsService.validateImageCount).toHaveBeenCalledWith(images, { min: 1, max: 8 });
    expect(uploadsService.consumeImageKeys).toHaveBeenCalledWith([
      "product-image/a.png",
      "product-image/b.png",
    ]);
    expect(productsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        images: [
          { url: "https://cdn.test/product-image/a.png", isPrimary: true },
          { url: "https://cdn.test/product-image/b.png", isPrimary: false },
        ],
      }),
    );
  });

  it("computes sellingPrice server-side from mrp and discount", async () => {
    vi.mocked(brandsService.getBrandById).mockResolvedValue(brandStub);
    vi.mocked(categoriesService.getCategoryById).mockResolvedValue(categoryStub);
    vi.mocked(productsRepository.skuInUse).mockResolvedValue(false);
    vi.mocked(productsRepository.slugExists).mockResolvedValue(false);
    vi.mocked(productsRepository.create).mockResolvedValue(productStub);

    await createProduct({ ...baseCreateInput, mrp: 99900, discount: 10 });

    expect(productsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ sellingPrice: 89910 }),
    );
  });

  it("omits metaTitle/metaDescription when not provided", async () => {
    vi.mocked(brandsService.getBrandById).mockResolvedValue(brandStub);
    vi.mocked(categoriesService.getCategoryById).mockResolvedValue(categoryStub);
    vi.mocked(productsRepository.skuInUse).mockResolvedValue(false);
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

  it("never includes sku in the patch — sku is immutable after create", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productStub);
    vi.mocked(productsRepository.updateById).mockResolvedValue(productStub);

    await updateProduct(productId, { name: "New name" });

    const patch = vi.mocked(productsRepository.updateById).mock.calls[0]?.[1];
    expect(patch).not.toHaveProperty("sku");
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

  it("recomputes sellingPrice from the new mrp and the existing discount when only mrp changes", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productStub);
    vi.mocked(productsRepository.updateById).mockResolvedValue(productStub);

    await updateProduct(productId, { mrp: 100000 });

    const patch = vi.mocked(productsRepository.updateById).mock.calls[0]?.[1];
    expect(patch).toMatchObject({
      mrp: 100000,
      discount: productStub.discount,
      sellingPrice: 100000,
    });
  });

  it("recomputes sellingPrice from the existing mrp and the new discount when only discount changes", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue({
      ...productStub,
      mrp: 100000,
      discount: 0,
    });
    vi.mocked(productsRepository.updateById).mockResolvedValue(productStub);

    await updateProduct(productId, { discount: 20 });

    const patch = vi.mocked(productsRepository.updateById).mock.calls[0]?.[1];
    expect(patch).toMatchObject({ mrp: 100000, discount: 20, sellingPrice: 80000 });
  });

  it("does not touch pricing fields when neither mrp nor discount changes", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productStub);
    vi.mocked(productsRepository.updateById).mockResolvedValue(productStub);

    await updateProduct(productId, { name: "New name" });

    const patch = vi.mocked(productsRepository.updateById).mock.calls[0]?.[1];
    expect(patch).not.toHaveProperty("mrp");
    expect(patch).not.toHaveProperty("discount");
    expect(patch).not.toHaveProperty("sellingPrice");
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
      lowStock: false,
    });

    expect(result.pagination).toEqual({
      page: 2,
      limit: 20,
      total: 45,
      totalPages: 3,
      hasNextPage: true,
    });
  });

  it("passes the lowStock filter through to the repository", async () => {
    vi.mocked(productsRepository.listPaginated).mockResolvedValue({ items: [], total: 0 });

    await listProductsForAdmin({
      page: 1,
      limit: 20,
      sort: { field: "createdAt", order: -1 },
      lowStock: true,
    });

    expect(productsRepository.listPaginated).toHaveBeenCalledWith(
      { lowStock: true },
      { field: "createdAt", order: -1 },
      { page: 1, limit: 20 },
    );
  });

  it("passes the search term through to the repository", async () => {
    vi.mocked(productsRepository.listPaginated).mockResolvedValue({ items: [], total: 0 });

    await listProductsForAdmin({
      page: 1,
      limit: 20,
      sort: { field: "createdAt", order: -1 },
      lowStock: false,
      search: "SKU-1",
    });

    expect(productsRepository.listPaginated).toHaveBeenCalledWith(
      { lowStock: false, search: "SKU-1", status: undefined },
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
      lowStock: false,
      search: "phone",
      status: "published",
    });

    expect(productsRepository.listPaginated).toHaveBeenCalledWith(
      { lowStock: false, search: "phone", status: "published" },
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
      lowStock: false,
    });

    expect(result.pagination.hasNextPage).toBe(false);
  });
});

describe("updateProductStatus", () => {
  it("sets the requested status", async () => {
    vi.mocked(productsRepository.updateById).mockResolvedValue({
      ...productStub,
      status: "published",
    });

    await updateProductStatus(productId, "published");

    expect(productsRepository.updateById).toHaveBeenCalledWith(productId, { status: "published" });
  });

  it("throws PRODUCT_NOT_FOUND when the id doesn't match any product", async () => {
    vi.mocked(productsRepository.updateById).mockResolvedValue(null);

    await expect(updateProductStatus(productId, "archived")).rejects.toMatchObject({
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

describe("updateStock", () => {
  it("updates only the stock field", async () => {
    vi.mocked(productsRepository.updateById).mockResolvedValue(productStub);

    await updateStock(productId, 42);

    expect(productsRepository.updateById).toHaveBeenCalledWith(productId, { stock: 42 });
  });

  it("throws PRODUCT_NOT_FOUND when the id doesn't match any product", async () => {
    vi.mocked(productsRepository.updateById).mockResolvedValue(null);

    await expect(updateStock(productId, 42)).rejects.toMatchObject({
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

  it("rejects a sku matching the parent product's own sku", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productWithVariants);

    await expect(
      addVariant(productId, { ...baseAddVariantInput, sku: productStub.sku }),
    ).rejects.toMatchObject({ statusCode: 400, code: "DUPLICATE_SKU" });
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

  it("resolves images only when at least one is submitted", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productWithVariants);
    vi.mocked(productsRepository.skuInUse).mockResolvedValue(false);
    vi.mocked(productsRepository.replaceVariants).mockResolvedValue(productWithVariants);

    await addVariant(productId, baseAddVariantInput);
    expect(uploadsService.validateImageCount).not.toHaveBeenCalled();

    await addVariant(productId, {
      ...baseAddVariantInput,
      sku: "SKU-1-WITH-IMAGE",
      images: [{ objectKey: "product-image/variant.png" }],
    });
    expect(uploadsService.validateImageCount).toHaveBeenCalledWith(
      [{ objectKey: "product-image/variant.png" }],
      { min: 1, max: 2 },
    );
    expect(uploadsService.consumeImageKeys).toHaveBeenCalledWith(["product-image/variant.png"]);
  });
});

describe("updateVariant", () => {
  it("throws PRODUCT_NOT_FOUND when the product doesn't exist", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(null);

    await expect(updateVariant(productId, variantId, { stock: 1 })).rejects.toMatchObject({
      statusCode: 404,
      code: "PRODUCT_NOT_FOUND",
    });
  });

  it("throws VARIANT_NOT_FOUND when the variantId doesn't match any variant on this product", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productWithVariants);

    await expect(
      updateVariant(productId, new Types.ObjectId(), { stock: 1 }),
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

    await updateVariant(productId, variantId, { sku: existingVariant.sku, stock: 9 });

    expect(productsRepository.skuInUse).not.toHaveBeenCalled();
  });

  it("rejects recoding sku to collide with a sibling variant", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productWithVariants);

    await expect(
      updateVariant(productId, variantId, { sku: otherExistingVariant.sku }),
    ).rejects.toMatchObject({ statusCode: 400, code: "DUPLICATE_SKU" });
    expect(productsRepository.replaceVariants).not.toHaveBeenCalled();
  });

  it("rejects recoding sku to collide with the parent product's own sku", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productWithVariants);

    await expect(
      updateVariant(productId, variantId, { sku: productStub.sku }),
    ).rejects.toMatchObject({ statusCode: 400, code: "DUPLICATE_SKU" });
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

    await updateVariant(productId, variantId, { stock: 2 });

    const persisted = vi.mocked(productsRepository.replaceVariants).mock.calls[0]?.[1];
    expect(persisted?.[0]).toMatchObject({
      mrp: existingVariant.mrp,
      discount: existingVariant.discount,
      sellingPrice: existingVariant.sellingPrice,
      stock: 2,
    });
  });

  it("throws PRODUCT_NOT_FOUND when the repository update itself finds nothing", async () => {
    vi.mocked(productsRepository.findById).mockResolvedValue(productWithVariants);
    vi.mocked(productsRepository.replaceVariants).mockResolvedValue(null);

    await expect(updateVariant(productId, variantId, { stock: 1 })).rejects.toMatchObject({
      statusCode: 404,
      code: "PRODUCT_NOT_FOUND",
    });
  });
});
