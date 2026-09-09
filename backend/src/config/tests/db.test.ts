import { afterEach, describe, expect, it, vi } from "vitest";

const { connectMock, onMock, connectionState } = vi.hoisted(() => ({
  connectMock: vi.fn().mockResolvedValue(undefined),
  onMock: vi.fn(),
  connectionState: { readyState: 0 },
}));

vi.mock("mongoose", () => ({
  default: {
    connect: connectMock,
    disconnect: vi.fn().mockResolvedValue(undefined),
    get connection() {
      return { on: onMock, readyState: connectionState.readyState };
    },
  },
}));

import {
  connectDB,
  isDatabaseAvailable,
  isDatabaseGateTripped,
  resetDatabaseConnectionState,
} from "@/config/db";

describe("connectDB", () => {
  afterEach(() => {
    connectMock.mockClear();
    connectionState.readyState = 0;
    resetDatabaseConnectionState();
  });

  it("passes explicit pool and timeout options to mongoose.connect", async () => {
    await connectDB();

    expect(connectMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        maxPoolSize: 10,
        minPoolSize: 0,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        bufferCommands: false,
      }),
    );
  });

  it("lets a caller-supplied option override the default", async () => {
    await connectDB({ serverSelectionTimeoutMS: 60000 });

    expect(connectMock).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ serverSelectionTimeoutMS: 60000, maxPoolSize: 10 }),
    );
  });

  it("registers connection event listeners", async () => {
    await connectDB();

    const events = onMock.mock.calls.map((call) => call[0]);
    expect(events).toEqual(expect.arrayContaining(["connected", "disconnected", "reconnected", "error"]));
  });
});

describe("isDatabaseAvailable / isDatabaseGateTripped", () => {
  afterEach(() => {
    connectionState.readyState = 0;
    resetDatabaseConnectionState();
  });

  it("reports unavailable before any connection", () => {
    expect(isDatabaseAvailable()).toBe(false);
    // Never connected → the gate stays open (pass-through) so mock-based
    // suites are unaffected.
    expect(isDatabaseGateTripped()).toBe(false);
  });

  it("trips the gate once connected and then dropped", async () => {
    connectionState.readyState = 1;
    await connectDB();
    expect(isDatabaseGateTripped()).toBe(false);

    connectionState.readyState = 0;
    expect(isDatabaseGateTripped()).toBe(true);
  });
});
