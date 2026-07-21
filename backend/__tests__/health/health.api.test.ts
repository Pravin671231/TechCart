import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "@/app";

describe("GET /health", () => {
  it("returns the success-contract shape", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      code: "OK",
      message: "healthy",
    });
  });

  it("returns the error-contract shape for unmatched routes", async () => {
    const res = await request(app).get("/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      code: "NOT_FOUND",
      message: "Route not found",
    });
  });
});
