import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../config/db", () => ({
  connectDB: vi.fn(),
}));

import { connectDB } from "../config/db";
import app from "../app";
import { startServer } from "../index";

describe("startServer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(connectDB).mockReset();
  });

  it("starts listening when the DB connection succeeds", async () => {
    vi.mocked(connectDB).mockResolvedValueOnce(undefined);
    const listenSpy = vi
      .spyOn(app, "listen")
      .mockImplementation(() => ({}) as unknown as ReturnType<typeof app.listen>);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    await startServer();

    expect(listenSpy).toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("exits without listening when the DB connection fails", async () => {
    vi.mocked(connectDB).mockRejectedValueOnce(new Error("connection refused"));
    const listenSpy = vi
      .spyOn(app, "listen")
      .mockImplementation(() => ({}) as unknown as ReturnType<typeof app.listen>);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await startServer();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(listenSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
