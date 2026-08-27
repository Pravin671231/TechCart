import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";

// Issue #143/M3.5 — every /api/admin/uploads route is now gated by
// rbac.ts, which needs a real session to resolve, not the old
// X-Admin-Key header — see brands.api.test.ts's own header comment for the
// full rationale. No-session now 401s as UNAUTHENTICATED (rbac.ts), not the
// old adminAuth.ts's UNAUTHORIZED.
vi.mock("@/externalService/mailer", () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/externalService/r2", () => ({
  createPresignedPutUrl: vi.fn(),
  uploadObject: vi.fn(),
}));

vi.mock("@/modules/uploads/uploads.repository", () => ({
  createPendingUpload: vi.fn(),
  consumeByKey: vi.fn(),
}));

import { createPresignedPutUrl, uploadObject } from "@/externalService/r2";
import {
  bootstrapMemoryMongo,
  teardownMemoryMongo,
  signInFully,
  authRequest,
  type MemoryMongoContext,
} from "../testHelpers/adminSession";

const CATALOG_MANAGER_EMAIL = "uploads-catalog-manager@example.com";
const CATALOG_MANAGER_PASSWORD = "CatalogMgr!Pass1";

let ctx: MemoryMongoContext;
let app: Express;
let token: string;

beforeAll(async () => {
  ctx = await bootstrapMemoryMongo();
  app = ctx.app;

  const { provisionAdminUser } = await import("../../src/scripts/seed/createAdminUser.js");
  await provisionAdminUser({
    email: CATALOG_MANAGER_EMAIL,
    password: CATALOG_MANAGER_PASSWORD,
    name: "Uploads Catalog Manager Fixture",
    role: "catalog-manager",
  });
  token = await signInFully(app, CATALOG_MANAGER_EMAIL, CATALOG_MANAGER_PASSWORD);
}, 60000);

afterAll(async () => {
  await teardownMemoryMongo(ctx);
});

function admin(method: "post", url: string) {
  return authRequest(app, method, url, token);
}

describe("POST /api/admin/uploads/presign", () => {
  afterEach(() => {
    vi.mocked(createPresignedPutUrl).mockReset();
  });

  it("rejects a request with no session at all", async () => {
    const res = await request(app)
      .post("/api/admin/uploads/presign")
      .send({ purpose: "product-image", contentType: "image/webp" });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHENTICATED");
  });

  it("rejects an invalid purpose before issuing a URL", async () => {
    const res = await admin("post", "/api/admin/uploads/presign").send({
      purpose: "not-a-real-purpose",
      contentType: "image/webp",
    });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
    expect(createPresignedPutUrl).not.toHaveBeenCalled();
  });

  it("rejects a disallowed content type before issuing a URL", async () => {
    const res = await admin("post", "/api/admin/uploads/presign").send({
      purpose: "product-image",
      contentType: "image/gif",
    });

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

    const res = await admin("post", "/api/admin/uploads/presign").send({
      purpose: "brand-logo",
      contentType: "image/png",
    });

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

  it("rejects a request with no session at all", async () => {
    const res = await request(app)
      .post("/api/admin/uploads/direct")
      .field("purpose", "product-image")
      .attach("file", Buffer.from("fake-image-bytes"), {
        filename: "photo.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHENTICATED");
    expect(uploadObject).not.toHaveBeenCalled();
  });

  it("rejects an invalid purpose before uploading to R2", async () => {
    const res = await admin("post", "/api/admin/uploads/direct")
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
    const res = await admin("post", "/api/admin/uploads/direct").field(
      "purpose",
      "product-image",
    );

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: "NO_FILE_UPLOADED" });
    expect(uploadObject).not.toHaveBeenCalled();
  });

  it("rejects a disallowed content type before uploading to R2", async () => {
    const res = await admin("post", "/api/admin/uploads/direct")
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

    const res = await admin("post", "/api/admin/uploads/direct")
      .field("purpose", "product-image")
      .attach("file", oversized, { filename: "big.png", contentType: "image/png" });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: "FILE_TOO_LARGE" });
    expect(uploadObject).not.toHaveBeenCalled();
  });

  it("uploads a valid file to R2 and returns the object key and public URL", async () => {
    vi.mocked(uploadObject).mockResolvedValueOnce(undefined);

    const res = await admin("post", "/api/admin/uploads/direct")
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
