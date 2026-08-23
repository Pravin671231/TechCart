import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "@/app";

describe("CORS", () => {
  it("reflects an allowed origin in Access-Control-Allow-Origin", async () => {
    const res = await request(app).get("/health").set("Origin", "http://localhost:3000");

    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("omits Access-Control-Allow-Origin for a disallowed origin", async () => {
    const res = await request(app).get("/health").set("Origin", "https://evil.example");

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("allows the Authorization header on a preflight request", async () => {
    const res = await request(app)
      .options("/api/admin/brands")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "GET")
      .set("Access-Control-Request-Headers", "Authorization");

    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(res.headers["access-control-allow-headers"]).toContain("Authorization");
  });
});
