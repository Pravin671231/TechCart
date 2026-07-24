// Product detail page (buyer/product.html?slug=...) — FR-CAT-003, 044, 049, 051, 053.

(function () {
  const H = window.MockHelpers;

  // Cosmetic-only lookup for variant swatch dots (buyer/js/product.js:renderVariantSelector).
  // The revised attribute shape is just {name, value} (Decision #10/#15) — there's no
  // schema-level swatch/label field anymore, so this is purely a display nicety.
  const COLOR_HEX = {
    red: "#dc2626",
    blue: "#2563eb",
    green: "#16a34a",
    black: "#171717",
    white: "#f5f5f5",
    yellow: "#ca8a04",
    orange: "#ea580c",
    purple: "#9333ea",
    pink: "#db2777",
    gray: "#6b7280",
    grey: "#6b7280",
  };

  const params = new URLSearchParams(window.location.search);
  const product = H.getProductBySlug(params.get("slug") || "");

  if (!product) {
    document.getElementById("not-found").classList.remove("hidden");
    return;
  }
  document.getElementById("product-content").classList.remove("hidden");

  const variants = H.getVariantsForProduct(product.id);
  const brand = H.getBrandById(product.brandId);
  const category = H.getCategoryById(product.categoryId);

  // Attribute axes available across this product's variants, e.g. { Color: ["Red","Blue"], Size: ["M","L"] }.
  const axes = new Map();
  variants.forEach((v) => v.attributes.forEach((a) => {
    if (!axes.has(a.name)) axes.set(a.name, []);
    if (!axes.get(a.name).includes(a.value)) axes.get(a.name).push(a.value);
  }));

  // Default selection: the first/lowest-sellingPrice active variant (FR-CAT-051).
  let selected = {};
  if (variants.length > 0) {
    const cheapest = variants.reduce((min, v) => (v.sellingPrice < min.sellingPrice ? v : min));
    cheapest.attributes.forEach((a) => (selected[a.name] = a.value));
  }

  function findMatchingVariant() {
    return variants.find(
      (v) => v.attributes.length === Object.keys(selected).length && v.attributes.every((a) => selected[a.name] === a.value),
    );
  }

  function renderBreadcrumb() {
    const path = category ? H.getCategoryPath(category.id) : [];
    const crumbs = [`<a href="index.html" class="hover:underline">Home</a>`];
    path.forEach((c) => crumbs.push(`<a href="category.html?slug=${encodeURIComponent(c.slug)}" class="hover:underline">${c.name}</a>`));
    crumbs.push(`<span class="text-neutral-900">${product.name}</span>`);
    document.getElementById("breadcrumb").innerHTML = crumbs.join(' <span class="mx-1">/</span> ');
  }

  function renderStaticInfo() {
    document.getElementById("brand-link").textContent = brand ? brand.name : "";
    document.getElementById("brand-link").href = "index.html";
    document.getElementById("product-name").textContent = product.name;
    document.getElementById("category-link").textContent = category ? category.name : "";
    document.getElementById("category-link").href = category ? `category.html?slug=${encodeURIComponent(category.slug)}` : "#";
    document.getElementById("product-description").textContent = product.description;

    // Grouped by specificationGroups (FR-CAT-044, Decision #14).
    const groups = H.getGroupedSpecDisplay(product);
    const specHtml = groups.length
      ? groups
          .map(
            (group) => `
              <tr class="border-b border-neutral-100"><td colspan="2" class="pt-3 pb-1 text-xs font-semibold uppercase text-neutral-400">${group.groupName}</td></tr>
              ${group.rows
                .map((row) => `<tr class="border-b border-neutral-100"><td class="py-1.5 pr-4 text-neutral-500">${row.name}</td><td class="py-1.5 font-medium">${row.value}</td></tr>`)
                .join("")}
            `,
          )
          .join("")
      : `<tr><td class="py-1.5 text-neutral-400">No specifications listed.</td></tr>`;
    document.querySelector("#spec-table tbody").innerHTML = specHtml;
  }

  function renderGallery(images) {
    const list = images && images.length > 0 ? images : product.images;
    const main = list[0] || product.name;
    document.getElementById("main-image").textContent = main;
    document.getElementById("thumbnails").innerHTML = list
      .map((img, i) => `<button data-thumb="${i}" class="h-14 w-14 rounded-md bg-neutral-100 text-[10px] text-neutral-400">${img}</button>`)
      .join("");
    document.querySelectorAll("#thumbnails button").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.getElementById("main-image").textContent = list[Number(btn.getAttribute("data-thumb"))];
      });
    });
  }

  function renderPriceAndStock() {
    const matched = variants.length > 0 ? findMatchingVariant() : null;

    if (variants.length > 0 && !matched) {
      document.getElementById("price-row").innerHTML = `<span class="text-sm text-neutral-500">This combination isn't available.</span>`;
      document.getElementById("stock-badge").innerHTML = "";
      renderGallery(product.images);
      return;
    }

    const source = matched || product;
    const priceHtml =
      source.discount > 0
        ? `<span class="text-base text-neutral-400 line-through">${H.formatINR(source.mrp)}</span>
           <span class="text-2xl font-semibold">${H.formatINR(source.sellingPrice)}</span>
           <span class="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700">${source.discount}% off</span>`
        : `<span class="text-2xl font-semibold">${H.formatINR(source.sellingPrice)}</span>`;
    document.getElementById("price-row").innerHTML = priceHtml;

    document.getElementById("stock-badge").innerHTML =
      source.stock > 0
        ? `<span class="rounded bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-600">In stock${matched ? ` · SKU ${matched.sku}` : ""}</span>`
        : `<span class="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700">Out of stock</span>`;

    // Falls back to the parent product's images when the selected variant has none of its own
    // (FR-CAT-051) — a variant's own images are bounded 1-2 when present, not the product's 1-8.
    renderGallery(matched ? matched.images : product.images);
  }

  function renderVariantSelector() {
    const container = document.getElementById("variant-section");
    if (axes.size === 0) {
      container.innerHTML = "";
      return;
    }
    const sections = [];
    axes.forEach((values, name) => {
      const buttons = values
        .map((value) => {
          const isActive = selected[name] === value;
          const hex = COLOR_HEX[String(value).toLowerCase()];
          const swatchDot = hex ? `<span class="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle" style="background:${hex}"></span>` : "";
          return `<button data-axis="${name}" data-value="${value}" class="axis-btn rounded-md border px-3 py-1.5 text-sm ${isActive ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 hover:bg-neutral-100"}">${swatchDot}${value}</button>`;
        })
        .join(" ");
      sections.push(`<div><p class="mb-1 text-xs font-medium text-neutral-500">${name}</p><div class="flex flex-wrap gap-2">${buttons}</div></div>`);
    });
    container.innerHTML = sections.join("");

    container.querySelectorAll("button.axis-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        selected[btn.getAttribute("data-axis")] = btn.getAttribute("data-value");
        renderVariantSelector();
        renderPriceAndStock();
      });
    });
  }

  renderBreadcrumb();
  renderStaticInfo();
  renderVariantSelector();
  renderPriceAndStock();
})();
