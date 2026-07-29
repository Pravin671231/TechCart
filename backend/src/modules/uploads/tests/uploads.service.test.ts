import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/externalService/r2", () => ({
  createPresignedPutUrl: vi.fn(),
  uploadObject: vi.fn(),
}));

vi.mock("../uploads.repository", () => ({
  createPendingUpload: vi.fn(),
  consumeByKey: vi.fn(),
}));

import { createPresignedPutUrl, uploadObject } from "@/externalService/r2";
import { createPendingUpload, consumeByKey } from "../uploads.repository";
import {
  issuePresignedUpload,
  issueDirectUpload,
  consumeImageKeys,
  validateImageCount,
  normalizeImages,
} from "../uploads.service";

describe("issuePresignedUpload", () => {
  afterEach(() => {
    vi.mocked(createPresignedPutUrl).mockReset();
    vi.mocked(createPendingUpload).mockReset();
  });

  it("generates a {purpose}/{uuid}.{ext} object key and persists a tracking record", async () => {
    const expiresAt = new Date("2026-01-01T00:05:00.000Z");
    vi.mocked(createPresignedPutUrl).mockResolvedValueOnce({
      uploadUrl: "https://r2.example/signed",
      expiresAt,
    });

    const result = await issuePresignedUpload("product-image", "image/webp");

    expect(result.objectKey).toMatch(
      /^product-image\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/,
    );
    expect(result.uploadUrl).toBe("https://r2.example/signed");
    expect(result.expiresAt).toBe(expiresAt);
    expect(result.publicUrl).toBe(`https://cdn.test.example/${result.objectKey}`);

    expect(createPresignedPutUrl).toHaveBeenCalledWith(result.objectKey, "image/webp");
    expect(createPendingUpload).toHaveBeenCalledWith({
      objectKey: result.objectKey,
      purpose: "product-image",
      contentType: "image/webp",
      expiresAt,
    });
  });
});

describe("issueDirectUpload", () => {
  afterEach(() => {
    vi.mocked(uploadObject).mockReset();
    vi.mocked(createPendingUpload).mockReset();
  });

  it("uploads the buffer to R2, generates a {purpose}/{uuid}.{ext} key, and persists a tracking record", async () => {
    const buffer = Buffer.from("fake-image-bytes");
    vi.mocked(uploadObject).mockResolvedValueOnce(undefined);

    const result = await issueDirectUpload("brand-logo", "image/png", buffer);

    expect(result.objectKey).toMatch(
      /^brand-logo\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/,
    );
    expect(result.publicUrl).toBe(`https://cdn.test.example/${result.objectKey}`);
    expect(result.expiresAt).toBeInstanceOf(Date);

    expect(uploadObject).toHaveBeenCalledWith(result.objectKey, buffer, "image/png");
    expect(createPendingUpload).toHaveBeenCalledWith({
      objectKey: result.objectKey,
      purpose: "brand-logo",
      contentType: "image/png",
      expiresAt: result.expiresAt,
    });
  });
});

describe("consumeImageKeys", () => {
  afterEach(() => {
    vi.mocked(consumeByKey).mockReset();
  });

  it("resolves when every key was issued and unconsumed", async () => {
    vi.mocked(consumeByKey).mockResolvedValue({
      objectKey: "product-image/a.webp",
      purpose: "product-image",
      contentType: "image/webp",
      expiresAt: new Date(),
    });

    await expect(consumeImageKeys(["product-image/a.webp"])).resolves.toBeUndefined();
  });

  it("rejects a key that was never issued or already consumed", async () => {
    vi.mocked(consumeByKey).mockResolvedValueOnce(null);

    await expect(consumeImageKeys(["product-image/missing.webp"])).rejects.toMatchObject({
      statusCode: 400,
      code: "OBJECT_KEY_NOT_ISSUED",
    });
  });
});

describe("validateImageCount", () => {
  it("accepts a count within bounds", () => {
    expect(() => validateImageCount([1, 2, 3], { min: 1, max: 8 })).not.toThrow();
  });

  it("rejects a count below the minimum", () => {
    expect(() => validateImageCount([], { min: 1, max: 8 })).toThrow(
      expect.objectContaining({ statusCode: 400, code: "IMAGE_COUNT_OUT_OF_BOUNDS" }),
    );
  });

  it("rejects a count above the maximum", () => {
    const nine = Array.from({ length: 9 });
    expect(() => validateImageCount(nine, { min: 1, max: 8 })).toThrow(
      expect.objectContaining({ statusCode: 400, code: "IMAGE_COUNT_OUT_OF_BOUNDS" }),
    );
  });

  it("accepts zero images when the minimum is zero (variant images)", () => {
    expect(() => validateImageCount([], { min: 0, max: 2 })).not.toThrow();
  });
});

describe("normalizeImages", () => {
  it("returns an empty array unchanged", () => {
    expect(normalizeImages([])).toEqual([]);
  });

  it("auto-promotes the first image when none is marked primary", () => {
    const images: { url: string; isPrimary?: boolean }[] = [{ url: "a" }, { url: "b" }];
    const result = normalizeImages(images);
    expect(result).toEqual([
      { url: "a", isPrimary: true },
      { url: "b", isPrimary: false },
    ]);
  });

  it("keeps the marked primary image as-is", () => {
    const result = normalizeImages([
      { url: "a", isPrimary: false },
      { url: "b", isPrimary: true },
    ]);
    expect(result).toEqual([
      { url: "a", isPrimary: false },
      { url: "b", isPrimary: true },
    ]);
  });

  it("picks the first marked image as the winner when more than one is marked", () => {
    const result = normalizeImages([
      { url: "a", isPrimary: true },
      { url: "b", isPrimary: true },
    ]);
    expect(result).toEqual([
      { url: "a", isPrimary: true },
      { url: "b", isPrimary: false },
    ]);
  });
});
