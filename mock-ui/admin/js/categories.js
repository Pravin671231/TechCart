// Admin category list (admin/categories.html) — FR-CAT-021-025, 063-064, 066-067.
// Mutates window.MOCK.categories/categorySpecifications/categoryVariants directly in
// memory (no backend, resets on reload) so create/edit/delete-guard actually behave,
// not just render once.

(function () {
  const MOCK = window.MOCK;
  const state = { query: "" };
  let editingId = null;
  let idCounter = 100;
  let pendingImageUrl = null;

  function slugify(name) {
    const base = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    let slug = base;
    let suffix = 2;
    while (MOCK.categories.some((c) => c.slug === slug && c.id !== editingId)) {
      slug = `${base}-${suffix}`;
      suffix += 1;
    }
    return slug;
  }

  function productCount(categoryId) {
    return MOCK.products.filter((p) => p.categoryId === categoryId).length;
  }

  function subcategoryCount(categoryId) {
    return MOCK.categories.filter((c) => c.parentCategoryId === categoryId).length;
  }

  function statusBadge(category) {
    const active = category.status !== false;
    const cls = active ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500";
    return `<button data-toggle-status="${category.id}" class="rounded px-2 py-0.5 text-xs font-medium ${cls}" title="Click to toggle (FR-CAT-063)">${active ? "Active" : "Inactive"}</button>`;
  }

  function renderTable() {
    const rowsEl = document.getElementById("category-rows");
    const q = state.query.trim().toLowerCase();
    const results = q ? MOCK.categories.filter((c) => c.name.toLowerCase().includes(q)) : MOCK.categories;

    if (results.length === 0) {
      rowsEl.innerHTML = `<tr><td colspan="5" class="px-3 py-8 text-center text-neutral-400">No categories match this search.</td></tr>`;
    } else {
      rowsEl.innerHTML = results
        .map((c) => {
          const parent = c.parentCategoryId ? MOCK.categories.find((p) => p.id === c.parentCategoryId) : null;
          const count = productCount(c.id);
          return `
            <tr class="border-b border-neutral-100 last:border-0" data-row-for="${c.id}">
              <td class="px-3 py-2 font-medium">${c.name}</td>
              <td class="px-3 py-2 text-neutral-500">${parent ? parent.name : "—"}</td>
              <td class="px-3 py-2">${count}</td>
              <td class="px-3 py-2">${statusBadge(c)}</td>
              <td class="px-3 py-2 text-right">
                <button data-edit="${c.id}" class="mr-3 text-sm text-neutral-600 underline hover:text-neutral-900">Edit</button>
                <button data-delete="${c.id}" class="text-sm text-red-600 underline hover:text-red-800">Delete</button>
              </td>
            </tr>
            <tr data-error-for="${c.id}" class="hidden"><td colspan="5" class="px-3 pb-2 text-xs text-red-600"></td></tr>
          `;
        })
        .join("");
    }

    rowsEl.querySelectorAll("button[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => startEdit(btn.getAttribute("data-edit")));
    });
    rowsEl.querySelectorAll("button[data-delete]").forEach((btn) => {
      btn.addEventListener("click", () => attemptDelete(btn.getAttribute("data-delete")));
    });
    rowsEl.querySelectorAll("button[data-toggle-status]").forEach((btn) => {
      btn.addEventListener("click", () => toggleStatus(btn.getAttribute("data-toggle-status")));
    });
  }

  function toggleStatus(id) {
    const category = MOCK.categories.find((c) => c.id === id);
    if (!category) return;
    category.status = category.status === false ? true : false;
    renderTable();
  }

  function populateParentSelect() {
    const select = document.getElementById("cat-parent");
    const topLevel = MOCK.categories.filter((c) => c.parentCategoryId === null && c.id !== editingId);
    select.innerHTML =
      `<option value="">None (top-level)</option>` + topLevel.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
  }

  // ---- Variant-type editor (FR-CAT-066/067) — shown only while editing an existing category ----

  function getVariantTypeDoc(categoryId) {
    return MOCK.categoryVariants.find((cv) => cv.categoryId === categoryId) || null;
  }

  function renderVariantTypesPanel(categoryId) {
    const category = MOCK.categories.find((c) => c.id === categoryId);
    document.getElementById("variant-types-category-name").textContent = category ? category.name : "";
    document.getElementById("variant-types-panel").classList.remove("hidden");

    const doc = getVariantTypeDoc(categoryId);
    const types = doc ? doc.variants : [];
    const rowsEl = document.getElementById("variant-type-rows");
    rowsEl.innerHTML = types.length
      ? types
          .map(
            (t, i) => `
              <div class="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2 text-sm">
                <div>
                  <span class="font-medium">${t.name}</span>
                  <span class="ml-2 text-xs text-neutral-400">${t.code} · ${t.type}${t.required ? " · required (UI hint)" : ""}</span>
                  ${t.options && t.options.length ? `<div class="mt-0.5 text-xs text-neutral-500">${t.options.map((o) => o.label).join(", ")}</div>` : ""}
                </div>
                <button data-remove-variant-type="${i}" class="text-xs text-red-600 underline hover:text-red-800">Remove</button>
              </div>
            `,
          )
          .join("")
      : `<p class="text-xs text-neutral-400">No variant types defined for this category yet.</p>`;

    rowsEl.querySelectorAll("button[data-remove-variant-type]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const index = Number(btn.getAttribute("data-remove-variant-type"));
        const d = getVariantTypeDoc(categoryId);
        if (!d) return;
        // No in-use guard (FR-CAT-067) — removing a variant-type definition is never blocked.
        d.variants.splice(index, 1);
        renderVariantTypesPanel(categoryId);
      });
    });
  }

  function hideVariantTypesPanel() {
    document.getElementById("variant-types-panel").classList.add("hidden");
  }

  function parseOptions(raw) {
    return raw
      .split(",")
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((chunk) => {
        const [label, value] = chunk.split(":").map((s) => s.trim());
        return { label: label || chunk, value: value || label || chunk };
      });
  }

  document.getElementById("add-variant-type-btn").addEventListener("click", () => {
    if (!editingId) return;
    const name = document.getElementById("vt-name").value.trim();
    const code = document.getElementById("vt-code").value.trim();
    const type = document.getElementById("vt-type").value;
    const required = document.getElementById("vt-required").checked;
    const optionsRaw = document.getElementById("vt-options").value.trim();
    if (!name || !code) return;

    let doc = getVariantTypeDoc(editingId);
    if (!doc) {
      doc = { id: `cv-${editingId}`, categoryId: editingId, variants: [] };
      MOCK.categoryVariants.push(doc);
    }
    doc.variants.push({
      name,
      code,
      type,
      required,
      options: type === "select" || type === "color" ? parseOptions(optionsRaw) : [],
    });

    document.getElementById("vt-name").value = "";
    document.getElementById("vt-code").value = "";
    document.getElementById("vt-required").checked = false;
    document.getElementById("vt-options").value = "";
    renderVariantTypesPanel(editingId);
  });

  // ---- Category CRUD ----

  function startEdit(id) {
    const category = MOCK.categories.find((c) => c.id === id);
    if (!category) return;
    editingId = id;
    pendingImageUrl = category.image;
    document.getElementById("form-heading").textContent = `Edit ${category.name}`;
    populateParentSelect();
    document.getElementById("cat-name").value = category.name;
    document.getElementById("cat-parent").value = category.parentCategoryId || "";
    document.getElementById("cat-status").checked = category.status !== false;
    document.getElementById("cancel-edit-btn").classList.remove("hidden");
    renderVariantTypesPanel(id);
  }

  function resetForm() {
    editingId = null;
    pendingImageUrl = null;
    document.getElementById("form-heading").textContent = "New category";
    document.getElementById("category-form").reset();
    document.getElementById("cat-status").checked = true;
    populateParentSelect();
    document.getElementById("cancel-edit-btn").classList.add("hidden");
    hideVariantTypesPanel();
  }

  function attemptDelete(id) {
    const errorRow = document.querySelector(`tr[data-error-for="${id}"]`);
    const count = productCount(id);
    const subcount = subcategoryCount(id);
    if (count > 0 || subcount > 0) {
      const reasons = [];
      if (count > 0) reasons.push(`${count} product${count === 1 ? "" : "s"}`);
      if (subcount > 0) reasons.push(`${subcount} subcategor${subcount === 1 ? "y" : "ies"}`);
      errorRow.querySelector("td").textContent = `Cannot delete: still has ${reasons.join(" and ")} assigned. Reassign or remove them first.`;
      errorRow.classList.remove("hidden");
      return;
    }
    // Cascades to delete this category's categorySpecification and categoryVariants
    // definitions (FR-CAT-024).
    MOCK.categories = MOCK.categories.filter((c) => c.id !== id);
    MOCK.categorySpecifications = MOCK.categorySpecifications.filter((cs) => cs.categoryId !== id);
    MOCK.categoryVariants = MOCK.categoryVariants.filter((cv) => cv.categoryId !== id);
    if (editingId === id) resetForm();
    renderTable();
  }

  document.getElementById("cat-image").addEventListener("change", (e) => {
    const file = e.target.files[0];
    pendingImageUrl = file ? URL.createObjectURL(file) : pendingImageUrl;
  });

  document.getElementById("category-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("cat-name").value.trim();
    const parentCategoryId = document.getElementById("cat-parent").value || null;
    const status = document.getElementById("cat-status").checked;
    if (!name) return;

    if (editingId) {
      const category = MOCK.categories.find((c) => c.id === editingId);
      category.name = name;
      category.slug = slugify(name);
      category.parentCategoryId = parentCategoryId;
      category.status = status;
      category.image = pendingImageUrl;
    } else {
      idCounter += 1;
      MOCK.categories.push({
        id: `c${idCounter}`,
        name,
        slug: slugify(name),
        parentCategoryId,
        status,
        image: pendingImageUrl,
      });
    }
    resetForm();
    renderTable();
  });

  document.getElementById("cancel-edit-btn").addEventListener("click", resetForm);

  document.getElementById("search-box").addEventListener("input", (e) => {
    state.query = e.target.value;
    renderTable();
  });

  populateParentSelect();
  renderTable();
})();
