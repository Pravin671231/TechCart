import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PRODUCTS_SEARCH_INDEX,
  PRODUCTS_SEARCH_INDEX_DEFINITION,
} from "../products.searchIndex";

// The checked-in JSON artifact is what a human pastes into the Atlas Console
// (backend/atlas-search/README.md) when not using `npm run search:ensure`.
// products.searchIndex.ts is the actual source of truth (imported by the
// script and the repository). This test fails if the two drift.
describe("products-search-index.json artifact", () => {
  const jsonPath = join(process.cwd(), "atlas-search", "products-search-index.json");

  it("exists", () => {
    expect(existsSync(jsonPath)).toBe(true);
  });

  it("matches PRODUCTS_SEARCH_INDEX / PRODUCTS_SEARCH_INDEX_DEFINITION", () => {
    const artifact = JSON.parse(readFileSync(jsonPath, "utf8")) as {
      name: string;
      definition: unknown;
    };
    expect(artifact.name).toBe(PRODUCTS_SEARCH_INDEX);
    expect(artifact.definition).toEqual(
      JSON.parse(JSON.stringify(PRODUCTS_SEARCH_INDEX_DEFINITION)),
    );
  });
});
