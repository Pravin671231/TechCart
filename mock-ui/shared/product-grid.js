// Shared product-grid rendering (card markup, skeleton/empty/error states,
// pagination) reused by catalog.js, category.js, and search.js so the three
// buyer listing pages stay visually and behaviorally consistent.

(function () {
  const H = window.MockHelpers;

  function renderProductCard(product) {
    const brand = H.getBrandById(product.brandId);
    const display = H.getDisplayPrice(product);
    const stock = H.getDisplayStock(product);
    const discountPct = product.discount;
    const hasVariants = H.getVariantsForProduct(product.id).length > 0;

    const priceHtml =
      !hasVariants && discountPct > 0
        ? `<span class="text-sm text-neutral-400 line-through">${H.formatINR(product.mrp)}</span>
           <span class="text-lg font-semibold">${H.formatINR(display.sellingPrice)}</span>
           <span class="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700">${discountPct}% off</span>`
        : `<span class="text-lg font-semibold">${display.isStartingFrom ? "From " : ""}${H.formatINR(display.sellingPrice)}</span>`;

    const stockHtml =
      stock > 0
        ? `<span class="rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">In stock</span>`
        : `<span class="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Out of stock</span>`;

    return `
      <a href="product.html?slug=${encodeURIComponent(product.slug)}" class="group block rounded-lg border border-neutral-200 bg-white p-3 transition hover:shadow-md">
        <div class="mb-3 flex aspect-square items-center justify-center rounded-md bg-neutral-100 text-sm font-medium text-neutral-400">
          ${product.name}
        </div>
        <p class="text-xs font-medium text-neutral-500">${brand ? brand.name : ""}</p>
        <h3 class="mb-1 truncate text-sm font-medium text-neutral-900 group-hover:underline">${product.name}</h3>
        <div class="mb-2 flex flex-wrap items-center gap-1.5">${priceHtml}</div>
        ${stockHtml}
      </a>
    `;
  }

  function renderSkeletonGrid(count) {
    let cards = "";
    for (let i = 0; i < count; i++) {
      cards += `
        <div class="animate-pulse rounded-lg border border-neutral-200 bg-white p-3">
          <div class="mb-3 aspect-square rounded-md bg-neutral-200"></div>
          <div class="mb-2 h-3 w-1/3 rounded bg-neutral-200"></div>
          <div class="mb-2 h-4 w-2/3 rounded bg-neutral-200"></div>
          <div class="h-4 w-1/2 rounded bg-neutral-200"></div>
        </div>
      `;
    }
    return `<div class="grid grid-cols-2 gap-4 sm:grid-cols-3">${cards}</div>`;
  }

  function renderEmptyState(message) {
    return `
      <div class="flex flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 py-16 text-center">
        <p class="text-sm font-medium text-neutral-600">${message}</p>
        <p class="mt-1 text-xs text-neutral-400">Try adjusting your filters or search.</p>
      </div>
    `;
  }

  function renderErrorState() {
    return `
      <div class="flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 py-16 text-center">
        <p class="text-sm font-medium text-red-700">Couldn't load products right now.</p>
        <p class="mt-1 text-xs text-red-500">This is a simulated fetch failure — the rest of the page still works.</p>
      </div>
    `;
  }

  // state: { loading, error, products, emptyMessage }
  function renderGrid(container, state) {
    if (state.loading) {
      container.innerHTML = renderSkeletonGrid(6);
      return;
    }
    if (state.error) {
      container.innerHTML = renderErrorState();
      return;
    }
    if (state.products.length === 0) {
      container.innerHTML = renderEmptyState(state.emptyMessage || "No products match your filters.");
      return;
    }
    container.innerHTML = `<div class="grid grid-cols-2 gap-4 sm:grid-cols-3">${state.products.map(renderProductCard).join("")}</div>`;
  }

  // Renders numbered page buttons; onPageChange(pageNumber) is called on click.
  function renderPagination(container, { page, pageSize, total, onPageChange }) {
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    if (pageCount <= 1) {
      container.innerHTML = "";
      return;
    }
    let buttons = "";
    for (let i = 1; i <= pageCount; i++) {
      const isActive = i === page;
      buttons += `<button data-page="${i}" class="rounded-md px-3 py-1 text-sm ${isActive ? "bg-neutral-900 text-white" : "border border-neutral-300 text-neutral-600 hover:bg-neutral-100"}">${i}</button>`;
    }
    container.innerHTML = buttons;
    container.querySelectorAll("button[data-page]").forEach((btn) => {
      btn.addEventListener("click", () => onPageChange(Number(btn.getAttribute("data-page"))));
    });
  }

  window.ProductGrid = {
    renderProductCard,
    renderSkeletonGrid,
    renderEmptyState,
    renderErrorState,
    renderGrid,
    renderPagination,
  };
})();
