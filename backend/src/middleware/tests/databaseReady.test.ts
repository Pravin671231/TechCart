import type { NextFunction, Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/db", () => ({
  isDatabaseGateTripped: vi.fn(),
}));

import { isDatabaseGateTripped } from "@/config/db";
import { databaseReady } from "@/middleware/databaseReady";
import { AppError } from "@/utils/AppError";

const res = {} as Response;

function run(path: string): { next: NextFunction; error: unknown } {
  const req = { path } as Request;
  const next = vi.fn() as unknown as NextFunction;
  let error: unknown;
  try {
    databaseReady(req, res, next);
  } catch (thrown) {
    error = thrown;
  }
  return { next, error };
}

describe("databaseReady middleware", () => {
  afterEach(() => {
    vi.mocked(isDatabaseGateTripped).mockReset();
  });

  it("passes through when the database gate is not tripped", () => {
    vi.mocked(isDatabaseGateTripped).mockReturnValue(false);

    const { next, error } = run("/api/products");

    expect(error).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });

  it("throws a 503 DATABASE_UNAVAILABLE AppError when the gate is tripped", () => {
    vi.mocked(isDatabaseGateTripped).mockReturnValue(true);

    const { next, error } = run("/api/products");

    expect(next).not.toHaveBeenCalled();
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).statusCode).toBe(503);
    expect((error as AppError).code).toBe("DATABASE_UNAVAILABLE");
  });

  it("exempts /health even when the gate is tripped", () => {
    vi.mocked(isDatabaseGateTripped).mockReturnValue(true);

    const { next, error } = run("/health");

    expect(error).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });
});
