// Admin brand list (admin/brands.html) — FR-CAT-033-037, 065.
// Mutates window.MOCK.brands directly in memory (no backend, resets on
// reload) so create/edit/delete-guard actually behave, not just render once.

(function () {
  const MOCK = window.MOCK;
  const T = window.AdminTable;
  const state = { query: "", sort: { key: null, dir: null } };
  let editingId = null;
  let idCounter = 100;
  let pendingLogoUrl = null;

  const COLUMNS = [
    { key: null, label: "Logo", sortable: false },
    { key: "name", label: "Name", sortable: true },
    { key: "products", label: "Products (all statuses)", sortable: true },
    { key: "status", label: "Status", sortable: true },
    { key: null, label: "Actions", sortable: false },
  ];

  const SORT_ACCESSORS = {
    name: (b) => b.name,
    products: (b) => productCount(b.id),
    status: (b) => (b.status === false ? "Inactive" : "Active"),
  };

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
    const cls = active ? T.STATUS_TONES.published : T.STATUS_TONES.inactive;
    return `<button data-toggle-status="${brand.id}" class="rounded px-2 py-0.5 text-xs font-medium ${cls} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400" title="Click to toggle (FR-CAT-065)">${active ? "Active" : "Inactive"}</button>`;
  }

  function renderTable() {
    const rowsEl = document.getElementById("brand-rows");

    T.renderHead(document.getElementById("brand-head"), COLUMNS, state.sort, (next) => {
      state.sort = next;
      renderTable();
    });

    const q = state.query.trim().toLowerCase();
    const filtered = q ? MOCK.brands.filter((b) => b.name.toLowerCase().includes(q)) : MOCK.brands;
    const results = T.applySort(filtered, state.sort, SORT_ACCESSORS);

    if (results.length === 0) {
      rowsEl.innerHTML = `<tr><td colspan="${COLUMNS.length}" class="px-3 py-8 text-center text-neutral-400 dark:text-slate-500">No brands match this search.</td></tr>`;
    } else {
      rowsEl.innerHTML = results
        .map((b) => {
          const count = productCount(b.id);
          return `
            <tr class="border-b border-neutral-100 last:border-0 dark:border-slate-800" data-row-for="${b.id}">
              <td class="px-3 py-2">
                ${b.logo ? `<img src="${b.logo}" class="h-8 w-8 rounded object-cover" alt="${b.name} logo" />` : `<div class="flex h-8 w-8 items-center justify-center rounded bg-neutral-100 text-[10px] text-neutral-400 dark:bg-slate-800 dark:text-slate-500">—</div>`}
              </td>
              <td class="px-3 py-2 font-medium">${b.name}</td>
              <td class="px-3 py-2">${count}</td>
              <td class="px-3 py-2">${statusBadge(b)}</td>
              <td class="px-3 py-2 text-right">
                <button data-edit="${b.id}" class="mr-3 text-sm text-neutral-600 underline hover:text-neutral-900 dark:text-slate-400 dark:hover:text-slate-100">Edit</button>
                <button data-delete="${b.id}" class="text-sm text-red-600 underline hover:text-red-800 dark:text-red-400">Delete</button>
              </td>
            </tr>
            <tr data-error-for="${b.id}" class="hidden"><td colspan="${COLUMNS.length}" class="px-3 pb-2 text-xs text-red-600 dark:text-red-400" role="alert"></td></tr>
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
    refreshCounts();
  }

  // The list, the sidebar badges and the result count refresh together after a
  // mutation (docs/ui/admin-app.md section 6.6).
  function refreshCounts() {
    if (window.AdminNav) window.AdminNav.refresh();
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
    refreshCounts();
  });

  document.getElementById("cancel-edit-btn").addEventListener("click", resetForm);

  // The Add button targets the side form rather than opening a modal — editing
  // and creating share one persistent panel (docs/ui/admin-app.md section 4).
  document.getElementById("add-btn").addEventListener("click", () => {
    resetForm();
    document.getElementById("brand-name").focus();
  });

  document.getElementById("search-box").addEventListener("input", (e) => {
    state.query = e.target.value;
    renderTable();
  });

  renderTable();
})();
