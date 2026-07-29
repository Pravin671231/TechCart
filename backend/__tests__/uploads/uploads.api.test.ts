import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("@/externalService/r2", () => ({
  createPresignedPutUrl: vi.fn(),
  uploadObject: vi.fn(),
}));

vi.mock("@/modules/uploads/uploads.repository", () => ({
  createPendingUpload: vi.fn(),
  consumeByKey: vi.fn(),
}));

import app from "@/app";
import { env } from "@/config/env";
import { createPresignedPutUrl, uploadObject } from "@/externalService/r2";

describe("POST /api/admin/uploads/presign", () => {
  afterEach(() => {
    vi.mocked(createPresignedPutUrl).mockReset();
  });

  it("rejects a request with no X-Admin-Key header", async () => {
    const res = await request(app)
      .post("/api/admin/uploads/presign")
      .send({ purpose: "product-image", contentType: "image/webp" });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
  });

  it("rejects an invalid purpose before issuing a URL", async () => {
    const res = await request(app)
      .post("/api/admin/uploads/presign")
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ purpose: "not-a-real-purpose", contentType: "image/webp" });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
    expect(createPresignedPutUrl).not.toHaveBeenCalled();
  });

  it("rejects a disallowed content type before issuing a URL", async () => {
    const res = await request(app)
      .post("/api/admin/uploads/presign")
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ purpose: "product-image", contentType: "image/gif" });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
    expect(createPresignedPutUrl).not.toHaveBeenCalled();
  });

  it("issues a presigned URL for a valid request", async () => {
    const expiresAt = new Date("2026-01-01T00:05:00.000Z");
    vi.mocked(createPresignedPutUrl).mockResolvedValueOnce({
      uploadUrl: "https://r2.example/signed-put-url",
      expiresAt,
    });

    const res = await request(app)
      .post("/api/admin/uploads/presign")
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .send({ purpose: "brand-logo", contentType: "image/png" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.uploadUrl).toBe("https://r2.example/signed-put-url");
    expect(res.body.data.objectKey).toMatch(/^brand-logo\/.+\.png$/);
    expect(res.body.data.publicUrl).toBe(`https://cdn.test.example/${res.body.data.objectKey}`);
    expect(res.body.pagination).toBeUndefined();
  });
});

describe("POST /api/admin/uploads/direct", () => {
  afterEach(() => {
    vi.mocked(uploadObject).mockReset();
  });

  it("rejects a request with no X-Admin-Key header", async () => {
    const res = await request(app)
      .post("/api/admin/uploads/direct")
      .field("purpose", "product-image")
      .attach("file", Buffer.from("fake-image-bytes"), {
        filename: "photo.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
    expect(uploadObject).not.toHaveBeenCalled();
  });

  it("rejects an invalid purpose before uploading to R2", async () => {
    const res = await request(app)
      .post("/api/admin/uploads/direct")
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .field("purpose", "not-a-real-purpose")
      .attach("file", Buffer.from("fake-image-bytes"), {
        filename: "photo.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
    expect(uploadObject).not.toHaveBeenCalled();
  });

  it("rejects a request with no file attached", async () => {
    const res = await request(app)
      .post("/api/admin/uploads/direct")
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .field("purpose", "product-image");

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: "NO_FILE_UPLOADED" });
    expect(uploadObject).not.toHaveBeenCalled();
  });

  it("rejects a disallowed content type before uploading to R2", async () => {
    const res = await request(app)
      .post("/api/admin/uploads/direct")
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .field("purpose", "product-image")
      .attach("file", Buffer.from("fake-gif-bytes"), {
        filename: "photo.gif",
        contentType: "image/gif",
      });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: "UNSUPPORTED_CONTENT_TYPE" });
    expect(uploadObject).not.toHaveBeenCalled();
  });

  it("rejects a file over the 5 MB limit before uploading to R2", async () => {
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1);

    const res = await request(app)
      .post("/api/admin/uploads/direct")
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .field("purpose", "product-image")
      .attach("file", oversized, { filename: "big.png", contentType: "image/png" });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: "FILE_TOO_LARGE" });
    expect(uploadObject).not.toHaveBeenCalled();
  });

  it("uploads a valid file to R2 and returns the object key and public URL", async () => {
    vi.mocked(uploadObject).mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post("/api/admin/uploads/direct")
      .set("X-Admin-Key", env.ADMIN_API_KEY)
      .field("purpose", "category-image")
      .attach("file", Buffer.from("fake-image-bytes"), {
        filename: "photo.webp",
        contentType: "image/webp",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.objectKey).toMatch(/^category-image\/.+\.webp$/);
    expect(res.body.data.publicUrl).toBe(`https://cdn.test.example/${res.body.data.objectKey}`);
    expect(uploadObject).toHaveBeenCalledWith(
      res.body.data.objectKey,
      expect.any(Buffer),
      "image/webp",
    );
  });
});
