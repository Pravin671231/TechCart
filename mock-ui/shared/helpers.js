// Shared read/format helpers over window.MOCK. Plain globals, no modules,
// so these work whether the page is opened via a static server or file://.
// Updated for the 2026-07-24 SRS v0.2 revision (Decisions #10-17): flat
// mrp/discount/sellingPrice, embedded product.variants, category/brand
// status + parentCategoryId, grouped categorySpecifications, categoryVariants.

(function () {
  const MOCK = window.MOCK;

  function computeSellingPrice(mrp, discount) {
    return mrp - Math.floor((mrp * discount) / 100);
  }

  function formatINR(paise) {
    return "₹" + Math.round(paise / 100).toLocaleString("en-IN");
  }

  function getBrandById(id) {
    return MOCK.brands.find((b) => b.id === id) || null;
  }

  function getBrandBySlug(slug) {
    return MOCK.brands.find((b) => b.slug === slug) || null;
  }

  // Buyer-facing brand list excludes status:false brands (FR-CAT-038, Decision #13) —
  // their products remain fully browsable, they just don't appear in filter/nav UI.
  function getBuyerVisibleBrands() {
    return MOCK.brands.filter((b) => b.status !== false);
  }

  function getCategoryById(id) {
    return MOCK.categories.find((c) => c.id === id) || null;
  }

  function getCategoryBySlug(slug) {
    return MOCK.categories.find((c) => c.slug === slug) || null;
  }

  // Admin-facing: every child regardless of status (FR-CAT-025 shows all categories).
  function getCategoryChildren(parentId) {
    return MOCK.categories.filter((c) => c.parentCategoryId === parentId);
  }

  function getTopLevelCategories() {
    return MOCK.categories.filter((c) => c.parentCategoryId === null);
  }

  // Buyer-facing: status:false categories are hidden from nav (FR-CAT-026, FR-CAT-063, Decision #13).
  function getBuyerVisibleCategoryChildren(parentId) {
    return getCategoryChildren(parentId).filter((c) => c.status !== false);
  }

  function getBuyerVisibleTopLevelCategories() {
    return getTopLevelCategories().filter((c) => c.status !== false);
  }

  // Breadcrumb path: [parent, category] if category has a parent, else [category].
  function getCategoryPath(categoryId) {
    const category = getCategoryById(categoryId);
    if (!category) return [];
    if (!category.parentCategoryId) return [category];
    const parent = getCategoryById(category.parentCategoryId);
    return parent ? [parent, category] : [category];
  }

  // A category "matches" a filter category if it IS that category or is one of its children
  // (mirrors FR-CAT-002: parent category listing includes its subcategories).
  function categoryMatches(productCategoryId, filterCategoryId) {
    if (!filterCategoryId) return true;
    if (productCategoryId === filterCategoryId) return true;
    const productCategory = getCategoryById(productCategoryId);
    return !!productCategory && productCategory.parentCategoryId === filterCategoryId;
  }

  // One grouped document per category (Decision #14) — no more enum type/options/filterable flag.
  function getSpecGroupsForCategory(categoryId) {
    const doc = MOCK.categorySpecifications.find((cs) => cs.categoryId === categoryId);
    return doc ? doc.specificationGroups : [];
  }

  // categoryVariants (Decision #15) — a UI-rendering guide only for admin-app's variant editor,
  // never validated server-side against product variant attributes.
  function getCategoryVariantTypes(categoryId) {
    const doc = MOCK.categoryVariants.find((cv) => cv.categoryId === categoryId);
    return doc ? doc.variants : [];
  }

  function getProductBySlug(slug) {
    return MOCK.products.find((p) => p.slug === slug) || null;
  }

  function getPublishedProducts() {
    return MOCK.products.filter((p) => p.status === "published");
  }

  // Variants are embedded on the product itself (Decision #10) — only `active` ones are
  // ever shown buyer-facing (FR-CAT-053 covers status inheritance separately).
  function getVariantsForProduct(productId) {
    const product = MOCK.products.find((p) => p.id === productId);
    return product ? (product.variants || []).filter((v) => v.active) : [];
  }

  // Queried directly against the embedded variants (FR-CAT-052) — no denormalized
  // availableVariantAttributes rollup anymore, since there's no separate collection
  // to avoid joining against (Decision #16).
  function getVariantAttributesForProduct(productId) {
    const variants = getVariantsForProduct(productId);
    const seen = new Set();
    const result = [];
    variants.forEach((v) => {
      v.attributes.forEach((attr) => {
        const key = attr.name + ":" + attr.value;
        if (!seen.has(key)) {
          seen.add(key);
          result.push(attr);
        }
      });
    });
    return result;
  }

  // The "display price" per FR-CAT-050/051: a variant product shows a
  // starting-from price (lowest active-variant sellingPrice); a simple
  // product shows its own price.
  function getDisplayPrice(product) {
    const variants = getVariantsForProduct(product.id);
    if (variants.length === 0) return { sellingPrice: product.sellingPrice, isStartingFrom: false };
    const lowest = variants.reduce((min, v) => (v.sellingPrice < min.sellingPrice ? v : min));
    return { sellingPrice: lowest.sellingPrice, isStartingFrom: true };
  }

  // Effective stock per FR-CAT-050: sum of active-variant stock when variants
  // exist, else the product's own stock.
  function getDisplayStock(product) {
    const variants = getVariantsForProduct(product.id);
    if (variants.length === 0) return product.stock;
    return variants.reduce((sum, v) => sum + v.stock, 0);
  }

  // Grouped spec display for the PDP (FR-CAT-044), matching the grouped categorySpecification
  // shape (Decision #14). Values are stored generically on the product (Mixed) — the unit
  // suffix (if any) is looked up from the category's spec definition, not the product itself.
  function getGroupedSpecDisplay(product) {
    const specDoc = MOCK.categorySpecifications.find((cs) => cs.categoryId === product.categoryId);
    return (product.specifications || []).map((group) => {
      const groupDef = specDoc ? specDoc.specificationGroups.find((g) => g.groupName === group.groupName) : null;
      const rows = group.values.map((v) => {
        const specDef = groupDef ? groupDef.specifications.find((s) => s.name === v.name) : null;
        const value = specDef && specDef.unit ? `${v.value} ${specDef.unit}` : v.value;
        return { name: v.name, value };
      });
      return { groupName: group.groupName, rows };
    });
  }

  // Minimal Levenshtein distance, used only for the fuzzy/typo-tolerant search fallback below.
  function levenshteinDistance(a, b) {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i].concat(Array(b.length).fill(0)));
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        dp[i][j] =
          a[i - 1] === b[j - 1]
            ? dp[i - 1][j - 1]
            : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
      }
    }
    return dp[a.length][b.length];
  }

  // Typo-tolerant fallback (FR-CAT-004, Decision #17c) — only consulted when no exact
  // partial match is found, so a close misspelling (e.g. "nimbis") still surfaces "Nimbus".
  function fuzzyIncludes(text, query) {
    if (!query) return false;
    return text.split(/\s+/).some((word) => {
      if (word.length < 3) return false;
      const maxDistance = word.length <= 5 ? 1 : 2;
      return levenshteinDistance(word, query) <= maxDistance;
    });
  }

  // Filters + sorts published products against the mock query shape used by
  // catalog/category/search pages.
  function filterAndSortProducts(opts) {
    const options = opts || {};
    let results = getPublishedProducts();

    if (options.categoryId) {
      results = results.filter((p) => categoryMatches(p.categoryId, options.categoryId));
    }
    if (options.brandId) {
      results = results.filter((p) => p.brandId === options.brandId);
    }
    if (options.query) {
      const q = options.query.trim().toLowerCase();
      if (q) {
        results = results.filter((p) => {
          const name = p.name.toLowerCase();
          const desc = p.description.toLowerCase();
          if (name.includes(q) || desc.includes(q)) return true;
          return fuzzyIncludes(name, q) || fuzzyIncludes(desc, q);
        });
      }
    }
    if (options.minPrice != null) {
      results = results.filter((p) => getDisplayPrice(p).sellingPrice >= options.minPrice);
    }
    if (options.maxPrice != null) {
      results = results.filter((p) => getDisplayPrice(p).sellingPrice <= options.maxPrice);
    }
    if (options.inStockOnly) {
      results = results.filter((p) => getDisplayStock(p) > 0);
    }
    // Note: filtering by a curated "filterable" specification (former FR-CAT-045) is
    // out of scope as of the 2026-07-24 revision (Decision #14) — intentionally not
    // supported here anymore.
    if (options.variantFilter) {
      results = results.filter((p) =>
        getVariantAttributesForProduct(p.id).some(
          (attr) => attr.name === options.variantFilter.name && attr.value === options.variantFilter.value,
        ),
      );
    }

    switch (options.sort) {
      case "price-asc":
        results = results.slice().sort((a, b) => getDisplayPrice(a).sellingPrice - getDisplayPrice(b).sellingPrice);
        break;
      case "price-desc":
        results = results.slice().sort((a, b) => getDisplayPrice(b).sellingPrice - getDisplayPrice(a).sellingPrice);
        break;
      case "newest":
        results = results.slice().reverse();
        break;
      default:
        break; // "relevance" — keep natural order (search.js applies its own relevance order)
    }

    return results;
  }

  window.MockHelpers = {
    computeSellingPrice,
    formatINR,
    getBrandById,
    getBrandBySlug,
    getBuyerVisibleBrands,
    getCategoryById,
    getCategoryBySlug,
    getCategoryChildren,
    getTopLevelCategories,
    getBuyerVisibleCategoryChildren,
    getBuyerVisibleTopLevelCategories,
    getCategoryPath,
    categoryMatches,
    getSpecGroupsForCategory,
    getCategoryVariantTypes,
    getProductBySlug,
    getPublishedProducts,
    getVariantsForProduct,
    getVariantAttributesForProduct,
    getDisplayPrice,
    getDisplayStock,
    getGroupedSpecDisplay,
    filterAndSortProducts,
  };
})();
