import { Types } from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BrandRecord } from "../brands.repository";

vi.mock("../brands.repository", () => ({
  create: vi.fn(),
  findById: vi.fn(),
  slugExists: vi.fn(),
  updateById: vi.fn(),
  deleteById: vi.fn(),
  list: vi.fn(),
  listActive: vi.fn(),
}));

vi.mock("@/modules/product-catalog/features/products/products.repository", () => ({
  countByBrand: vi.fn(),
  countByBrandIds: vi.fn(),
}));

vi.mock("@/modules/uploads/uploads.service", () => ({
  consumeImageKeys: vi.fn(),
  buildPublicUrl: vi.fn((objectKey: string) => `https://cdn.test/${objectKey}`),
}));

import * as brandsRepository from "../brands.repository";
import * as productsRepository from "@/modules/product-catalog/features/products/products.repository";
import * as uploadsService from "@/modules/uploads/uploads.service";
import {
  createBrand,
  updateBrand,
  getBrandById,
  listBrandsForAdmin,
  listBrandsForPublic,
  deleteBrand,
  updateBrandStatus,
} from "../brands.service";

const idA = new Types.ObjectId();
const idB = new Types.ObjectId();

const brandA: BrandRecord = {
  _id: idA,
  name: "Nova",
  slug: "nova",
  status: true,
  createdBy: null,
  updatedBy: null,
};

const brandB: BrandRecord = {
  _id: idB,
  name: "Zeta",
  slug: "zeta",
  status: true,
  createdBy: null,
  updatedBy: null,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("createBrand", () => {
  it("generates a slug from the name and persists it", async () => {
    vi.mocked(brandsRepository.slugExists).mockResolvedValue(false);
    vi.mocked(brandsRepository.create).mockResolvedValue(brandA);

    await createBrand({ name: "Nova" });

    expect(brandsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Nova", slug: "nova" }),
    );
  });

  it("appends a numeric suffix when the slug collides", async () => {
    vi.mocked(brandsRepository.slugExists).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    vi.mocked(brandsRepository.create).mockResolvedValue(brandA);

    await createBrand({ name: "Nova" });

    expect(brandsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "nova-2" }),
    );
  });

  it("consumes the logo key and stores a built url when a logo is provided", async () => {
    vi.mocked(brandsRepository.slugExists).mockResolvedValue(false);
    vi.mocked(brandsRepository.create).mockResolvedValue(brandA);

    await createBrand({
      name: "Nova",
      logo: { objectKey: "brand-logo/abc.png", alt: "Nova logo" },
    });

    expect(uploadsService.consumeImageKeys).toHaveBeenCalledWith(["brand-logo/abc.png"]);
    expect(brandsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        logo: { url: "https://cdn.test/brand-logo/abc.png", alt: "Nova logo" },
      }),
    );
  });

  it("does not touch uploads or include a logo key when none is provided", async () => {
    vi.mocked(brandsRepository.slugExists).mockResolvedValue(false);
    vi.mocked(brandsRepository.create).mockResolvedValue(brandA);

    await createBrand({ name: "Nova" });

    expect(uploadsService.consumeImageKeys).not.toHaveBeenCalled();
    const doc = vi.mocked(brandsRepository.create).mock.calls[0]?.[0];
    expect(doc).not.toHaveProperty("logo");
  });
});

describe("updateBrand", () => {
  it("updates only the provided fields and never touches the slug", async () => {
    vi.mocked(brandsRepository.updateById).mockResolvedValue({ ...brandA, name: "Nova Updated" });

    await updateBrand(idA, { name: "Nova Updated" });

    const patch = vi.mocked(brandsRepository.updateById).mock.calls[0]?.[1];
    expect(patch).toEqual({ name: "Nova Updated" });
    expect(patch).not.toHaveProperty("slug");
    expect(patch).not.toHaveProperty("description");
  });

  it("consumes a new logo key and builds the url before persisting", async () => {
    vi.mocked(brandsRepository.updateById).mockResolvedValue(brandA);

    await updateBrand(idA, { logo: { objectKey: "brand-logo/abc.png", alt: "Nova" } });

    expect(uploadsService.consumeImageKeys).toHaveBeenCalledWith(["brand-logo/abc.png"]);
    const patch = vi.mocked(brandsRepository.updateById).mock.calls[0]?.[1];
    expect(patch?.logo).toEqual({ url: "https://cdn.test/brand-logo/abc.png", alt: "Nova" });
  });

  it("throws BRAND_NOT_FOUND when the id doesn't match an existing brand", async () => {
    vi.mocked(brandsRepository.updateById).mockResolvedValue(null);

    await expect(updateBrand(idA, { name: "X" })).rejects.toMatchObject({
      statusCode: 404,
      code: "BRAND_NOT_FOUND",
    });
  });
});

