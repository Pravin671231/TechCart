import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../config/db", () => ({
  connectDB: vi.fn(),
}));

vi.mock("../lib/queueWorkers", () => ({
  startQueueWorkers: vi.fn(),
}));

import { connectDB } from "../config/db";
import { startQueueWorkers } from "../lib/queueWorkers";
import app from "../app";
import { startServer } from "../index";

describe("startServer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(connectDB).mockReset();
    vi.mocked(startQueueWorkers).mockReset();
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

  it("keeps listening when the queue-worker startup fails", async () => {
    vi.mocked(connectDB).mockResolvedValueOnce(undefined);
    vi.mocked(startQueueWorkers).mockRejectedValueOnce(new Error("ECONNRESET"));
    const listenSpy = vi
      .spyOn(app, "listen")
      .mockImplementation(() => ({}) as unknown as ReturnType<typeof app.listen>);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await startServer();

    expect(listenSpy).toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
