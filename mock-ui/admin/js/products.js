// Admin product list (admin/index.html) — FR-CAT-017.

(function () {
  const H = window.MockHelpers;
  const MOCK = window.MOCK;

  const state = { query: "", status: "", page: 1, pageSize: 6 };

  const rowsEl = document.getElementById("product-rows");
  const paginationEl = document.getElementById("pagination-container");
  const resultCountEl = document.getElementById("result-count");

  function statusBadge(status) {
    const styles = {
      draft: "bg-neutral-100 text-neutral-600",
      published: "bg-emerald-100 text-emerald-700",
      archived: "bg-red-100 text-red-700",
    };
    return `<span class="rounded px-2 py-0.5 text-xs font-medium ${styles[status]}">${status}</span>`;
  }

  function render() {
    // Admin grid shows every status, unlike the buyer-facing endpoints (FR-CAT-017 vs FR-CAT-009).
    let results = MOCK.products.slice();

    if (state.status) results = results.filter((p) => p.status === state.status);
    if (state.query) {
      const q = state.query.trim().toLowerCase();
      results = results.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }

    resultCountEl.textContent = `${results.length} product${results.length === 1 ? "" : "s"}`;

    const start = (state.page - 1) * state.pageSize;
    const pageResults = results.slice(start, start + state.pageSize);

    if (pageResults.length === 0) {
      rowsEl.innerHTML = `<tr><td colspan="9" class="px-3 py-8 text-center text-neutral-400">No products match this search/filter.</td></tr>`;
    } else {
      rowsEl.innerHTML = pageResults
        .map((p) => {
          const brand = H.getBrandById(p.brandId);
          const category = H.getCategoryById(p.categoryId);
          const display = H.getDisplayPrice(p);
          const stock = H.getDisplayStock(p);
          const variantCount = H.getVariantsForProduct(p.id).length;
          return `
            <tr class="border-b border-neutral-100 last:border-0">
              <td class="px-3 py-2"><div class="flex h-10 w-10 items-center justify-center rounded bg-neutral-100 text-[10px] text-neutral-400">IMG</div></td>
              <td class="px-3 py-2">
                <p class="font-medium">${p.name}</p>
                ${variantCount > 0 ? `<p class="text-xs text-neutral-400">${variantCount} variant${variantCount === 1 ? "" : "s"}</p>` : ""}
              </td>
              <td class="px-3 py-2 text-neutral-500">${p.sku}</td>
              <td class="px-3 py-2">${brand ? brand.name : "—"}</td>
              <td class="px-3 py-2">${category ? category.name : "—"}</td>
              <td class="px-3 py-2">${display.isStartingFrom ? "From " : ""}${H.formatINR(display.sellingPrice)}</td>
              <td class="px-3 py-2 ${stock === 0 ? "text-red-600" : ""}">${stock}</td>
              <td class="px-3 py-2">${statusBadge(p.status)}</td>
              <td class="px-3 py-2 text-right">
                <a href="product-detail.html?id=${p.id}" class="mr-3 text-sm text-neutral-600 underline hover:text-neutral-900">View</a>
                <a href="product-form.html?id=${p.id}" class="text-sm text-neutral-600 underline hover:text-neutral-900">Edit</a>
              </td>
            </tr>
          `;
        })
        .join("");
    }

    window.ProductGrid.renderPagination(paginationEl, {
      page: state.page,
      pageSize: state.pageSize,
      total: results.length,
      onPageChange: (page) => {
        state.page = page;
        render();
      },
    });
  }

  document.getElementById("search-box").addEventListener("input", (e) => {
    state.query = e.target.value;
    state.page = 1;
    render();
  });
  document.getElementById("status-filter").addEventListener("change", (e) => {
    state.status = e.target.value;
    state.page = 1;
    render();
  });

  render();
})();
