// Admin product list — every status visible (FR-CAT-017), unlike any
// buyer-facing endpoint. Built to docs/ui/admin/product-catalog.md section 3.1: sortable
// columns, the product name links to the preview page, pagination below.

(function () {
  const H = window.MockHelpers;
  const T = window.AdminTable;

  const headRow = document.getElementById("product-head");
  const tbody = document.getElementById("product-rows");
  const searchBox = document.getElementById("search-box");
  const statusFilter = document.getElementById("status-filter");
  const resultCount = document.getElementById("result-count");
  const pagination = document.getElementById("pagination-container");

  const COLUMNS = [
    { key: null, label: "Image", sortable: false },
    { key: "name", label: "Name", sortable: true },
    { key: "sku", label: "SKU", sortable: true },
    { key: "brand", label: "Brand", sortable: true },
    { key: "category", label: "Category", sortable: true },
    { key: "price", label: "Price", sortable: true },
    { key: "stock", label: "Stock", sortable: true },
    { key: "status", label: "Status", sortable: true },
    { key: null, label: "Actions", sortable: false },
  ];

  const SORT_ACCESSORS = {
    name: (p) => p.name,
    sku: (p) => p.sku,
    brand: (p) => (H.getBrandById(p.brandId) || {}).name || "",
    category: (p) => (H.getCategoryById(p.categoryId) || {}).name || "",
    price: (p) => H.getDisplayPrice(p).sellingPrice,
    stock: (p) => H.getDisplayStock(p),
    status: (p) => p.status,
  };

  // The header search submits ?q=, so a search result is a linkable URL
  // (docs/ui/admin/admin-main-ui.md section 5.1).
  const params = new URLSearchParams(window.location.search);

  const state = {
    query: params.get("q") || "",
    status: "",
    sort: { key: null, dir: null },
    page: 1,
    pageSize: 10,
  };

  searchBox.value = state.query;

  function filtered() {
    const q = state.query.trim().toLowerCase();
    let rows = window.MOCK.products.slice();
    if (q) {
      rows = rows.filter(
        (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
      );
    }
    if (state.status) {
      rows = rows.filter((p) => p.status === state.status);
    }
    return T.applySort(rows, state.sort, SORT_ACCESSORS);
  }

  function row(product) {
    const brand = H.getBrandById(product.brandId);
    const category = H.getCategoryById(product.categoryId);
    const display = H.getDisplayPrice(product);
    const stock = H.getDisplayStock(product);
    const variantCount = H.getVariantsForProduct(product.id).length;

    return `
      <tr class="border-b border-neutral-100 last:border-0 dark:border-slate-800">
        <td class="px-3 py-2">
          <div class="flex h-10 w-10 items-center justify-center rounded bg-neutral-100 text-[10px] text-neutral-400 dark:bg-slate-800 dark:text-slate-500">IMG</div>
        </td>
        <td class="px-3 py-2">
          <a
            href="product-detail.html?id=${encodeURIComponent(product.id)}"
            class="font-medium text-indigo-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:text-indigo-400"
          >${product.name}</a>
          ${variantCount > 0 ? `<p class="text-xs text-neutral-400 dark:text-slate-500">${variantCount} variants</p>` : ""}
        </td>
        <td class="px-3 py-2 text-neutral-600 dark:text-slate-400">${product.sku}</td>
        <td class="px-3 py-2 text-neutral-600 dark:text-slate-400">${brand ? brand.name : "—"}</td>
        <td class="px-3 py-2 text-neutral-600 dark:text-slate-400">${category ? category.name : "—"}</td>
        <td class="px-3 py-2">${display.isStartingFrom ? "From " : ""}${H.formatINR(display.sellingPrice)}</td>
        <td class="px-3 py-2 ${stock === 0 ? "text-red-600 dark:text-red-400" : ""}">${stock}</td>
        <td class="px-3 py-2">${T.statusBadge(product.status)}</td>
        <td class="px-3 py-2">
          <a href="product-form.html?id=${encodeURIComponent(product.id)}" class="text-sm text-neutral-600 hover:underline dark:text-slate-400">Edit</a>
        </td>
      </tr>
    `;
  }

  function render() {
    T.renderHead(headRow, COLUMNS, state.sort, (next) => {
      state.sort = next;
      state.page = 1;
      render();
    });

    const rows = filtered();
    const start = (state.page - 1) * state.pageSize;
    const pageRows = rows.slice(start, start + state.pageSize);

    tbody.innerHTML = pageRows.length
      ? pageRows.map(row).join("")
      : `<tr><td colspan="${COLUMNS.length}" class="px-3 py-10 text-center text-sm text-neutral-400 dark:text-slate-500">No products match this search/filter.</td></tr>`;

    resultCount.textContent = `${rows.length} product${rows.length === 1 ? "" : "s"}`;

    T.renderPagination(pagination, {
      page: state.page,
      pageSize: state.pageSize,
      total: rows.length,
      onPageChange: (page) => {
        state.page = page;
        render();
      },
    });
  }

  // Any filter change resets to page 1; sorting leaves filters alone
  // (docs/ui/admin/admin-main-ui.md section 10.1).
  searchBox.addEventListener("input", () => {
    state.query = searchBox.value;
    state.page = 1;
    render();
  });

  statusFilter.addEventListener("change", () => {
    state.status = statusFilter.value;
    state.page = 1;
    render();
  });

  render();
})();
