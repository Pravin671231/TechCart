import type { Express } from "express";
import type mongooseType from "mongoose";
import type { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootstrapMemoryMongo, teardownMemoryMongo } from "../testHelpers/adminSession";

// FR-NFR-BE-003 — a lost MongoDB connection must make requests fail fast with
// a specific 503, not hang until a client-side timeout, and must recover on
// its own once the connection is back (no server restart).

describe("database resilience — 503 on a lost connection, recovery on reconnect", () => {
  let mongod: MongoMemoryServer;
  let mongoose: typeof mongooseType;
  let app: Express;
  let uri: string;

  beforeAll(async () => {
    const ctx = await bootstrapMemoryMongo();
    mongod = ctx.mongod;
    mongoose = ctx.mongoose;
    app = ctx.app;
    uri = mongod.getUri();
  });

  afterAll(async () => {
    await teardownMemoryMongo({ mongod, mongoose, app });
  });

  it("serves a normal request while connected", async () => {
    const res = await request(app).get("/api/products");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("fails fast with 503 DATABASE_UNAVAILABLE while the connection is down", async () => {
    await mongoose.connection.close();

    const start = Date.now();
    const res = await request(app).get("/api/products");
    const elapsed = Date.now() - start;

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ success: false, code: "DATABASE_UNAVAILABLE" });
    // The whole point: it must not have hung waiting on a driver timeout.
    expect(elapsed).toBeLessThan(2000);
  });

  it("still answers /health while the database is down", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
  });

  it("recovers automatically once the connection is re-established", async () => {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 60000 });

    const res = await request(app).get("/api/products");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
