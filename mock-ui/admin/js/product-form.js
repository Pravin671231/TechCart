// Admin product create/edit form (admin/product-form.html) — FR-CAT-011-020,
// 039, 041-050, 054-060, 061-062, 066-067.
// Submission is fully mocked (shows a banner, nothing is written back to
// window.MOCK) — this file is only responsible for correct prefill and
// interactive rendering, matching the existing prototype's scope.

(function () {
  const H = window.MockHelpers;
  const MOCK = window.MOCK;

  const params = new URLSearchParams(window.location.search);
  const editingId = params.get("id");
  const existingProduct = editingId ? MOCK.products.find((p) => p.id === editingId) : null;
  const existingVariants = existingProduct ? H.getVariantsForProduct(existingProduct.id) : [];

  let variantRowCounter = 0;
  const previewUrls = []; // tracked so they could be revoked; harmless to leak in a short-lived mock

  // ---- Basic info / brand / category selects ----

  function populateBrandSelect() {
    const select = document.getElementById("field-brand");
    select.innerHTML = MOCK.brands.map((b) => `<option value="${b.id}">${b.name}</option>`).join("");
  }

  function populateCategorySelect() {
    const select = document.getElementById("field-category");
    const options = [];
    H.getTopLevelCategories().forEach((top) => {
      options.push(`<option value="${top.id}">${top.name}</option>`);
      H.getCategoryChildren(top.id).forEach((child) => {
        options.push(`<option value="${child.id}">&nbsp;&nbsp;${child.name}</option>`);
      });
    });
    select.innerHTML = options.join("");
  }

  function prefillBasicInfo() {
    if (!existingProduct) return;
    document.getElementById("form-title").textContent = `Edit ${existingProduct.name}`;
    document.getElementById("field-name").value = existingProduct.name;
    document.getElementById("field-sku").value = existingProduct.sku;
    document.getElementById("field-brand").value = existingProduct.brandId;
    document.getElementById("field-category").value = existingProduct.categoryId;
    document.getElementById("field-status").value = existingProduct.status;
    document.getElementById("field-description").value = existingProduct.description;
    document.getElementById("field-mrp").value = existingProduct.mrp / 100;
    document.getElementById("field-discount").value = existingProduct.discount;
    document.getElementById("field-stock").value = existingProduct.stock;
  }

  // ---- Live selling price preview (FR-CAT-062) ----

  function updateSellingPricePreview() {
    const mrpRupees = Number(document.getElementById("field-mrp").value) || 0;
    const discount = Number(document.getElementById("field-discount").value) || 0;
    const mrpPaise = Math.round(mrpRupees * 100);
    const sellingPaise = H.computeSellingPrice(mrpPaise, discount);
    document.getElementById("field-selling-price").value = mrpPaise > 0 ? H.formatINR(sellingPaise) : "";
  }
  document.getElementById("field-mrp").addEventListener("input", updateSellingPricePreview);
  document.getElementById("field-discount").addEventListener("input", updateSellingPricePreview);

  // ---- Dynamic specification fields, grouped by specificationGroups (FR-CAT-041, 043) ----

  function findExistingSpecValue(prefillGroups, groupName, specName) {
    const group = (prefillGroups || []).find((g) => g.groupName === groupName);
    if (!group) return undefined;
    const entry = group.values.find((v) => v.name === specName);
    return entry ? entry.value : undefined;
  }

  function renderSpecFields(categoryId, prefillGroups) {
    const container = document.getElementById("spec-fields");
    const groups = H.getSpecGroupsForCategory(categoryId);
    if (groups.length === 0) {
      container.innerHTML = `<p class="text-sm text-neutral-400">No specifications defined for this category.</p>`;
      return;
    }
    container.innerHTML = groups
      .map((group) => {
        const fieldsHtml = group.specifications
          .map((spec) => {
            const existing = findExistingSpecValue(prefillGroups, group.groupName, spec.name);
            const label = `${spec.name}${spec.unit ? " (" + spec.unit + ")" : ""}${spec.required ? " *" : ""}`;
            let input;
            if (spec.type === "number") {
              input = `<input type="number" data-group="${group.groupName}" data-name="${spec.name}" value="${existing != null ? existing : ""}" class="spec-input w-full rounded-md border border-neutral-300 px-3 py-1.5" ${spec.required ? "required" : ""} />`;
            } else if (spec.type === "boolean") {
              input = `<select data-group="${group.groupName}" data-name="${spec.name}" class="spec-input w-full rounded-md border border-neutral-300 px-3 py-1.5">
                <option value="false" ${existing === false ? "selected" : ""}>No</option>
                <option value="true" ${existing === true ? "selected" : ""}>Yes</option>
              </select>`;
            } else {
              input = `<input type="text" data-group="${group.groupName}" data-name="${spec.name}" value="${existing != null ? existing : ""}" class="spec-input w-full rounded-md border border-neutral-300 px-3 py-1.5" ${spec.required ? "required" : ""} />`;
            }
            return `<label class="block text-sm"><span class="mb-1 block text-neutral-600">${label}</span>${input}</label>`;
          })
          .join("");
        return `<div class="sm:col-span-2"><p class="mb-2 text-xs font-semibold uppercase text-neutral-400">${group.groupName}</p><div class="grid grid-cols-1 gap-4 sm:grid-cols-2">${fieldsHtml}</div></div>`;
      })
      .join("");
  }

  document.getElementById("field-category").addEventListener("change", (e) => {
    renderSpecFields(e.target.value, null);
    updateVariantPriceNote();
  });

  // ---- Images (FR-CAT-028, 054-060) ----

  document.getElementById("field-images").addEventListener("change", (e) => {
    const files = Array.from(e.target.files);
    const errorEl = document.getElementById("image-count-error");
    if (files.length < 1 || files.length > 8) {
      errorEl.textContent = `Select 1–8 images (selected ${files.length}).`;
      errorEl.classList.remove("hidden");
    } else {
      errorEl.classList.add("hidden");
    }
    const previews = document.getElementById("image-previews");
    previews.innerHTML = "";
    files.forEach((file) => {
      const url = URL.createObjectURL(file);
      previewUrls.push(url);
      previews.innerHTML += `<img src="${url}" class="h-16 w-16 rounded-md object-cover" alt="${file.name}" />`;
    });
  });

  // ---- Variants (FR-CAT-046-050, embedded per Decision #10) ----

  function attributePairRow(name, value) {
    return `
      <div class="attr-pair flex items-center gap-2">
        <input type="text" placeholder="Name (e.g. Color)" value="${name || ""}" class="attr-name w-1/2 rounded-md border border-neutral-300 px-2 py-1 text-sm" />
        <input type="text" placeholder="Value (e.g. Red)" value="${value || ""}" class="attr-value w-1/2 rounded-md border border-neutral-300 px-2 py-1 text-sm" />
        <button type="button" class="remove-attr-btn text-neutral-400 hover:text-red-600" title="Remove attribute">✕</button>
      </div>
    `;
  }

  // Governed inputs come from the category's categoryVariants definitions (FR-CAT-066) —
  // a UI-rendering guide only, not server-validated (FR-CAT-067). Any attribute not covered
  // by a governed axis still falls back to a free-text name/value pair.
  function renderAttributesSection(prefillAttrs, categoryId) {
    const attrs = prefillAttrs || [];
    const governedTypes = H.getCategoryVariantTypes(categoryId);
    const governedNames = new Set(governedTypes.map((t) => t.name));

    const governedHtml = governedTypes
      .map((t) => {
        const existing = attrs.find((a) => a.name === t.name);
        const value = existing ? existing.value : "";
        let input;
        if (t.type === "select" || t.type === "color") {
          input = `<select data-attr-name="${t.name}" class="governed-attr w-full rounded-md border border-neutral-300 px-2 py-1 text-sm">
            <option value="">Select...</option>
            ${t.options.map((o) => `<option value="${o.value}" ${existing && existing.value === o.value ? "selected" : ""}>${o.label}</option>`).join("")}
          </select>`;
        } else if (t.type === "number") {
          input = `<input type="number" data-attr-name="${t.name}" value="${value}" class="governed-attr w-full rounded-md border border-neutral-300 px-2 py-1 text-sm" />`;
        } else {
          input = `<input type="text" data-attr-name="${t.name}" value="${value}" class="governed-attr w-full rounded-md border border-neutral-300 px-2 py-1 text-sm" />`;
        }
        return `<label class="block text-xs"><span class="mb-1 block text-neutral-500">${t.name}${t.required ? " *" : ""}</span>${input}</label>`;
      })
      .join("");

    const customAttrs = attrs.filter((a) => !governedNames.has(a.name));
    const customHtml = customAttrs.length
      ? customAttrs.map((a) => attributePairRow(a.name, a.value)).join("")
      : governedTypes.length === 0
        ? attributePairRow("", "")
        : "";

    return `
      ${governedTypes.length ? `<div class="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-3">${governedHtml}</div>` : ""}
      <div class="attr-pairs space-y-2">${customHtml}</div>
      <button type="button" class="add-attr-btn mt-2 text-xs text-neutral-500 underline hover:text-neutral-700">+ Add ${governedTypes.length ? "custom " : ""}attribute</button>
    `;
  }

  function addVariantRow(prefillVariant) {
    variantRowCounter += 1;
    const rowId = `variant-row-${variantRowCounter}`;
    const attrs = prefillVariant ? prefillVariant.attributes : [];
    const categoryId = document.getElementById("field-category").value;
    const imageCount = prefillVariant && prefillVariant.images ? prefillVariant.images.length : 0;

    const wrapper = document.createElement("div");
    wrapper.id = rowId;
    wrapper.className = "variant-row rounded-md border border-neutral-200 p-4";
    wrapper.innerHTML = `
      <div class="mb-3 flex items-center justify-between">
        <p class="text-sm font-medium text-neutral-700">Variant</p>
        <label class="flex items-center gap-1.5 text-xs text-neutral-500">
          <input type="checkbox" class="variant-active rounded border-neutral-300" ${!prefillVariant || prefillVariant.active ? "checked" : ""} /> Active
        </label>
        <button type="button" class="remove-variant-btn text-xs text-red-600 underline">Remove</button>
      </div>
      <div class="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label class="block text-xs sm:col-span-2">
          <span class="mb-1 block text-neutral-500">SKU</span>
          <input type="text" class="variant-sku w-full rounded-md border border-neutral-300 px-2 py-1 text-sm" value="${prefillVariant ? prefillVariant.sku : ""}" />
        </label>
        <label class="block text-xs">
          <span class="mb-1 block text-neutral-500">MRP (₹)</span>
          <input type="number" min="1" class="variant-mrp w-full rounded-md border border-neutral-300 px-2 py-1 text-sm" value="${prefillVariant ? prefillVariant.mrp / 100 : ""}" />
        </label>
        <label class="block text-xs">
          <span class="mb-1 block text-neutral-500">Stock</span>
          <input type="number" min="0" class="variant-stock w-full rounded-md border border-neutral-300 px-2 py-1 text-sm" value="${prefillVariant ? prefillVariant.stock : ""}" />
        </label>
        <label class="block text-xs">
          <span class="mb-1 block text-neutral-500">Discount (%)</span>
          <input type="number" min="0" max="99" class="variant-discount w-full rounded-md border border-neutral-300 px-2 py-1 text-sm" value="${prefillVariant ? prefillVariant.discount : 0}" />
        </label>
        <label class="block text-xs">
          <span class="mb-1 block text-neutral-500">Weight (g, optional)</span>
          <input type="number" min="0" class="variant-weight w-full rounded-md border border-neutral-300 px-2 py-1 text-sm" value="${prefillVariant && prefillVariant.weight != null ? prefillVariant.weight : ""}" />
        </label>
        <label class="block text-xs sm:col-span-2">
          <span class="mb-1 block text-neutral-500">Selling price</span>
          <input disabled class="variant-selling-price w-full rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-sm text-neutral-500" />
        </label>
        <label class="block text-xs sm:col-span-2">
          <span class="mb-1 block text-neutral-500">Images (0–2, optional — falls back to product images)</span>
          <input type="file" multiple accept="image/jpeg,image/png,image/webp" class="variant-images w-full text-xs" />
          <p class="variant-image-error mt-1 hidden text-xs text-red-600"></p>
        </label>
      </div>
      <div class="attr-section">${renderAttributesSection(attrs, categoryId)}</div>
    `;

    document.getElementById("variant-rows").appendChild(wrapper);
    updateVariantRowPrice(wrapper);
    if (imageCount > 0) {
      wrapper.querySelector(".variant-image-error").classList.add("hidden");
    }
  }

  function updateVariantRowPrice(row) {
    const mrpRupees = Number(row.querySelector(".variant-mrp").value) || 0;
    const discount = Number(row.querySelector(".variant-discount").value) || 0;
    const mrpPaise = Math.round(mrpRupees * 100);
    const sellingPaise = H.computeSellingPrice(mrpPaise, discount);
    row.querySelector(".variant-selling-price").value = mrpPaise > 0 ? H.formatINR(sellingPaise) : "";
  }

  function updateVariantPriceNote() {
    const hasVariants = document.getElementById("variant-rows").children.length > 0;
    document.getElementById("variant-price-note").classList.toggle("hidden", !hasVariants);
  }

  document.getElementById("add-variant-btn").addEventListener("click", () => {
    addVariantRow(null);
    updateVariantPriceNote();
  });

  // Event delegation for everything inside dynamically-created variant rows.
  document.getElementById("variant-rows").addEventListener("click", (e) => {
    if (e.target.classList.contains("remove-variant-btn")) {
      e.target.closest(".variant-row").remove();
      updateVariantPriceNote();
    }
    if (e.target.classList.contains("add-attr-btn")) {
      e.target.insertAdjacentHTML("beforebegin", attributePairRow("", ""));
    }
    if (e.target.classList.contains("remove-attr-btn")) {
      e.target.closest(".attr-pair").remove();
    }
  });

  document.getElementById("variant-rows").addEventListener("input", (e) => {
    if (e.target.classList.contains("variant-mrp") || e.target.classList.contains("variant-discount")) {
      updateVariantRowPrice(e.target.closest(".variant-row"));
    }
  });

  // A variant's images set is bounded 0-2 (not the product's 1-8) — FR-CAT-046, 060.
  document.getElementById("variant-rows").addEventListener("change", (e) => {
    if (!e.target.classList.contains("variant-images")) return;
    const files = Array.from(e.target.files);
    const errorEl = e.target.closest("label").querySelector(".variant-image-error");
    if (files.length > 2) {
      errorEl.textContent = `Select at most 2 images (selected ${files.length}) — falls back to product images if omitted.`;
      errorEl.classList.remove("hidden");
    } else {
      errorEl.classList.add("hidden");
    }
  });

  // ---- Submit (mocked — nothing persisted) ----

  document.getElementById("product-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const banner = document.getElementById("saved-banner");
    banner.classList.remove("hidden");
    banner.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // ---- Init ----

  populateBrandSelect();
  populateCategorySelect();
  prefillBasicInfo();
  renderSpecFields(existingProduct ? existingProduct.categoryId : document.getElementById("field-category").value, existingProduct ? existingProduct.specifications : null);
  updateSellingPricePreview();

  if (existingVariants.length > 0) {
    existingVariants.forEach((v) => addVariantRow(v));
  }
  updateVariantPriceNote();
})();
