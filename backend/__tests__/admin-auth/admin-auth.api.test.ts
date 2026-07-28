import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "@/app";
import { env } from "@/config/env";

describe("admin auth guard on /api/admin", () => {
  it("rejects a request with no X-Admin-Key header", async () => {
    const res = await request(app).get("/api/admin/anything");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      success: false,
      code: "UNAUTHORIZED",
      message: "Missing or invalid admin credentials",
    });
  });

  it("rejects a request with the wrong X-Admin-Key header", async () => {
    const res = await request(app).get("/api/admin/anything").set("X-Admin-Key", "wrong-key");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      success: false,
      code: "UNAUTHORIZED",
      message: "Missing or invalid admin credentials",
    });
  });

  it("passes through to normal routing with the correct X-Admin-Key header", async () => {
    const res = await request(app).get("/api/admin/anything").set("X-Admin-Key", env.ADMIN_API_KEY);

    // No admin feature route is mounted yet — falling through to the existing
    // 404 handler (rather than a 401) proves the guard let the request through.
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      code: "NOT_FOUND",
      message: "Route not found",
    });
  });
});
