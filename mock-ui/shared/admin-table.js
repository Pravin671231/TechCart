// Sortable table headers + pagination for the admin list screens.
// Built to docs/ui/admin/admin-main-ui.md section 7.5: the sort control is a real <button>
// inside the <th>, the <th> carries aria-sort, and the cycle is
// ascending -> descending -> unsorted. Pagination sits below the table and
// marks the active page with aria-current.

(function () {
  const HEAD_BTN =
    "flex w-full items-center gap-1 text-left text-xs font-semibold uppercase text-neutral-500 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:text-slate-400 dark:hover:text-slate-100";

  const ARROWS = {
    asc: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true" class="h-3 w-3"><polyline points="18 15 12 9 6 15"/></svg>`,
    desc: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true" class="h-3 w-3"><polyline points="6 9 12 15 18 9"/></svg>`,
    none: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" class="h-3 w-3 opacity-30"><polyline points="8 9 12 5 16 9"/><polyline points="16 15 12 19 8 15"/></svg>`,
  };

  // asc -> desc -> unsorted
  function nextSort(current, key) {
    if (current.key !== key) return { key, dir: "asc" };
    if (current.dir === "asc") return { key, dir: "desc" };
    return { key: null, dir: null };
  }

  // columns: [{ key, label, sortable }] — key null/absent means never sortable
  function renderHead(container, columns, sort, onSort) {
    container.innerHTML = columns
      .map((col) => {
        if (!col.sortable) {
          return `<th scope="col" class="px-3 py-2">${col.label}</th>`;
        }
        const active = sort.key === col.key;
        const dir = active ? sort.dir : "none";
        const ariaSort = active ? (dir === "asc" ? "ascending" : "descending") : "none";
        return `
          <th scope="col" class="px-3 py-2" aria-sort="${ariaSort}">
            <button type="button" data-sort-key="${col.key}" class="${HEAD_BTN} ${active ? "text-neutral-900 dark:text-slate-100" : ""}">
              ${col.label}${ARROWS[dir]}
            </button>
          </th>
        `;
      })
      .join("");

    container.querySelectorAll("button[data-sort-key]").forEach((btn) => {
      btn.addEventListener("click", () =>
        onSort(nextSort(sort, btn.getAttribute("data-sort-key"))),
      );
    });
  }

  // accessors: { columnKey: (row) => comparableValue }
  function applySort(rows, sort, accessors) {
    if (!sort.key || !accessors[sort.key]) return rows;
    const get = accessors[sort.key];
    const factor = sort.dir === "desc" ? -1 : 1;
    return rows.slice().sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
      return String(av).localeCompare(String(bv), "en", { sensitivity: "base" }) * factor;
    });
  }

  function renderPagination(container, { page, pageSize, total, onPageChange }) {
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    if (pageCount <= 1) {
      container.innerHTML = "";
      return;
    }
    let buttons = "";
    for (let i = 1; i <= pageCount; i++) {
      const active = i === page;
      buttons += `
        <button
          type="button"
          data-page="${i}"
          ${active ? 'aria-current="page"' : ""}
          class="rounded-md px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
            active
              ? "bg-indigo-600 text-white dark:bg-indigo-500"
              : "border border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          }"
        >${i}</button>
      `;
    }
    container.innerHTML = buttons;
    container.querySelectorAll("button[data-page]").forEach((btn) => {
      btn.addEventListener("click", () => onPageChange(Number(btn.getAttribute("data-page"))));
    });
  }

  const STATUS_TONES = {
    draft: "bg-neutral-100 text-neutral-600 dark:bg-slate-700/50 dark:text-slate-300",
    published: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    archived: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
    inactive: "bg-neutral-100 text-neutral-500 dark:bg-slate-700/50 dark:text-slate-400",
  };

  function statusBadge(status) {
    const tone = STATUS_TONES[status] || STATUS_TONES.draft;
    return `<span class="rounded px-2 py-0.5 text-xs font-medium ${tone}">${status}</span>`;
  }

  window.AdminTable = {
    renderHead,
    applySort,
    renderPagination,
    statusBadge,
    STATUS_TONES,
    nextSort,
  };
})();
