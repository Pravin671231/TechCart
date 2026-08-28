import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";

// M5 / Issue #154 — addresses' endpoints are gated by rbac(["buyer"]), which
// needs a real session to resolve, and the partial-unique-default index
// (FR-ORD-031) is a real DB-level invariant worth exercising end to end
// rather than mocking the repository — same rationale cart's own Supertest
// suite documents.
vi.mock("@/externalService/mailer", () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
}));

import {
  bootstrapMemoryMongo,
  teardownMemoryMongo,
  signInBuyer,
  authRequest,
  type MemoryMongoContext,
} from "../../testHelpers/adminSession";

const BUYER_EMAIL = "addresses-buyer@example.com";
const OTHER_BUYER_EMAIL = "addresses-other-buyer@example.com";

let ctx: MemoryMongoContext;
let app: Express;
let token: string;
let otherToken: string;

const validAddress = {
  fullName: "Asha Rao",
  phone: "9876543210",
  line1: "221B, Residency Road",
  city: "Bengaluru",
  state: "Karnataka",
  pincode: "560025",
};

beforeAll(async () => {
  ctx = await bootstrapMemoryMongo();
  app = ctx.app;
  token = await signInBuyer(app, BUYER_EMAIL);
  otherToken = await signInBuyer(app, OTHER_BUYER_EMAIL);
}, 60000);

afterAll(async () => {
  await teardownMemoryMongo(ctx);
});

beforeEach(async () => {
  await ctx.mongoose.connection.db!.collection("addresses").deleteMany({});
});

afterEach(() => {
  vi.clearAllMocks();
});

function addrReq(method: "get" | "post" | "patch" | "delete", url: string) {
  return authRequest(app, method, url, token);
}

describe("auth gating", () => {
  it("rejects every address endpoint with no session", async () => {
    for (const [method, url] of [
      ["get", "/api/addresses"],
      ["post", "/api/addresses"],
      ["patch", "/api/addresses/000000000000000000000000"],
      ["delete", "/api/addresses/000000000000000000000000"],
      ["patch", "/api/addresses/000000000000000000000000/default"],
    ] as const) {
      const res = await request(app)[method](url);
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ success: false, code: "UNAUTHENTICATED" });
    }
  });
});

describe("POST /api/addresses (FR-ORD-028)", () => {
  it("adds an address for the signed-in buyer, isDefault false", async () => {
    const res = await addrReq("post", "/api/addresses").send(validAddress);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ ...validAddress, isDefault: false });
  });

  it("rejects a malformed PIN code", async () => {
    const res = await addrReq("post", "/api/addresses").send({ ...validAddress, pincode: "12AB" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a PIN code starting with 0", async () => {
    const res = await addrReq("post", "/api/addresses").send({
      ...validAddress,
      pincode: "012345",
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /api/addresses (FR-ORD-029)", () => {
  it("lists only the signed-in buyer's own addresses, newest first", async () => {
    await addrReq("post", "/api/addresses").send(validAddress);
    await addrReq("post", "/api/addresses").send({ ...validAddress, city: "Mumbai" });
    await authRequest(app, "post", "/api/addresses", otherToken).send(validAddress);

    const res = await addrReq("get", "/api/addresses");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].city).toBe("Mumbai");
  });
});

describe("PATCH /api/addresses/:id and DELETE (FR-ORD-030)", () => {
  it("updates the buyer's own address", async () => {
    const created = await addrReq("post", "/api/addresses").send(validAddress);
    const id = created.body.data._id;

    const res = await addrReq("patch", `/api/addresses/${id}`).send({ city: "Chennai" });

    expect(res.status).toBe(200);
    expect(res.body.data.city).toBe("Chennai");
  });

  it("deletes the buyer's own address", async () => {
    const created = await addrReq("post", "/api/addresses").send(validAddress);
    const id = created.body.data._id;

    const res = await addrReq("delete", `/api/addresses/${id}`);
    expect(res.status).toBe(200);

    const list = await addrReq("get", "/api/addresses");
    expect(list.body.data).toHaveLength(0);
  });

  it("returns the identical not-found error for another buyer's address id as for a nonexistent one", async () => {
    const created = await authRequest(app, "post", "/api/addresses", otherToken).send(validAddress);
    const otherId = created.body.data._id;

    const patchRes = await addrReq("patch", `/api/addresses/${otherId}`).send({ city: "Pune" });
    const nonexistentRes = await addrReq("patch", "/api/addresses/000000000000000000000000").send({
      city: "Pune",
    });

    expect(patchRes.status).toBe(404);
    expect(patchRes.body.code).toBe("ADDRESS_NOT_FOUND");
    expect(nonexistentRes.status).toBe(404);
    expect(nonexistentRes.body.code).toBe("ADDRESS_NOT_FOUND");

    const deleteRes = await addrReq("delete", `/api/addresses/${otherId}`);
    expect(deleteRes.status).toBe(404);
    expect(deleteRes.body.code).toBe("ADDRESS_NOT_FOUND");
  });
});

describe("PATCH /api/addresses/:id/default (FR-ORD-031)", () => {
  it("sets exactly one default, clearing a previous default", async () => {
    const first = await addrReq("post", "/api/addresses").send(validAddress);
    const second = await addrReq("post", "/api/addresses").send({
      ...validAddress,
      city: "Mumbai",
    });

    await addrReq("patch", `/api/addresses/${first.body.data._id}/default`);
    const setSecond = await addrReq("patch", `/api/addresses/${second.body.data._id}/default`);

    expect(setSecond.status).toBe(200);
    expect(setSecond.body.data.isDefault).toBe(true);

    const list = await addrReq("get", "/api/addresses");
    const defaults = list.body.data.filter((a: { isDefault: boolean }) => a.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0]._id).toBe(second.body.data._id);
  });

  it("leaves no default set after deleting the current default", async () => {
    const created = await addrReq("post", "/api/addresses").send(validAddress);
    const id = created.body.data._id;
    await addrReq("patch", `/api/addresses/${id}/default`);

    await addrReq("delete", `/api/addresses/${id}`);

    const list = await addrReq("get", "/api/addresses");
    expect(list.body.data.every((a: { isDefault: boolean }) => !a.isDefault)).toBe(true);
  });

  it("404s for another buyer's address id", async () => {
    const created = await authRequest(app, "post", "/api/addresses", otherToken).send(validAddress);
    const otherId = created.body.data._id;

    const res = await addrReq("patch", `/api/addresses/${otherId}/default`);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("ADDRESS_NOT_FOUND");
  });
});
