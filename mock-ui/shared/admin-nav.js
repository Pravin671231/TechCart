// Injects the console sidebar into <div id="admin-nav"></div> on every
// admin/*.html page. `data-page` on <body> marks the active link.
//
// Built to docs/ui/admin-app.md section 3.2: the nav mirrors docs/srs/SRS.md
// section 3's feature index, so navigation and project scope can't drift apart.
// Only Product Catalog (v0.2) has a spec, so it's the only enabled entry; the
// other five render disabled with their SRS version shown as visible text
// (not a tooltip — a tooltip is invisible on touch and to screen readers).

(function () {
  const Shell = window.AdminShell;
  const activePage = document.body.getAttribute("data-page") || "";
  const mount = document.getElementById("admin-nav");

  const ICONS = {
    products: `<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>`,
    categories: `<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>`,
    brands: `<path d="M20.59 13.41L13.42 20.58a2 2 0 0 1-2.83 0L2.83 12.83a2 2 0 0 1 0-2.83l7.17-7.17A2 2 0 0 1 11.41 2H18a2 2 0 0 1 2 2v6.59a2 2 0 0 1-.59 1.41z"/><line x1="7" y1="7" x2="7.01" y2="7"/>`,
    catalog: `<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/>`,
    users: `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
    cart: `<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>`,
    orders: `<path d="M9 2h6a1 1 0 0 1 1 1v1H8V3a1 1 0 0 1 1-1z"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="13" y2="16"/>`,
    payments: `<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>`,
    dashboard: `<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>`,
  };

  function icon(name, extra) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="h-5 w-5 shrink-0 ${extra || ""}">${ICONS[name]}</svg>`;
  }

  // Mirrors docs/srs/SRS.md section 3. `version` is the SRS version that will
  // define the feature; only v0.2 is written, so only catalog is enabled.
  const NAV = [
    {
      label: "Product Catalog",
      icon: "catalog",
      version: "v0.2",
      enabled: true,
      children: [
        { href: "index.html", label: "Products", page: "products", icon: "products" },
        { href: "categories.html", label: "Categories", page: "categories", icon: "categories" },
        { href: "brands.html", label: "Brands", page: "brands", icon: "brands" },
      ],
    },
    { label: "User Management", icon: "users", version: "v0.3", enabled: false },
    { label: "Cart Management", icon: "cart", version: "v0.4", enabled: false },
    { label: "Order Management", icon: "orders", version: "v0.5", enabled: false },
    { label: "Payments", icon: "payments", version: "v0.6", enabled: false },
    { label: "Dashboard", icon: "dashboard", version: "v0.7", enabled: false },
  ];

  function counts() {
    return {
      products: window.MOCK.products.length,
      categories: window.MOCK.categories.length,
      brands: window.MOCK.brands.length,
    };
  }

  const BASE_ITEM = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors";
  const IDLE_ITEM = "text-slate-300 hover:bg-white/5 hover:text-white";
  const ACTIVE_ITEM = "bg-indigo-600 font-medium text-white dark:bg-indigo-500";
  const FOCUS_RING =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900";

  function childLink(child, count, collapsed) {
    const active = child.page === activePage;
    const cls = `${BASE_ITEM} ${FOCUS_RING} ${active ? ACTIVE_ITEM : IDLE_ITEM} ${collapsed ? "justify-center px-0" : "justify-between"}`;
    const badgeCls = active ? "bg-white/20 text-white" : "bg-white/10 text-slate-400";

    if (collapsed) {
      return `<a href="${child.href}" class="${cls}" title="${child.label}" aria-label="${child.label}"${active ? ' aria-current="page"' : ""}>${icon(child.icon)}</a>`;
    }
    return `
      <a href="${child.href}" class="${cls}"${active ? ' aria-current="page"' : ""}>
        <span class="flex items-center gap-3">${icon(child.icon)}${child.label}</span>
        <span class="rounded-full ${badgeCls} px-2 py-0.5 text-xs font-medium">${count}</span>
      </a>
    `;
  }

  // Disabled entries are not links and not focusable — there is nothing behind
  // them yet (docs/ui/admin-app.md section 5.6).
  function disabledItem(item, collapsed) {
    const cls = `${BASE_ITEM} cursor-not-allowed text-slate-500 ${collapsed ? "justify-center px-0" : "justify-between"}`;
    const label = `${item.label} — not yet built, arrives in SRS ${item.version}`;

    if (collapsed) {
      return `<span class="${cls}" role="link" aria-disabled="true" title="${label}" aria-label="${label}">${icon(item.icon, "opacity-60")}</span>`;
    }
    return `
      <span class="${cls}" role="link" aria-disabled="true" aria-label="${label}">
        <span class="flex items-center gap-3">${icon(item.icon, "opacity-60")}${item.label}</span>
        <span class="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">${item.version}</span>
      </span>
    `;
  }

  function sectionLabel(text, collapsed) {
    if (collapsed) return `<div class="mx-3 my-2 border-t border-white/10"></div>`;
    return `<p class="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-slate-500">${text}</p>`;
  }

  function render() {
    const collapsed = Shell.isCollapsed() && Shell.isDesktop();
    const drawerOpen = Shell.isDrawerOpen();
    const c = counts();
    const width = collapsed ? "w-16" : "w-64";

    const catalog = NAV[0];
    const notBuilt = NAV.slice(1);

    const body = `
      ${sectionLabel("Catalog", collapsed)}
      <div class="space-y-1">
        ${catalog.children.map((ch) => childLink(ch, c[ch.page], collapsed)).join("")}
      </div>
      ${sectionLabel("Not yet built", collapsed)}
      <div class="space-y-1">
        ${notBuilt.map((item) => disabledItem(item, collapsed)).join("")}
      </div>
    `;

    // The sidebar is fixed beneath the header, so this mount occupies no
    // layout space at any breakpoint — <main> carries the offset instead
    // (docs/ui/admin-app.md section 3.6).
    mount.className = "";

    mount.innerHTML = `
      <div
        data-overlay
        class="fixed bottom-0 left-0 right-0 top-16 z-20 bg-slate-950/60 backdrop-blur-sm lg:hidden ${drawerOpen ? "" : "hidden"}"
      ></div>

      <aside
        id="admin-sidebar"
        class="fixed left-0 top-16 z-30 flex h-[calc(100dvh-4rem)] ${width} flex-col border-r border-white/10 bg-slate-900 text-slate-300 transition-[transform,width] duration-200 dark:border-slate-800 dark:bg-slate-950 lg:translate-x-0 ${drawerOpen ? "translate-x-0 shadow-lg" : "-translate-x-full"}"
        aria-label="Main navigation"
      >
        <div class="flex items-center gap-2.5 border-b border-white/10 px-4 py-4 dark:border-slate-800 ${collapsed ? "justify-center px-0" : ""}">
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white dark:bg-indigo-500">T</span>
          ${collapsed ? "" : `<a href="index.html" class="text-lg font-semibold tracking-tight text-white ${FOCUS_RING} rounded">TechCart<span class="text-indigo-400">Admin</span></a>`}
        </div>

        <nav class="flex-1 overflow-y-auto p-3">${body}</nav>

        <div class="border-t border-white/10 p-3 text-center dark:border-slate-800">
          <p class="text-[10px] uppercase tracking-wider text-slate-600">${collapsed ? "v0.2" : "Prototype · SRS v0.2"}</p>
        </div>
      </aside>
    `;

    mount
      .querySelector("[data-overlay]")
      .addEventListener("click", () => Shell.setDrawerOpen(false));
  }

  Shell.onSidebarChange(render);
  window.addEventListener("resize", () => {
    // Desktop/mobile swap changes whether the rail width occupies layout space.
    render();
  });

  // Let list pages refresh the count badges after a create/delete, so the
  // sidebar can't go stale (docs/ui/admin-app.md section 6.6).
  window.AdminNav = { refresh: render };

  render();
})();
