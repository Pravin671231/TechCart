import { Types } from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AddressRecord } from "../addresses.repository";

vi.mock("../addresses.repository", () => ({
  create: vi.fn(),
  findByUser: vi.fn(),
  findOwned: vi.fn(),
  updateOwned: vi.fn(),
  deleteOwned: vi.fn(),
  findDefaultForUser: vi.fn(),
  clearDefaultForUser: vi.fn(),
  setDefaultOwned: vi.fn(),
}));

import * as addressesRepository from "../addresses.repository";
import {
  addAddress,
  deleteAddress,
  getDefaultAddress,
  getOwnedAddress,
  listAddresses,
  setDefaultAddress,
  updateAddress,
} from "../addresses.service";

const userId = new Types.ObjectId().toString();
const addressId = new Types.ObjectId().toString();

function makeAddress(overrides: Partial<AddressRecord> = {}): AddressRecord {
  return {
    _id: new Types.ObjectId(addressId),
    user: new Types.ObjectId(userId),
    fullName: "Asha Rao",
    phone: "9876543210",
    line1: "221B, Residency Road",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560025",
    isDefault: false,
    ...overrides,
  } as AddressRecord;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("listAddresses", () => {
  it("delegates to findByUser", async () => {
    const addresses = [makeAddress()];
    vi.mocked(addressesRepository.findByUser).mockResolvedValue(addresses);

    await expect(listAddresses(userId)).resolves.toBe(addresses);
    expect(addressesRepository.findByUser).toHaveBeenCalledWith(new Types.ObjectId(userId));
  });
});

describe("addAddress", () => {
  it("creates an address for the given buyer", async () => {
    const created = makeAddress();
    vi.mocked(addressesRepository.create).mockResolvedValue(created);

    const input = {
      fullName: "Asha Rao",
      phone: "9876543210",
      line1: "221B, Residency Road",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560025",
    };
    await expect(addAddress(userId, input)).resolves.toBe(created);
    expect(addressesRepository.create).toHaveBeenCalledWith(new Types.ObjectId(userId), input);
  });
});

describe("getOwnedAddress / FR-ORD-030", () => {
  it("returns the owned address", async () => {
    const address = makeAddress();
    vi.mocked(addressesRepository.findOwned).mockResolvedValue(address);

    await expect(getOwnedAddress(userId, addressId)).resolves.toBe(address);
  });

  it("throws ADDRESS_NOT_FOUND for a non-owned or nonexistent id — same error either way", async () => {
    vi.mocked(addressesRepository.findOwned).mockResolvedValue(null);

    await expect(getOwnedAddress(userId, addressId)).rejects.toMatchObject({
      statusCode: 404,
      code: "ADDRESS_NOT_FOUND",
    });
  });
});

describe("getDefaultAddress / FR-ORD-033", () => {
  it("returns null (not an error) when the buyer has no default", async () => {
    vi.mocked(addressesRepository.findDefaultForUser).mockResolvedValue(null);

    await expect(getDefaultAddress(userId)).resolves.toBeNull();
  });
});

describe("updateAddress", () => {
  it("throws ADDRESS_NOT_FOUND when updateOwned finds nothing", async () => {
    vi.mocked(addressesRepository.updateOwned).mockResolvedValue(null);

    await expect(updateAddress(userId, addressId, { city: "Mumbai" })).rejects.toMatchObject({
      statusCode: 404,
      code: "ADDRESS_NOT_FOUND",
    });
  });
});

describe("deleteAddress", () => {
  it("throws ADDRESS_NOT_FOUND when deleteOwned finds nothing", async () => {
    vi.mocked(addressesRepository.deleteOwned).mockResolvedValue(null);

    await expect(deleteAddress(userId, addressId)).rejects.toMatchObject({
      statusCode: 404,
      code: "ADDRESS_NOT_FOUND",
    });
  });
});

describe("setDefaultAddress / FR-ORD-031", () => {
  it("clears the previous default before setting the new one, in order", async () => {
    const owned = makeAddress();
    const updated = makeAddress({ isDefault: true });
    vi.mocked(addressesRepository.findOwned).mockResolvedValue(owned);
    vi.mocked(addressesRepository.setDefaultOwned).mockResolvedValue(updated);

    const calls: string[] = [];
    vi.mocked(addressesRepository.clearDefaultForUser).mockImplementation(async () => {
      calls.push("clear");
    });
    vi.mocked(addressesRepository.setDefaultOwned).mockImplementation(async () => {
      calls.push("set");
      return updated;
    });

    const result = await setDefaultAddress(userId, addressId);

    expect(result).toBe(updated);
    expect(calls).toEqual(["clear", "set"]);
  });

  it("throws ADDRESS_NOT_FOUND for a non-owned id without touching the buyer's default", async () => {
    vi.mocked(addressesRepository.findOwned).mockResolvedValue(null);

    await expect(setDefaultAddress(userId, addressId)).rejects.toMatchObject({
      statusCode: 404,
      code: "ADDRESS_NOT_FOUND",
    });
    expect(addressesRepository.clearDefaultForUser).not.toHaveBeenCalled();
  });
});
