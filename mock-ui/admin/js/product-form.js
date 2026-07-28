// Admin product create/edit wizard (admin/product-form.html).
// Built to docs/ui/admin/product-catalog.md section 3.3: four steps — Basic Information,
// Images and Specifications, Add Variants, Preview.
//
// Rules that shape this file (section 6.3):
//   - Forward is gated by the current step's validation; backward is free.
//   - A completed step is reachable from the stepper; an unvisited one isn't.
//   - Step 4 is read-only; edits happen by returning to the owning step.
//   - Nothing persists until step 4's save, which is mocked here.

(function () {
  const H = window.MockHelpers;
  const MOCK = window.MOCK;

  const params = new URLSearchParams(window.location.search);
  const editingId = params.get("id");
  const editing = editingId ? MOCK.products.find((p) => p.id === editingId) : null;

  const STEPS = [
    { n: 1, label: "Basic Information" },
    { n: 2, label: "Images and Specifications" },
    { n: 3, label: "Add Variants" },
    { n: 4, label: "Preview" },
  ];

  let current = 1;
  let furthest = 1;
  let selectedImages = [];
  let lastCategoryId = "";

  const el = (id) => document.getElementById(id);
  const stepper = el("stepper");
  const stepStatus = el("step-status");
  const backBtn = el("back-btn");
  const nextBtn = el("next-btn");
  const saveBtn = el("save-btn");
  const form = el("product-form");

  // --- Error helpers -----------------------------------------------------

  function setError(name, message) {
    const holder = document.querySelector(`[data-error-for="${name}"]`);
    if (holder) holder.textContent = message || "";
    const field = el(name);
    if (field) {
      if (message) {
        field.setAttribute("aria-invalid", "true");
      } else {
        field.removeAttribute("aria-invalid");
      }
    }
  }

  function clearErrors(step) {
    document
      .querySelector(`[data-step="${step}"]`)
      .querySelectorAll("[data-error-for]")
      .forEach((n) => {
        n.textContent = "";
        const field = el(n.getAttribute("data-error-for"));
        if (field) field.removeAttribute("aria-invalid");
      });
  }

  // --- Populate selects --------------------------------------------------

  // Inactive brands/categories stay selectable — inactive means hidden from
  // buyers, not unusable by admins (docs/ui/admin/product-catalog.md section 4.3).
  function populateBrands() {
    el("field-brand").innerHTML =
      `<option value="">Select a brand</option>` +
      MOCK.brands
        .map(
          (b) =>
            `<option value="${b.id}">${b.name}${b.status === false ? " (inactive)" : ""}</option>`,
        )
        .join("");
  }

  function populateCategories() {
    let html = `<option value="">Select a category</option>`;
    H.getTopLevelCategories().forEach((parent) => {
      html += `<option value="${parent.id}">${parent.name}${parent.status === false ? " (inactive)" : ""}</option>`;
      H.getCategoryChildren(parent.id).forEach((child) => {
        html += `<option value="${child.id}">&nbsp;&nbsp;${child.name}${child.status === false ? " (inactive)" : ""}</option>`;
      });
    });
    el("field-category").innerHTML = html;
  }

  // --- Price -------------------------------------------------------------

  function updateSellingPrice() {
    const mrpRupees = Number(el("field-mrp").value);
    const discount = Number(el("field-discount").value || 0);
    if (!mrpRupees || mrpRupees <= 0) {
      el("field-selling-price").value = "";
      return;
    }
    const paise = H.computeSellingPrice(Math.round(mrpRupees * 100), discount);
    el("field-selling-price").value = H.formatINR(paise);
  }

  // --- Specifications ----------------------------------------------------

  function currentSpecValues() {
    const values = {};
    document.querySelectorAll("#spec-fields [data-spec]").forEach((input) => {
      values[input.getAttribute("data-spec")] = input.value;
    });
    return values;
  }

  function renderSpecFields(preserved) {
    const categoryId = el("field-category").value;
    const groups = categoryId ? H.getSpecGroupsForCategory(categoryId) : [];
    const container = el("spec-fields");

    if (!groups.length) {
      container.innerHTML = `<p class="text-sm text-neutral-400 dark:text-slate-500">No specifications defined for this category.</p>`;
      return;
    }

    container.innerHTML = groups
      .map(
        (group) => `
        <div class="sm:col-span-2">
          <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-400">${group.groupName}</p>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            ${group.specifications
              .map((spec) => {
                const key = `${group.groupName}::${spec.name}`;
                const value = (preserved && preserved[key]) || "";
                const label = `${spec.name}${spec.unit ? ` (${spec.unit})` : ""}${spec.required ? " *" : ""}`;
                let control;
                if (spec.type === "number") {
                  control = `<input type="number" data-spec="${key}" data-required="${!!spec.required}" value="${value}" class="ta-input" />`;
                } else if (spec.type === "boolean") {
                  control = `<select data-spec="${key}" data-required="${!!spec.required}" class="ta-input">
                      <option value="">—</option>
                      <option value="No"${value === "No" ? " selected" : ""}>No</option>
                      <option value="Yes"${value === "Yes" ? " selected" : ""}>Yes</option>
                    </select>`;
                } else {
                  control = `<input type="text" data-spec="${key}" data-required="${!!spec.required}" value="${value}" class="ta-input" />`;
                }
                return `<label class="block text-sm"><span class="mb-1 block text-neutral-600 dark:text-slate-400">${label}</span>${control}<span data-error-for="spec:${key}" class="ta-error"></span></label>`;
              })
              .join("")}
          </div>
        </div>`,
      )
      .join("");
  }

  // Changing the category re-renders step 2's spec fields. Values for specs
  // that still exist are kept; the rest are dropped with a visible notice
  // rather than silently (docs/ui/admin/product-catalog.md section 3.3).
  function onCategoryChange() {
    const previous = currentSpecValues();
    const hadValues = Object.values(previous).some((v) => v !== "");
    renderSpecFields(previous);

    const note = el("spec-reset-note");
    if (hadValues && lastCategoryId && lastCategoryId !== el("field-category").value) {
      const kept = currentSpecValues();
      const dropped = Object.keys(previous).filter((k) => !(k in kept) && previous[k] !== "");
      note.textContent = dropped.length
        ? `Category changed — ${dropped.length} specification value(s) no longer apply and were cleared.`
        : "Category changed — specification fields were re-rendered for the new category.";
      note.classList.remove("hidden");
    }
    lastCategoryId = el("field-category").value;
  }

  // --- Variants ----------------------------------------------------------

  function variantAttributeInputs(categoryId, attributes) {
    const types = categoryId ? H.getCategoryVariantTypes(categoryId) : [];
    if (!types.length) {
      return `
        <p class="mb-2 text-xs text-neutral-500 dark:text-slate-400">
          No variant types defined for this category — using free-text attribute pairs (FR-CAT-067).
        </p>
        <div class="space-y-2" data-free-attrs>
          ${(attributes || []).map((a) => freeAttrRow(a.name, a.value)).join("")}
        </div>
        <button type="button" class="mt-2 text-xs text-indigo-600 hover:underline dark:text-indigo-400" data-add-attr>+ Add attribute</button>
      `;
    }

    return types
      .map((type) => {
        const existing = (attributes || []).find((a) => a.name === type.name);
        const value = existing ? existing.value : "";
        let control;
        if (type.type === "select" || type.type === "color") {
          control = `<select data-attr="${type.name}" class="ta-input">
              <option value="">—</option>
              ${(type.options || [])
                .map(
                  (o) =>
                    `<option value="${o.value}"${o.value === value ? " selected" : ""}>${o.label}</option>`,
                )
                .join("")}
            </select>`;
        } else if (type.type === "number") {
          control = `<input type="number" data-attr="${type.name}" value="${value}" class="ta-input" />`;
        } else {
          control = `<input type="text" data-attr="${type.name}" value="${value}" class="ta-input" />`;
        }
        return `<label class="block text-sm"><span class="mb-1 block text-neutral-600 dark:text-slate-400">${type.name}${type.required ? " *" : ""}</span>${control}</label>`;
      })
      .join("");
  }

  function freeAttrRow(name, value) {
    return `
      <div class="flex items-center gap-2" data-attr-row>
        <input type="text" placeholder="Name" value="${name || ""}" data-attr-name class="ta-input" />
        <input type="text" placeholder="Value" value="${value || ""}" data-attr-value class="ta-input" />
        <button type="button" data-remove-attr class="rounded px-2 text-neutral-400 hover:text-red-600" aria-label="Remove attribute">✕</button>
      </div>
    `;
  }

  function addVariantRow(variant) {
    const categoryId = el("field-category").value;
    const v = variant || {};
    const wrapper = document.createElement("div");
    wrapper.className =
      "rounded-md border border-neutral-200 p-4 dark:border-slate-700 dark:bg-slate-950/40";
    wrapper.setAttribute("data-variant-row", "");
    wrapper.innerHTML = `
      <div class="mb-3 flex items-center justify-between">
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" data-v-active ${v.active === false ? "" : "checked"} class="rounded border-neutral-300" />
          <span class="text-neutral-600 dark:text-slate-400">Active</span>
        </label>
        <button type="button" data-remove-variant class="text-xs text-red-600 hover:underline dark:text-red-400">Remove</button>
      </div>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label class="block text-sm"><span class="mb-1 block text-neutral-600 dark:text-slate-400">SKU *</span><input data-v-sku value="${v.sku || ""}" class="ta-input" /></label>
        <label class="block text-sm"><span class="mb-1 block text-neutral-600 dark:text-slate-400">MRP (₹) *</span><input type="number" min="1" data-v-mrp value="${v.mrp ? v.mrp / 100 : ""}" class="ta-input" /></label>
        <label class="block text-sm"><span class="mb-1 block text-neutral-600 dark:text-slate-400">Discount (%)</span><input type="number" min="0" max="99" data-v-discount value="${v.discount || 0}" class="ta-input" /></label>
        <label class="block text-sm"><span class="mb-1 block text-neutral-600 dark:text-slate-400">Stock *</span><input type="number" min="0" data-v-stock value="${v.stock != null ? v.stock : ""}" class="ta-input" /></label>
        <label class="block text-sm"><span class="mb-1 block text-neutral-600 dark:text-slate-400">Weight (g)</span><input type="number" min="0" data-v-weight value="${v.weight != null ? v.weight : ""}" class="ta-input" /></label>
        <label class="block text-sm"><span class="mb-1 block text-neutral-600 dark:text-slate-400">Selling price</span><input data-v-selling disabled class="ta-input-disabled" /></label>
        <label class="block text-sm sm:col-span-2"><span class="mb-1 block text-neutral-600 dark:text-slate-400">Images (0–2, optional)</span><input type="file" multiple accept="image/jpeg,image/png,image/webp" data-v-images class="text-sm" /></label>
      </div>
      <div class="mt-3">
        <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-400">Attributes</p>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2" data-attrs>${variantAttributeInputs(categoryId, v.attributes)}</div>
      </div>
      <p data-v-error class="ta-error"></p>
    `;
    el("variant-rows").appendChild(wrapper);
    updateVariantSelling(wrapper);
    updateVariantNote();
  }

  function updateVariantSelling(row) {
    const mrp = Number(row.querySelector("[data-v-mrp]").value);
    const discount = Number(row.querySelector("[data-v-discount]").value || 0);
    const out = row.querySelector("[data-v-selling]");
    out.value = mrp > 0 ? H.formatINR(H.computeSellingPrice(Math.round(mrp * 100), discount)) : "";
  }

  function updateVariantNote() {
    const has = document.querySelectorAll("[data-variant-row]").length > 0;
    el("variant-price-note").classList.toggle("hidden", !has);
  }

  function readVariants() {
    return Array.from(document.querySelectorAll("[data-variant-row]")).map((row) => {
      const attributes = [];
      row.querySelectorAll("[data-attr]").forEach((input) => {
        if (input.value)
          attributes.push({ name: input.getAttribute("data-attr"), value: input.value });
      });
      row.querySelectorAll("[data-attr-row]").forEach((r) => {
        const name = r.querySelector("[data-attr-name]").value.trim();
        const value = r.querySelector("[data-attr-value]").value.trim();
        if (name && value) attributes.push({ name, value });
      });
      const mrp = Number(row.querySelector("[data-v-mrp]").value);
      const discount = Number(row.querySelector("[data-v-discount]").value || 0);
      return {
        row,
        sku: row.querySelector("[data-v-sku]").value.trim(),
        mrp: mrp > 0 ? Math.round(mrp * 100) : 0,
        discount,
        stock: Number(row.querySelector("[data-v-stock]").value),
        weight: row.querySelector("[data-v-weight]").value,
        active: row.querySelector("[data-v-active]").checked,
        attributes,
      };
    });
  }

  // --- Validation --------------------------------------------------------

  // SKU uniqueness spans products and their embedded variants — one shared
  // namespace (FR-CAT-012).
  function skuTaken(sku, ignoreProductId) {
    const lower = sku.toLowerCase();
    return MOCK.products.some((p) => {
      if (p.id === ignoreProductId) return false;
      if (p.sku.toLowerCase() === lower) return true;
      return (p.variants || []).some((v) => v.sku.toLowerCase() === lower);
    });
  }

  function validateStep1() {
    clearErrors(1);
    let ok = true;
    const req = (id, message) => {
      if (!el(id).value.trim()) {
        setError(id, message);
        ok = false;
      }
    };

    req("field-name", "Name is required.");
    req("field-description", "Description is required.");
    req("field-brand", "Brand is required — every product must reference one (FR-CAT-039).");
    req("field-category", "Category is required.");

    const sku = el("field-sku").value.trim();
    if (!sku) {
      setError("field-sku", "SKU is required.");
      ok = false;
    } else if (skuTaken(sku, editingId)) {
      setError("field-sku", "This SKU is already used by another product or variant.");
      ok = false;
    }

    const mrp = Number(el("field-mrp").value);
    if (!Number.isInteger(mrp) || mrp <= 0) {
      setError("field-mrp", "MRP must be a whole number greater than 0.");
      ok = false;
    }

    const discount = Number(el("field-discount").value || 0);
    if (!Number.isInteger(discount) || discount < 0 || discount > 99) {
      setError("field-discount", "Discount must be a whole number between 0 and 99.");
      ok = false;
    }

    const stock = Number(el("field-stock").value);
    if (el("field-stock").value === "" || !Number.isInteger(stock) || stock < 0) {
      setError("field-stock", "Stock must be a non-negative whole number.");
      ok = false;
    }

    return ok;
  }

  function validateStep2() {
    clearErrors(2);
    let ok = true;

    if (selectedImages.length < 1 || selectedImages.length > 8) {
      setError("field-images", `Select 1–8 images (selected ${selectedImages.length}).`);
      ok = false;
    }

    document.querySelectorAll("#spec-fields [data-spec]").forEach((input) => {
      if (input.getAttribute("data-required") === "true" && !input.value.trim()) {
        const holder = document.querySelector(
          `[data-error-for="spec:${input.getAttribute("data-spec")}"]`,
        );
        if (holder) holder.textContent = "Required for this category.";
        input.setAttribute("aria-invalid", "true");
        ok = false;
      }
    });

    return ok;
  }

  function validateStep3() {
    clearErrors(3);
    const variants = readVariants();
    let ok = true;

    // Zero variants is valid — the product then sells on its own SKU/price.
    const seen = new Set();
    const combos = new Set();

    variants.forEach((v) => {
      const errors = [];
      if (!v.sku) errors.push("SKU is required.");
      else if (seen.has(v.sku.toLowerCase()) || skuTaken(v.sku, editingId))
        errors.push("SKU must be unique across all products and variants (FR-CAT-012).");
      seen.add(v.sku.toLowerCase());

      if (!Number.isInteger(v.mrp / 1) || v.mrp <= 0) errors.push("MRP must be greater than 0.");
      if (!Number.isInteger(v.discount) || v.discount < 0 || v.discount > 99)
        errors.push("Discount must be 0–99.");
      if (!Number.isInteger(v.stock) || v.stock < 0) errors.push("Stock must be non-negative.");

      const combo = v.attributes
        .map((a) => `${a.name}=${a.value}`)
        .sort()
        .join("|");
      if (combo && combos.has(combo))
        errors.push("Another variant already uses this attribute combination (FR-CAT-048).");
      combos.add(combo);

      v.row.querySelector("[data-v-error]").textContent = errors.join(" ");
      if (errors.length) ok = false;
    });

    return ok;
  }

  function validate(step) {
    if (step === 1) return validateStep1();
    if (step === 2) return validateStep2();
    if (step === 3) return validateStep3();
    return true;
  }

  // --- Preview -----------------------------------------------------------

  function previewRow(label, value) {
    return `<div><dt class="text-neutral-500 dark:text-slate-400">${label}</dt><dd class="font-medium">${value || "—"}</dd></div>`;
  }

  function jumpLink(step, label) {
    return `<button type="button" data-jump="${step}" class="text-xs text-indigo-600 hover:underline dark:text-indigo-400">${label}</button>`;
  }

  function renderPreview() {
    const brand = MOCK.brands.find((b) => b.id === el("field-brand").value);
    const category = H.getCategoryById(el("field-category").value);
    const mrp = Number(el("field-mrp").value) || 0;
    const discount = Number(el("field-discount").value || 0);
    const selling = mrp > 0 ? H.computeSellingPrice(Math.round(mrp * 100), discount) : 0;
    const variants = readVariants();

    const specs = Object.entries(currentSpecValues()).filter(([, v]) => v !== "");

    el("preview-content").innerHTML = `
      <section>
        <div class="mb-2 flex items-center justify-between">
          <h3 class="text-sm font-semibold">Basic information</h3>
          ${jumpLink(1, "Edit step 1")}
        </div>
        <dl class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          ${previewRow("Name", el("field-name").value)}
          ${previewRow("SKU", el("field-sku").value)}
          ${previewRow("Brand", brand ? brand.name : "")}
          ${previewRow("Category", category ? category.name : "")}
          ${previewRow("Status", el("field-status").value)}
          ${previewRow("Description", el("field-description").value)}
        </dl>
        <dl class="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          ${previewRow("MRP", mrp ? H.formatINR(mrp * 100) : "")}
          ${previewRow("Discount", `${discount}%`)}
          ${previewRow(variants.length ? "Selling price (from)" : "Selling price", selling ? H.formatINR(selling) : "")}
          ${previewRow("Stock", el("field-stock").value)}
        </dl>
      </section>

      <section>
        <div class="mb-2 flex items-center justify-between">
          <h3 class="text-sm font-semibold">Images and specifications</h3>
          ${jumpLink(2, "Edit step 2")}
        </div>
        <p class="text-sm">${selectedImages.length} image(s) selected</p>
        ${
          specs.length
            ? `<dl class="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">${specs
                .map(([k, v]) => previewRow(k.replace("::", " · "), v))
                .join("")}</dl>`
            : `<p class="mt-2 text-sm text-neutral-400 dark:text-slate-500">No specification values entered.</p>`
        }
      </section>

      <section>
        <div class="mb-2 flex items-center justify-between">
          <h3 class="text-sm font-semibold">Variants</h3>
          ${jumpLink(3, "Edit step 3")}
        </div>
        ${
          variants.length
            ? `<div class="overflow-x-auto"><table class="w-full text-left text-sm">
                <thead class="border-b border-neutral-200 text-xs uppercase text-neutral-500 dark:border-slate-800 dark:text-slate-400">
                  <tr><th class="px-2 py-1">SKU</th><th class="px-2 py-1">Attributes</th><th class="px-2 py-1">Selling price</th><th class="px-2 py-1">Stock</th><th class="px-2 py-1">Active</th></tr>
                </thead>
                <tbody>${variants
                  .map(
                    (
                      v,
                    ) => `<tr class="border-b border-neutral-100 last:border-0 dark:border-slate-800">
                      <td class="px-2 py-1">${v.sku}</td>
                      <td class="px-2 py-1">${v.attributes.map((a) => `${a.name}=${a.value}`).join(", ") || "—"}</td>
                      <td class="px-2 py-1">${v.mrp ? H.formatINR(H.computeSellingPrice(v.mrp, v.discount)) : "—"}</td>
                      <td class="px-2 py-1">${v.stock}</td>
                      <td class="px-2 py-1">${v.active ? "Yes" : "No"}</td>
                    </tr>`,
                  )
                  .join("")}</tbody>
              </table></div>`
            : `<p class="text-sm text-neutral-400 dark:text-slate-500">No variants — this product sells via its own SKU/price/stock.</p>`
        }
      </section>
    `;

    el("preview-content")
      .querySelectorAll("[data-jump]")
      .forEach((btn) =>
        btn.addEventListener("click", () => goTo(Number(btn.getAttribute("data-jump")))),
      );
  }

  // --- Stepper and navigation -------------------------------------------

  function renderStepper() {
    stepper.innerHTML = STEPS.map((step) => {
      const isCurrent = step.n === current;
      const isComplete = step.n < furthest;
      const reachable = step.n <= furthest;
      const tone = isCurrent
        ? "border-indigo-600 bg-indigo-600 text-white dark:border-indigo-500 dark:bg-indigo-500"
        : isComplete
          ? "border-indigo-300 text-indigo-700 dark:border-indigo-500/50 dark:text-indigo-300"
          : "border-neutral-200 text-neutral-400 dark:border-slate-800 dark:text-slate-600";
      const inner = `<span class="flex h-5 w-5 items-center justify-center rounded-full border text-[11px]">${step.n}</span><span class="hidden sm:inline">${step.label}</span>`;
      return `<li>
        <button
          type="button"
          data-step-to="${step.n}"
          ${reachable ? "" : "disabled"}
          ${isCurrent ? 'aria-current="step"' : ""}
          class="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium ${tone} ${reachable ? "" : "cursor-not-allowed"} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >${inner}</button>
      </li>`;
    }).join("");

    stepper.querySelectorAll("button[data-step-to]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = Number(btn.getAttribute("data-step-to"));
        if (target <= furthest) goTo(target);
      });
    });
  }

  function showStep(n) {
    STEPS.forEach((s) =>
      document.querySelector(`[data-step="${s.n}"]`).classList.toggle("hidden", s.n !== n),
    );
    backBtn.disabled = n === 1;
    nextBtn.classList.toggle("hidden", n === STEPS.length);
    saveBtn.classList.toggle("hidden", n !== STEPS.length);
    renderStepper();

    stepStatus.textContent = `Step ${n} of ${STEPS.length}: ${STEPS[n - 1].label}`;
    const heading = document.getElementById(`step-${n}-heading`);
    if (heading) heading.focus();
  }

  function goTo(n) {
    current = n;
    if (n === 4) renderPreview();
    showStep(n);
  }

  nextBtn.addEventListener("click", () => {
    if (!validate(current)) {
      const firstInvalid = document.querySelector(`[data-step="${current}"] [aria-invalid="true"]`);
      if (firstInvalid) firstInvalid.focus();
      return;
    }
    const next = Math.min(current + 1, STEPS.length);
    furthest = Math.max(furthest, next);
    goTo(next);
  });

  backBtn.addEventListener("click", () => goTo(Math.max(current - 1, 1)));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const banner = el("saved-banner");
    banner.classList.remove("hidden");
    banner.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  // --- Wiring ------------------------------------------------------------

  el("field-mrp").addEventListener("input", updateSellingPrice);
  el("field-discount").addEventListener("input", updateSellingPrice);
  el("field-category").addEventListener("change", onCategoryChange);

  el("field-images").addEventListener("change", (e) => {
    selectedImages = Array.from(e.target.files || []);
    const previews = el("image-previews");
    previews.innerHTML = selectedImages
      .map(
        (file) =>
          `<img src="${URL.createObjectURL(file)}" alt="${file.name}" class="h-16 w-16 rounded-md object-cover" />`,
      )
      .join("");
    setError("field-images", "");
  });

  el("add-variant-btn").addEventListener("click", () => addVariantRow());

  el("variant-rows").addEventListener("click", (e) => {
    const removeVariant = e.target.closest("[data-remove-variant]");
    if (removeVariant) {
      removeVariant.closest("[data-variant-row]").remove();
      updateVariantNote();
      return;
    }
    const addAttr = e.target.closest("[data-add-attr]");
    if (addAttr) {
      addAttr.parentElement
        .querySelector("[data-free-attrs]")
        .insertAdjacentHTML("beforeend", freeAttrRow("", ""));
      return;
    }
    const removeAttr = e.target.closest("[data-remove-attr]");
    if (removeAttr) removeAttr.closest("[data-attr-row]").remove();
  });

  el("variant-rows").addEventListener("input", (e) => {
    if (e.target.matches("[data-v-mrp], [data-v-discount]")) {
      updateVariantSelling(e.target.closest("[data-variant-row]"));
    }
  });

  // Leaving mid-wizard discards the draft, so warn first (section 6.3).
  let dirty = false;
  form.addEventListener("input", () => (dirty = true));
  window.addEventListener("beforeunload", (e) => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  // --- Prefill -----------------------------------------------------------

  populateBrands();
  populateCategories();

  if (editing) {
    el("form-title").textContent = "Edit product";
    el("breadcrumb-current").textContent = editing.name;
    document.title = `TechCart Admin — Edit ${editing.name}`;
    el("field-name").value = editing.name;
    el("field-sku").value = editing.sku;
    el("field-brand").value = editing.brandId;
    el("field-category").value = editing.categoryId;
    el("field-status").value = editing.status;
    el("field-description").value = editing.description;
    el("field-mrp").value = editing.mrp / 100;
    el("field-discount").value = editing.discount;
    el("field-stock").value = editing.stock;
    lastCategoryId = editing.categoryId;

    const preserved = {};
    (editing.specifications || []).forEach((group) => {
      group.values.forEach((v) => {
        preserved[`${group.groupName}::${v.name}`] = String(v.value);
      });
    });
    renderSpecFields(preserved);
    (editing.variants || []).forEach(addVariantRow);
    // Images can't round-trip through a file input; the prototype notes this.
    selectedImages = (editing.images || []).map((src) => ({ name: src }));
    el("image-previews").innerHTML = (editing.images || [])
      .map(
        (src) =>
          `<div class="flex h-16 w-16 items-center justify-center rounded-md bg-neutral-100 text-[10px] text-neutral-400 dark:bg-slate-800 dark:text-slate-500">${src}</div>`,
      )
      .join("");
  } else {
    renderSpecFields({});
  }

  updateSellingPrice();
  updateVariantNote();
  showStep(1);
})();
