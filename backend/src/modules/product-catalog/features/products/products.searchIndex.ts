// Single source of truth for the Atlas Search index backing the buyer-facing
// variant-attribute (FR-CAT-071) and filterable-specification (FR-CAT-072)
// filters on GET /api/products — see searchPublicPaginated / buildSearchFilters
// in products.repository.ts, which are the only query path that emits a
// `$search` aggregation stage.
//
// Provisioned by `npm run search:ensure --workspace backend`
// (src/scripts/searchIndexes/ensureSearchIndexes.ts), which is idempotent and
// runs against any Atlas cluster (a free M0 for local dev / CI, the real
// cluster in production). `$search` does not work against community/self-hosted
// MongoDB at all — see backend/atlas-search/README.md.
//
// backend/atlas-search/products-search-index.json mirrors this definition
// verbatim for manual Atlas Console provisioning; a unit test
// (tests/products.searchIndex.test.ts) asserts the two never drift.

export const PRODUCTS_SEARCH_INDEX = "products_search";

// The `definition` half of a Node-driver SearchIndexDescription
// (`{ name, definition }`). `dynamic: false` throughout — only these
// explicitly-mapped fields are searchable/filterable. `embeddedDocuments` is
// what lets a name+value pair be matched against the *same* array element
// (the `embeddedDocument` query operator in buildSearchFilters), which a
// plain query's top-level match can't express.
export const PRODUCTS_SEARCH_INDEX_DEFINITION = {
  mappings: {
    dynamic: false,
    fields: {
      name: { type: "string" },
      description: { type: "string" },
      variants: {
        type: "embeddedDocuments",
        fields: {
          active: { type: "boolean" },
          attributes: {
            type: "embeddedDocuments",
            fields: {
              name: { type: "token" },
              value: { type: "token" },
            },
          },
        },
      },
      specifications: {
        type: "embeddedDocuments",
        fields: {
          groupName: { type: "token" },
          values: {
            type: "embeddedDocuments",
            fields: {
              name: { type: "token" },
              value: [{ type: "token" }, { type: "number" }, { type: "boolean" }],
            },
          },
        },
      },
    },
  },
};
