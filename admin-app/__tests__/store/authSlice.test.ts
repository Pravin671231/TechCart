import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import reducer, { ADMIN_KEY_STORAGE_KEY, clearAdminKey, setAdminKey } from "@/store/authSlice";

describe("authSlice", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it("setAdminKey stores the key in state and sessionStorage", () => {
    const state = reducer(undefined, setAdminKey("my-key"));
    expect(state.adminKey).toBe("my-key");
    expect(sessionStorage.getItem(ADMIN_KEY_STORAGE_KEY)).toBe("my-key");
  });

  it("clearAdminKey nulls state and removes it from sessionStorage", () => {
    const withKey = reducer(undefined, setAdminKey("my-key"));
    const cleared = reducer(withKey, clearAdminKey());
    expect(cleared.adminKey).toBeNull();
    expect(sessionStorage.getItem(ADMIN_KEY_STORAGE_KEY)).toBeNull();
  });

  it("hydrates adminKey from sessionStorage on module load", async () => {
    sessionStorage.setItem(ADMIN_KEY_STORAGE_KEY, "seeded-key");
    vi.resetModules();
    const { default: freshReducer } = await import("@/store/authSlice");
    expect(freshReducer(undefined, { type: "@@INIT" }).adminKey).toBe("seeded-key");
  });
});