describe("getBrandById", () => {
  it("returns the brand when found", async () => {
    vi.mocked(brandsRepository.findById).mockResolvedValue(brandA);

    const result = await getBrandById(idA);

    expect(result).toEqual(brandA);
  });

  it("throws BRAND_NOT_FOUND when missing", async () => {
    vi.mocked(brandsRepository.findById).mockResolvedValue(null);

    await expect(getBrandById(idA)).rejects.toMatchObject({
      statusCode: 404,
      code: "BRAND_NOT_FOUND",
    });
  });
});

describe("listBrandsForAdmin", () => {
  it("merges each brand with its product count, defaulting to 0", async () => {
    vi.mocked(brandsRepository.list).mockResolvedValue({ items: [brandA, brandB], total: 2 });
    vi.mocked(productsRepository.countByBrandIds).mockResolvedValue(new Map([[idA.toString(), 3]]));

    const result = await listBrandsForAdmin({}, undefined, { page: 1, limit: 20 });

    expect(result.items).toEqual([
      { ...brandA, productCount: 3 },
      { ...brandB, productCount: 0 },
    ]);
    expect(productsRepository.countByBrandIds).toHaveBeenCalledWith([idA, idB]);
  });

  it("passes filter/sort/page straight through to the repository", async () => {
    vi.mocked(brandsRepository.list).mockResolvedValue({ items: [brandA], total: 1 });
    vi.mocked(productsRepository.countByBrandIds).mockResolvedValue(new Map());

    const filter = { name: { $regex: "nov", $options: "i" } };
    const sort = { field: "name" as const, order: 1 as const };

    await listBrandsForAdmin(filter, sort, { page: 1, limit: 20 });

    expect(brandsRepository.list).toHaveBeenCalledWith(filter, sort, { page: 1, limit: 20 });
  });

  it("computes pagination fields from the repository's total", async () => {
    vi.mocked(brandsRepository.list).mockResolvedValue({ items: [brandA], total: 45 });
    vi.mocked(productsRepository.countByBrandIds).mockResolvedValue(new Map());

    const result = await listBrandsForAdmin({}, undefined, { page: 2, limit: 20 });

    expect(result.pagination).toEqual({
      page: 2,
      limit: 20,
      total: 45,
      totalPages: 3,
      hasNextPage: true,
    });
  });
});

describe("listBrandsForPublic", () => {
  it("returns only active brands with admin-only fields stripped", async () => {
    vi.mocked(brandsRepository.listActive).mockResolvedValue([brandA]);

    const result = await listBrandsForPublic();

    expect(result).toEqual([{ _id: idA, name: "Nova", slug: "nova" }]);
    expect(result[0]).not.toHaveProperty("status");
    expect(result[0]).not.toHaveProperty("createdBy");
    expect(result[0]).not.toHaveProperty("updatedBy");
  });
});

describe("deleteBrand", () => {
  it("throws BRAND_IN_USE and does not delete when any product references the brand", async () => {
    vi.mocked(productsRepository.countByBrand).mockResolvedValue(2);

    await expect(deleteBrand(idA)).rejects.toMatchObject({ statusCode: 409, code: "BRAND_IN_USE" });
    expect(brandsRepository.deleteById).not.toHaveBeenCalled();
  });

  it("deletes when no products reference the brand", async () => {
    vi.mocked(productsRepository.countByBrand).mockResolvedValue(0);

    await deleteBrand(idA);

    expect(brandsRepository.deleteById).toHaveBeenCalledWith(idA);
  });
});

describe("updateBrandStatus", () => {
  it("sets the requested boolean status", async () => {
    vi.mocked(brandsRepository.updateById).mockResolvedValue({ ...brandA, status: false });

    await updateBrandStatus(idA, false);

    expect(brandsRepository.updateById).toHaveBeenCalledWith(idA, { status: false });
  });

  it("throws BRAND_NOT_FOUND when the id doesn't match any brand", async () => {
    vi.mocked(brandsRepository.updateById).mockResolvedValue(null);

    await expect(updateBrandStatus(idA, false)).rejects.toMatchObject({
      statusCode: 404,
      code: "BRAND_NOT_FOUND",
    });
  });

  it("never touches the product delete guard — no guard calls happen at all", async () => {
    vi.mocked(brandsRepository.updateById).mockResolvedValue({ ...brandA, status: false });

    await updateBrandStatus(idA, false);

    expect(productsRepository.countByBrand).not.toHaveBeenCalled();
  });
});
