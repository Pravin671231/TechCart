import { describe, expect, it } from "vitest";
import { getHealthStatus } from "../health.service";

describe("getHealthStatus", () => {
  it("returns 'healthy'", () => {
    expect(getHealthStatus()).toBe("healthy");
  });
});
