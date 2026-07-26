// Admin read-only product detail view (admin/product-detail.html) — FR-CAT-068.
// Shows every field regardless of status, distinct from the create/edit form.

(function () {
  const H = window.MockHelpers;
  const MOCK = window.MOCK;

  const params = new URLSearchParams(window.location.search);
  const product = MOCK.products.find((p) => p.id === params.get("id"));

  if (!product) {
    document.getElementById("not-found").classList.remove("hidden");
    return;
  }
  document.getElementById("detail-content").classList.remove("hidden");

  const T = window.AdminTable;

  function renderHeader() {
    document.getElementById("product-name").textContent = product.name;
    document.getElementById("product-name-heading").textContent = product.name;
    document.title = `TechCart Admin — ${product.name}`;
    document.getElementById("status-badge").innerHTML = T.statusBadge(product.status);
    document.getElementById("edit-link").href = `product-form.html?id=${product.id}`;
  }

  function renderBasicInfo() {
    const brand = H.getBrandById(product.brandId);
    const category = H.getCategoryById(product.categoryId);
    document.getElementById("detail-sku").textContent = product.sku;
    document.getElementById("detail-brand").textContent = brand ? brand.name : "—";
    document.getElementById("detail-category").textContent = category ? category.name : "—";
    document.getElementById("detail-slug").textContent = product.slug;
    document.getElementById("detail-description").textContent = product.description;
  }

  function renderPriceAndStock() {
    const display = H.getDisplayPrice(product);
    const hasVariants = (product.variants || []).some((v) => v.active);
    document.getElementById("detail-mrp").textContent = H.formatINR(product.mrp);
    document.getElementById("detail-discount").textContent = `${product.discount}%`;
    document.getElementById("detail-selling-price").textContent =
      `${display.isStartingFrom ? "From " : ""}${H.formatINR(display.sellingPrice)}`;
    document.getElementById("detail-stock").textContent = H.getDisplayStock(product);
    document.getElementById("starting-from-note").classList.toggle("hidden", !hasVariants);
  }

  function renderImages() {
    document.getElementById("detail-images").innerHTML = product.images
      .map(
        (img) =>
          `<div class="flex h-16 w-16 items-center justify-center rounded-md bg-neutral-100 text-center text-[10px] text-neutral-400 dark:bg-slate-800 dark:text-slate-500">${img}</div>`,
      )
      .join("");
  }

  function renderSpecs() {
    const groups = H.getGroupedSpecDisplay(product);
    document.getElementById("detail-specs").innerHTML = groups.length
      ? groups
          .map(
            (group) => `
              <div class="mb-3 last:mb-0">
                <p class="mb-1 text-xs font-semibold uppercase text-neutral-400 dark:text-slate-500">${group.groupName}</p>
                <dl class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  ${group.rows.map((row) => `<div><dt class="text-neutral-500 dark:text-slate-400">${row.name}</dt><dd class="font-medium">${row.value}</dd></div>`).join("")}
                </dl>
              </div>
            `,
          )
          .join("")
      : `<p class="text-neutral-400 dark:text-slate-500">No specifications set.</p>`;
  }

  function renderVariants() {
    const variants = product.variants || [];
    if (variants.length === 0) {
      document.getElementById("detail-variants").innerHTML =
        `<p class="text-sm text-neutral-400 dark:text-slate-500">No variants — this product sells via its own SKU/price/stock above.</p>`;
      return;
    }
    // Every variant is shown here (including inactive/soft-deleted ones) — this is the
    // all-fields admin view, unlike buyer-facing endpoints which only ever see `active` ones.
    const rows = variants
      .map((v) => {
        const attrsText = v.attributes.map((a) => `${a.name}=${a.value}`).join(", ");
        return `
          <tr class="border-b border-neutral-100 last:border-0 dark:border-slate-800">
            <td class="px-3 py-2 text-neutral-500 dark:text-slate-400">${v.sku}</td>
            <td class="px-3 py-2">${attrsText}</td>
            <td class="px-3 py-2">${H.formatINR(v.mrp)}</td>
            <td class="px-3 py-2">${v.discount}%</td>
            <td class="px-3 py-2">${H.formatINR(v.sellingPrice)}</td>
            <td class="px-3 py-2 ${v.stock === 0 ? "text-red-600 dark:text-red-400" : ""}">${v.stock}</td>
            <td class="px-3 py-2">${v.weight != null ? v.weight + "g" : "—"}</td>
            <td class="px-3 py-2">${v.images && v.images.length ? v.images.length : 0}</td>
            <td class="px-3 py-2">${v.active ? `<span class="rounded px-1.5 py-0.5 text-xs ${T.STATUS_TONES.published}">Active</span>` : `<span class="rounded px-1.5 py-0.5 text-xs ${T.STATUS_TONES.inactive}">Inactive</span>`}</td>
          </tr>
        `;
      })
      .join("");

    document.getElementById("detail-variants").innerHTML = `
      <table class="w-full text-left text-sm">
        <thead class="border-b border-neutral-200 text-xs uppercase text-neutral-500 dark:border-slate-800 dark:text-slate-400">
          <tr>
            <th class="px-3 py-2">SKU</th>
            <th class="px-3 py-2">Attributes</th>
            <th class="px-3 py-2">MRP</th>
            <th class="px-3 py-2">Discount</th>
            <th class="px-3 py-2">Selling price</th>
            <th class="px-3 py-2">Stock</th>
            <th class="px-3 py-2">Weight</th>
            <th class="px-3 py-2">Images</th>
            <th class="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  renderHeader();
  renderBasicInfo();
  renderPriceAndStock();
  renderImages();
  renderSpecs();
  renderVariants();
})();
