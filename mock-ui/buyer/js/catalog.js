// Catalog listing page (buyer/index.html) — FR-CAT-001, 004-010, 040, 052.
// Spec-facet filtering (former FR-CAT-045) was dropped from v0.2 scope on 2026-07-24
// (Decision #14) — there's no "filterable" flag left to curate facet-eligible specs.

(function () {
  const H = window.MockHelpers;
  const G = window.ProductGrid;

  const state = {
    categoryId: null,
    brandId: null,
    minPrice: null,
    maxPrice: null,
    variantFilter: null, // { name, value }
    sort: "relevance",
    page: 1,
    pageSize: 6,
    simulateError: false,
  };

  const gridEl = document.getElementById("grid-container");
  const paginationEl = document.getElementById("pagination-container");
  const resultCountEl = document.getElementById("result-count");

  function buildCategoryFilters() {
    const container = document.getElementById("filter-category");
    const items = [`<button data-cat="" class="filter-cat block w-full rounded px-2 py-1 text-left hover:bg-neutral-100">All categories</button>`];
    H.getBuyerVisibleTopLevelCategories().forEach((top) => {
      items.push(
        `<button data-cat="${top.id}" class="filter-cat block w-full rounded px-2 py-1 text-left font-medium hover:bg-neutral-100">${top.name}</button>`,
      );
      H.getBuyerVisibleCategoryChildren(top.id).forEach((child) => {
        items.push(
          `<button data-cat="${child.id}" class="filter-cat block w-full rounded px-2 py-1 pl-4 text-left text-neutral-600 hover:bg-neutral-100">${child.name}</button>`,
        );
      });
    });
    container.innerHTML = items.join("");
    container.querySelectorAll("button[data-cat]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.categoryId = btn.getAttribute("data-cat") || null;
        state.page = 1;
        highlightActive(container, "data-cat", state.categoryId || "");
        fetchAndRender();
      });
    });
    highlightActive(container, "data-cat", "");
  }

  function buildBrandFilters() {
    const container = document.getElementById("filter-brand");
    const items = [`<button data-brand="" class="filter-brand block w-full rounded px-2 py-1 text-left hover:bg-neutral-100">All brands</button>`];
    H.getBuyerVisibleBrands().forEach((brand) => {
      items.push(
        `<button data-brand="${brand.id}" class="filter-brand block w-full rounded px-2 py-1 text-left hover:bg-neutral-100">${brand.name}</button>`,
      );
    });
    container.innerHTML = items.join("");
    container.querySelectorAll("button[data-brand]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.brandId = btn.getAttribute("data-brand") || null;
        state.page = 1;
        highlightActive(container, "data-brand", state.brandId || "");
        fetchAndRender();
      });
    });
    highlightActive(container, "data-brand", "");
  }

  function highlightActive(container, attr, value) {
    container.querySelectorAll(`[${attr}]`).forEach((el) => {
      const isActive = el.getAttribute(attr) === value;
      el.classList.toggle("bg-neutral-900", isActive);
      el.classList.toggle("text-white", isActive);
    });
  }

  // Queried directly against embedded product.variants (Decision #10/#16) — no
  // denormalized rollup or separate productVariants collection anymore.
  function buildVariantFacets() {
    const container = document.getElementById("filter-variants");
    const groups = new Map();
    H.getPublishedProducts().forEach((p) => {
      H.getVariantAttributesForProduct(p.id).forEach((attr) => {
        if (!groups.has(attr.name)) groups.set(attr.name, new Set());
        groups.get(attr.name).add(attr.value);
      });
    });

    const sections = [];
    groups.forEach((values, name) => {
      const pills = Array.from(values)
        .map(
          (v) =>
            `<button data-attr-name="${name}" data-attr-value="${v}" class="variant-pill rounded-full border border-neutral-300 px-2 py-0.5 text-xs hover:bg-neutral-100">${v}</button>`,
        )
        .join(" ");
      sections.push(`<div><p class="mb-1 text-xs font-medium text-neutral-500">${name}</p><div class="flex flex-wrap gap-1">${pills}</div></div>`);
    });
    container.innerHTML = sections.join("");

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
    resultCountEl.textContent = "";
    paginationEl.innerHTML = "";

    window.setTimeout(() => {
      if (state.simulateError) {
        G.renderGrid(gridEl, { loading: false, error: true });
        return;
      }

      const allResults = H.filterAndSortProducts({
        categoryId: state.categoryId,
        brandId: state.brandId,
        minPrice: state.minPrice,
        maxPrice: state.maxPrice,
        variantFilter: state.variantFilter,
        sort: state.sort,
      });

      const start = (state.page - 1) * state.pageSize;
      const pageResults = allResults.slice(start, start + state.pageSize);

      resultCountEl.textContent = `${allResults.length} product${allResults.length === 1 ? "" : "s"}`;
      G.renderGrid(gridEl, {
        loading: false,
        error: false,
        products: pageResults,
        emptyMessage: "No products match your filters.",
      });
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
    }, 300);
  }

  document.getElementById("sort-select").addEventListener("change", (e) => {
    state.sort = e.target.value;
    state.page = 1;
    fetchAndRender();
  });

  document.getElementById("filter-min-price").addEventListener("change", (e) => {
    const val = e.target.value ? Number(e.target.value) * 100 : null; // rupees -> paise
    state.minPrice = val;
    state.page = 1;
    fetchAndRender();
  });

  document.getElementById("filter-max-price").addEventListener("change", (e) => {
    const val = e.target.value ? Number(e.target.value) * 100 : null;
    state.maxPrice = val;
    state.page = 1;
    fetchAndRender();
  });

  document.getElementById("simulate-error-btn").addEventListener("click", () => {
    state.simulateError = !state.simulateError;
    document.getElementById("simulate-error-btn").textContent = state.simulateError
      ? "Showing simulated error — click to reset"
      : "Simulate fetch error";
    fetchAndRender();
  });

  document.getElementById("clear-filters-btn").addEventListener("click", () => {
    state.categoryId = null;
    state.brandId = null;
    state.minPrice = null;
    state.maxPrice = null;
    state.variantFilter = null;
    state.sort = "relevance";
    state.page = 1;
    document.getElementById("filter-min-price").value = "";
    document.getElementById("filter-max-price").value = "";
    document.getElementById("sort-select").value = "relevance";
    buildCategoryFilters();
    buildBrandFilters();
    buildVariantFacets();
    fetchAndRender();
  });

  buildCategoryFilters();
  buildBrandFilters();
  buildVariantFacets();
  fetchAndRender();
})();
