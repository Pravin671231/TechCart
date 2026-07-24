// Admin brand list (admin/brands.html) — FR-CAT-033-037, 065.
// Mutates window.MOCK.brands directly in memory (no backend, resets on
// reload) so create/edit/delete-guard actually behave, not just render once.

(function () {
  const MOCK = window.MOCK;
  const state = { query: "" };
  let editingId = null;
  let idCounter = 100;
  let pendingLogoUrl = null;

  function slugify(name) {
    const base = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    let slug = base;
    let suffix = 2;
    while (MOCK.brands.some((b) => b.slug === slug && b.id !== editingId)) {
      slug = `${base}-${suffix}`;
      suffix += 1;
    }
    return slug;
  }

  // Any status counts toward the delete-guard (FR-CAT-036), not just published.
  function productCount(brandId) {
    return MOCK.products.filter((p) => p.brandId === brandId).length;
  }

  function statusBadge(brand) {
    const active = brand.status !== false;
    const cls = active ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500";
    return `<button data-toggle-status="${brand.id}" class="rounded px-2 py-0.5 text-xs font-medium ${cls}" title="Click to toggle (FR-CAT-065)">${active ? "Active" : "Inactive"}</button>`;
  }

  function renderTable() {
    const rowsEl = document.getElementById("brand-rows");
    const q = state.query.trim().toLowerCase();
    const results = q ? MOCK.brands.filter((b) => b.name.toLowerCase().includes(q)) : MOCK.brands;

    if (results.length === 0) {
      rowsEl.innerHTML = `<tr><td colspan="5" class="px-3 py-8 text-center text-neutral-400">No brands match this search.</td></tr>`;
    } else {
      rowsEl.innerHTML = results
        .map((b) => {
          const count = productCount(b.id);
          return `
            <tr class="border-b border-neutral-100 last:border-0" data-row-for="${b.id}">
              <td class="px-3 py-2">
                ${b.logo ? `<img src="${b.logo}" class="h-8 w-8 rounded object-cover" alt="${b.name} logo" />` : `<div class="flex h-8 w-8 items-center justify-center rounded bg-neutral-100 text-[10px] text-neutral-400">—</div>`}
              </td>
              <td class="px-3 py-2 font-medium">${b.name}</td>
              <td class="px-3 py-2">${count}</td>
              <td class="px-3 py-2">${statusBadge(b)}</td>
              <td class="px-3 py-2 text-right">
                <button data-edit="${b.id}" class="mr-3 text-sm text-neutral-600 underline hover:text-neutral-900">Edit</button>
                <button data-delete="${b.id}" class="text-sm text-red-600 underline hover:text-red-800">Delete</button>
              </td>
            </tr>
            <tr data-error-for="${b.id}" class="hidden"><td colspan="5" class="px-3 pb-2 text-xs text-red-600"></td></tr>
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
    const brand = MOCK.brands.find((b) => b.id === id);
    if (!brand) return;
    brand.status = brand.status === false ? true : false;
    renderTable();
  }

  function startEdit(id) {
    const brand = MOCK.brands.find((b) => b.id === id);
    if (!brand) return;
    editingId = id;
    pendingLogoUrl = brand.logo;
    document.getElementById("form-heading").textContent = `Edit ${brand.name}`;
    document.getElementById("brand-name").value = brand.name;
    document.getElementById("brand-description").value = brand.description || "";
    document.getElementById("brand-status").checked = brand.status !== false;
    document.getElementById("cancel-edit-btn").classList.remove("hidden");
  }

  function resetForm() {
    editingId = null;
    pendingLogoUrl = null;
    document.getElementById("form-heading").textContent = "New brand";
    document.getElementById("brand-form").reset();
    document.getElementById("brand-status").checked = true;
    document.getElementById("cancel-edit-btn").classList.add("hidden");
  }

  function attemptDelete(id) {
    const errorRow = document.querySelector(`tr[data-error-for="${id}"]`);
    const count = productCount(id);
    if (count > 0) {
      errorRow.querySelector("td").textContent =
        `Cannot delete: ${count} product${count === 1 ? "" : "s"} (any status) still reference this brand.`;
      errorRow.classList.remove("hidden");
      return;
    }
    MOCK.brands = MOCK.brands.filter((b) => b.id !== id);
    if (editingId === id) resetForm();
    renderTable();
  }

  document.getElementById("brand-logo").addEventListener("change", (e) => {
    const file = e.target.files[0];
    pendingLogoUrl = file ? URL.createObjectURL(file) : pendingLogoUrl;
  });

  document.getElementById("brand-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("brand-name").value.trim();
    const description = document.getElementById("brand-description").value.trim();
    const status = document.getElementById("brand-status").checked;
    if (!name) return;

    if (editingId) {
      const brand = MOCK.brands.find((b) => b.id === editingId);
      brand.name = name;
      brand.slug = slugify(name);
      brand.description = description || undefined;
      brand.logo = pendingLogoUrl;
      brand.status = status;
    } else {
      idCounter += 1;
      MOCK.brands.push({
        id: `b${idCounter}`,
        name,
        slug: slugify(name),
        description: description || undefined,
        logo: pendingLogoUrl,
        status,
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

  renderTable();
})();
