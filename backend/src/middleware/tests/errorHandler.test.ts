import type { Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { MulterError } from "multer";
import { AppError } from "@/utils/AppError";

// A mutable object, not a frozen one — errorHandler reads env.NODE_ENV at
// call time, not at import time, so mutating this between tests changes what
// the handler sees without needing vi.resetModules()/dynamic re-imports.
// vi.hoisted() is required here since vi.mock()'s factory is hoisted above
// normal top-level declarations — a plain `const mockEnv` above it would be
// accessed before initialization.
const mockEnv = vi.hoisted(() => ({ NODE_ENV: "test" }));
vi.mock("@/config/env", () => ({ env: mockEnv }));

import { errorHandler } from "../errorHandler";

function mockResponse(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

const req = {} as Request;
const next = vi.fn();

afterEach(() => {
  vi.clearAllMocks();
  mockEnv.NODE_ENV = "test";
});

describe("errorHandler — AppError/ZodError/MulterError (unaffected by the env split)", () => {
  it("returns the AppError's own status/code/message", () => {
    const res = mockResponse();

    errorHandler(new AppError(404, "PRODUCT_NOT_FOUND", "not found"), req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      code: "PRODUCT_NOT_FOUND",
      message: "not found",
    });
  });

  it("returns a VALIDATION_ERROR shape for a ZodError", () => {
    const res = mockResponse();
    const zodError = new ZodError([
      { code: "custom", path: ["name"], message: "Required", input: undefined },
    ]);

    errorHandler(zodError, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      code: "VALIDATION_ERROR",
      errors: { name: "Required" },
    });
  });

  it("returns FILE_TOO_LARGE for a LIMIT_FILE_SIZE MulterError", () => {
    const res = mockResponse();

    errorHandler(new MulterError("LIMIT_FILE_SIZE"), req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, code: "FILE_TOO_LARGE" }),
    );
  });
});

describe("errorHandler — generic 500 fallback, split by NODE_ENV", () => {
  it("returns the generic safe message in production", () => {
    mockEnv.NODE_ENV = "production";
    const res = mockResponse();

    errorHandler(new Error("db connection lost"), req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      code: "INTERNAL_ERROR",
      message: "Internal server error",
    });
  });

  it("returns the generic safe message in test (test behaves like production)", () => {
    mockEnv.NODE_ENV = "test";
    const res = mockResponse();

    errorHandler(new Error("db connection lost"), req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      success: false,
      code: "INTERNAL_ERROR",
      message: "Internal server error",
    });
  });

  it("returns the generic safe message for an unrecognized NODE_ENV value (fail-safe default)", () => {
    mockEnv.NODE_ENV = "staging";
    const res = mockResponse();

    errorHandler(new Error("db connection lost"), req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      success: false,
      code: "INTERNAL_ERROR",
      message: "Internal server error",
    });
  });

  it("returns the real message, name, and stack in development", () => {
    mockEnv.NODE_ENV = "development";
    const res = mockResponse();
    const error = new TypeError("Cannot read properties of undefined (reading 'foo')");

    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      code: "INTERNAL_ERROR",
      message: "Cannot read properties of undefined (reading 'foo')",
      name: "TypeError",
      stack: expect.stringContaining("TypeError"),
    });
  });

  it("handles a non-Error thrown value safely in development, without a stack key", () => {
    mockEnv.NODE_ENV = "development";
    const res = mockResponse();

    errorHandler("just a string", req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      success: false,
      code: "INTERNAL_ERROR",
      message: "just a string",
      name: "UnknownError",
    });
    const body = vi.mocked(res.json).mock.calls[0]?.[0];
    expect(body).not.toHaveProperty("stack");
  });

  it("always logs the full error server-side, regardless of environment", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = new Error("boom");

    mockEnv.NODE_ENV = "production";
    errorHandler(error, req, mockResponse(), next);
    expect(consoleErrorSpy).toHaveBeenCalledWith(error);

    mockEnv.NODE_ENV = "development";
    errorHandler(error, req, mockResponse(), next);
    expect(consoleErrorSpy).toHaveBeenCalledWith(error);

    consoleErrorSpy.mockRestore();
  });
});
