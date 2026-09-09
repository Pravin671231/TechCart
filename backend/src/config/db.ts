import mongoose from "mongoose";
import { env } from "./env";

// FR-NFR-BE-002 / FR-NFR-BE-003 — explicit pool/timeout settings instead of
// driver defaults, plus `bufferCommands: false` so a query issued while the
// connection is down throws immediately (surfaced as 503 by the
// databaseReady middleware) rather than buffering until a client timeout.
// The MongoDB driver already handles automatic reconnection with its own
// exponential backoff; we don't hand-roll that — we observe it (the
// connection event listeners below) and stop buffering so requests fail fast
// during the gap.
function buildConnectOptions(
  overrides: mongoose.ConnectOptions,
): mongoose.ConnectOptions {
  return {
    maxPoolSize: env.MONGO.MAX_POOL_SIZE,
    minPoolSize: env.MONGO.MIN_POOL_SIZE,
    serverSelectionTimeoutMS: env.MONGO.SERVER_SELECTION_TIMEOUT_MS,
    socketTimeoutMS: env.MONGO.SOCKET_TIMEOUT_MS,
    bufferCommands: false,
    // retryWrites / retryReads are driver-default `true` already — not re-set.
    ...overrides,
  };
}

// Flipped `true` the first time a connection is established and never reset.
// The databaseReady middleware only returns 503 once this is true, so the
// large body of mock-based Supertest suites (which never call connectDB) is
// unaffected — for them the gate is a pass-through.
let hasConnectedOnce = false;

let listenersRegistered = false;

function registerConnectionListeners(): void {
  if (listenersRegistered) return;
  listenersRegistered = true;

  const connection = mongoose.connection;

  connection.on("connected", () => {
    hasConnectedOnce = true;
    console.log("MongoDB connected");
  });
  connection.on("reconnected", () => {
    console.log("MongoDB reconnected");
  });
  connection.on("disconnected", () => {
    console.error("MongoDB disconnected — requests will fail fast with 503 until it recovers");
  });
  connection.on("error", (error: unknown) => {
    console.error("MongoDB connection error:", error);
  });
}

export async function connectDB(options: mongoose.ConnectOptions = {}): Promise<void> {
  registerConnectionListeners();

  try {
    const uri = env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is not set");

    await mongoose.connect(uri, buildConnectOptions(options));
    // The "connected" event above also sets this, but set it here too so a
    // caller that awaits connectDB() can rely on it synchronously afterwards.
    hasConnectedOnce = true;
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    throw error;
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}

// FR-NFR-BE-003 — `true` only when a live connection exists and is usable.
// readyState: 0 disconnected, 1 connected, 2 connecting, 3 disconnecting.
export function isDatabaseAvailable(): boolean {
  return mongoose.connection.readyState === 1;
}

// FR-NFR-BE-003 — used by the databaseReady middleware to decide whether to
// fail fast. Only reports unavailable once a connection has been established
// at least once, so it never trips for a process that legitimately runs
// without a DB (the mock-based test suites).
export function isDatabaseGateTripped(): boolean {
  return hasConnectedOnce && !isDatabaseAvailable();
}

// Test-only: resets the module-level connection flag between suites.
export function resetDatabaseConnectionState(): void {
  hasConnectedOnce = false;
}
