// Category page (buyer/category.html?slug=...) — FR-CAT-002, 052.
// Spec-facet filtering (former FR-CAT-045) was dropped from v0.2 scope on 2026-07-24
// (Decision #14) — there's no "filterable" flag left to curate facet-eligible specs.

(function () {
  const H = window.MockHelpers;
  const G = window.ProductGrid;

  const params = new URLSearchParams(window.location.search);
  const category = H.getCategoryBySlug(params.get("slug") || "");

  if (!category) {
    document.getElementById("not-found").classList.remove("hidden");
    document.getElementById("category-content").classList.add("hidden");
    document.getElementById("category-title").textContent = "";
    return;
  }

  // Categories "in scope" for facets: the category itself, plus its
  // children if it's a top-level category (two-level hierarchy, FR-CAT-021).
  const scopeIds = category.parentCategoryId
    ? [category.id]
    : [category.id, ...H.getCategoryChildren(category.id).map((c) => c.id)];

  const state = {
    brandId: null,
    minPrice: null,
    maxPrice: null,
    variantFilter: null,
    sort: "relevance",
    page: 1,
    pageSize: 6,
  };

  const gridEl = document.getElementById("grid-container");
  const paginationEl = document.getElementById("pagination-container");
  const resultCountEl = document.getElementById("result-count");

  function renderBreadcrumb() {
    const path = H.getCategoryPath(category.id);
    const crumbs = [`<a href="index.html" class="hover:underline">Home</a>`];
    path.forEach((c, i) => {
      const isLast = i === path.length - 1;
      crumbs.push(
        isLast
          ? `<span class="text-neutral-900">${c.name}</span>`
          : `<a href="category.html?slug=${encodeURIComponent(c.slug)}" class="hover:underline">${c.name}</a>`,
      );
    });
    document.getElementById("breadcrumb").innerHTML = crumbs.join(' <span class="mx-1">/</span> ');
    document.getElementById("category-title").textContent = category.name;
  }

  function buildBrandFilters() {
    const container = document.getElementById("filter-brand");
    const items = [`<button data-brand="" class="block w-full rounded px-2 py-1 text-left hover:bg-neutral-100">All brands</button>`];
    H.getBuyerVisibleBrands().forEach((brand) => {
      items.push(`<button data-brand="${brand.id}" class="block w-full rounded px-2 py-1 text-left hover:bg-neutral-100">${brand.name}</button>`);
    });
    container.innerHTML = items.join("");
    container.querySelectorAll("button[data-brand]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.brandId = btn.getAttribute("data-brand") || null;
        state.page = 1;
        container.querySelectorAll("button[data-brand]").forEach((b) => b.classList.remove("bg-neutral-900", "text-white"));
        btn.classList.add("bg-neutral-900", "text-white");
        fetchAndRender();
      });
    });
  }

  // Queried directly against embedded product.variants (Decision #10/#16) — no
  // denormalized rollup or separate productVariants collection anymore.
  function buildVariantFacets() {
    const container = document.getElementById("filter-variants");
    const productsInScope = window.MOCK.products.filter((p) => scopeIds.includes(p.categoryId));
    const groups = new Map();
    productsInScope.forEach((p) => {
      H.getVariantAttributesForProduct(p.id).forEach((attr) => {
        if (!groups.has(attr.name)) groups.set(attr.name, new Set());
        groups.get(attr.name).add(attr.value);
      });
    });

    const sections = [];
    groups.forEach((values, name) => {
      const pills = Array.from(values)
        .map((v) => `<button data-attr-name="${name}" data-attr-value="${v}" class="variant-pill rounded-full border border-neutral-300 px-2 py-0.5 text-xs hover:bg-neutral-100">${v}</button>`)
        .join(" ");
      sections.push(`<div><p class="mb-1 text-xs font-medium text-neutral-500">${name}</p><div class="flex flex-wrap gap-1">${pills}</div></div>`);
    });
    container.innerHTML = sections.join("") || `<p class="text-xs text-neutral-400">None for this category.</p>`;

    container.querySelectorAll("button.variant-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        const name = btn.getAttribute("data-attr-name");
        const value = btn.getAttribute("data-attr-value");
        const isSame = state.variantFilter && state.variantFilter.name === name && state.variantFilter.value === value;
        state.variantFilter = isSame ? null : { name, value };
        state.page = 1;
        container.querySelectorAll("button.variant-pill").forEach((b) => b.classList.remove("bg-neutral-900", "text-white"));
        if (!isSame) btn.classList.add("bg-neutral-900", "text-white");
        fetchAndRender();
      });
    });
  }

  function fetchAndRender() {
    G.renderGrid(gridEl, { loading: true });
    window.setTimeout(() => {
      const allResults = H.filterAndSortProducts({
        categoryId: category.id,
        brandId: state.brandId,
        minPrice: state.minPrice,
        maxPrice: state.maxPrice,
        variantFilter: state.variantFilter,
        sort: state.sort,
      });
      const start = (state.page - 1) * state.pageSize;
      const pageResults = allResults.slice(start, start + state.pageSize);
      resultCountEl.textContent = `${allResults.length} product${allResults.length === 1 ? "" : "s"} in ${category.name}`;
      G.renderGrid(gridEl, { loading: false, products: pageResults, emptyMessage: "No products match your filters in this category." });
      G.renderPagination(paginationEl, {
        page: state.page,
        pageSize: state.pageSize,
        total: allResults.length,
        onPageChange: (page) => {
          state.page = page;
          fetchAndRender();
          window.scrollTo({ top: 0, behavior: "smooth" });
        },
      });
    }, 250);
  }

  document.getElementById("sort-select").addEventListener("change", (e) => {
    state.sort = e.target.value;
    state.page = 1;
    fetchAndRender();
  });
  document.getElementById("filter-min-price").addEventListener("change", (e) => {
    state.minPrice = e.target.value ? Number(e.target.value) * 100 : null;
    state.page = 1;
    fetchAndRender();
  });
  document.getElementById("filter-max-price").addEventListener("change", (e) => {
    state.maxPrice = e.target.value ? Number(e.target.value) * 100 : null;
    state.page = 1;
    fetchAndRender();
  });

  renderBreadcrumb();
  buildBrandFilters();
  buildVariantFacets();
  fetchAndRender();
})();
