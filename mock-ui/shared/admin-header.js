// Injects the console header into <div id="admin-header"></div> on every
// admin/*.html page — sidebar toggle, catalog search, theme toggle, user menu.
//
// Built to docs/ui/admin-app.md section 3.1: every control here is functional.
// A visible-but-dead control advertises a capability that doesn't exist, which
// is why there's no fullscreen or notification button — neither has a
// requirement behind it. The one honest exception is the user menu's items:
// the menu genuinely opens, closes and handles focus, but Profile/Settings/
// Sign out render as unavailable because Authentication is SRS v0.3.

(function () {
  const Shell = window.AdminShell;
  const mount = document.getElementById("admin-header");

  const FOCUS_RING =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:focus-visible:ring-indigo-500";
  const ICON_BTN = `rounded-md p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 ${FOCUS_RING}`;

  function icon(paths, extra) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="h-5 w-5 ${extra || ""}">${paths}</svg>`;
  }

  const menuIcon = icon(
    `<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>`,
  );
  const searchIcon = icon(
    `<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>`,
    "h-4 w-4",
  );
  const moonIcon = icon(`<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`);
  const sunIcon = icon(
    `<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>`,
  );
  const chevronIcon = icon(`<polyline points="6 9 12 15 18 9"/>`, "h-4 w-4");

  // Menu items have no destination yet — Authentication is v0.3.
  const USER_MENU = [
    { label: "Profile", version: "v0.3" },
    { label: "Settings", version: "v0.3" },
    { label: "Sign out", version: "v0.3" },
  ];

  const params = new URLSearchParams(window.location.search);
  const currentQuery = params.get("q") || "";

  function themeButtonMarkup() {
    const dark = Shell.getTheme() === "dark";
    // Icon shows the theme that is active; the name says what clicking does.
    return `
      <button
        type="button"
        id="theme-toggle"
        class="${ICON_BTN}"
        aria-pressed="${dark}"
        aria-label="${dark ? "Switch to light theme" : "Switch to dark theme"}"
        title="${dark ? "Switch to light theme" : "Switch to dark theme"}"
      >${dark ? moonIcon : sunIcon}</button>
    `;
  }

  function render() {
    mount.innerHTML = `
      <header class="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 border-b border-neutral-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
        <button
          type="button"
          id="sidebar-toggle"
          class="${ICON_BTN}"
          aria-controls="admin-sidebar"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >${menuIcon}</button>

        <form action="index.html" method="get" class="relative w-full max-w-xs sm:max-w-sm" role="search">
          <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-slate-500">${searchIcon}</span>
          <label for="global-search" class="sr-only">Search products by name or SKU</label>
          <input
            id="global-search"
            name="q"
            type="search"
            value="${currentQuery.replace(/"/g, "&quot;")}"
            placeholder="Search products by name or SKU"
            class="w-full rounded-lg border border-neutral-200 bg-neutral-50 py-2 pl-9 pr-3 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/40"
          />
        </form>

        <div class="ml-auto flex items-center gap-1">
          ${themeButtonMarkup()}
        </div>

        <div class="relative ml-1 border-l border-neutral-200 pl-3 dark:border-slate-800">
          <button
            type="button"
            id="user-menu-trigger"
            class="flex items-center gap-2 rounded-md p-1 hover:bg-neutral-100 dark:hover:bg-slate-800 ${FOCUS_RING}"
            aria-haspopup="menu"
            aria-expanded="false"
            aria-controls="user-menu"
          >
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white dark:bg-indigo-500">A</span>
            <span class="hidden text-left sm:block">
              <span class="block text-sm font-medium leading-tight text-neutral-900 dark:text-slate-100">Admin User</span>
              <span class="block text-xs leading-tight text-neutral-400 dark:text-slate-500">Administrator</span>
            </span>
            <span class="text-neutral-400 dark:text-slate-500">${chevronIcon}</span>
          </button>

          <div
            id="user-menu"
            role="menu"
            aria-labelledby="user-menu-trigger"
            class="absolute right-0 top-full z-50 mt-2 hidden w-60 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
          >
            <p class="px-3 py-2 text-xs text-neutral-500 dark:text-slate-400">
              Signed-in account and these actions arrive with Authentication (SRS v0.3).
            </p>
            ${USER_MENU.map(
              (item) => `
              <span
                role="menuitem"
                tabindex="-1"
                aria-disabled="true"
                class="flex cursor-not-allowed items-center justify-between rounded-md px-3 py-2 text-sm text-neutral-400 dark:text-slate-600"
              >
                ${item.label}
                <span class="text-[10px] uppercase tracking-wide">${item.version}</span>
              </span>`,
            ).join("")}
          </div>
        </div>
      </header>
    `;

    wire();
  }

  function wire() {
    const sidebarToggle = mount.querySelector("#sidebar-toggle");
    const themeToggle = mount.querySelector("#theme-toggle");
    const trigger = mount.querySelector("#user-menu-trigger");
    const menu = mount.querySelector("#user-menu");
    const items = Array.from(menu.querySelectorAll('[role="menuitem"]'));

    sidebarToggle.addEventListener("click", () => Shell.toggleSidebar());

    themeToggle.addEventListener("click", () => Shell.toggleTheme());

    // --- User menu: click/Enter to open, arrows to move, Esc to close and
    // return focus to the trigger (docs/ui/admin-app.md section 4).
    let open = false;

    function setOpen(next, focusIndex) {
      open = next;
      menu.classList.toggle("hidden", !open);
      trigger.setAttribute("aria-expanded", String(open));
      if (open && items.length) {
        items[focusIndex ?? 0].focus();
      }
    }

    function close(returnFocus) {
      if (!open) return;
      setOpen(false);
      if (returnFocus) trigger.focus();
    }

    trigger.addEventListener("click", () => (open ? close(false) : setOpen(true)));

    trigger.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true, 0);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setOpen(true, items.length - 1);
      }
    });

    menu.addEventListener("keydown", (e) => {
      const index = items.indexOf(document.activeElement);
      if (e.key === "Escape") {
        e.preventDefault();
        close(true);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        items[(index + 1) % items.length].focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        items[(index - 1 + items.length) % items.length].focus();
      } else if (e.key === "Tab") {
        // Focus must not escape the menu while it's open.
        e.preventDefault();
        close(true);
      }
    });

    document.addEventListener("click", (e) => {
      if (open && !menu.contains(e.target) && !trigger.contains(e.target)) close(false);
    });

    // Keep the toggle's expanded state honest as the sidebar changes.
    function syncSidebarToggle() {
      const expanded = Shell.isDesktop() ? !Shell.isCollapsed() : Shell.isDrawerOpen();
      sidebarToggle.setAttribute("aria-expanded", String(expanded));
      sidebarToggle.setAttribute(
        "aria-label",
        expanded ? "Collapse navigation" : "Expand navigation",
      );
    }
    Shell.onSidebarChange(syncSidebarToggle);
    syncSidebarToggle();
  }

  // The theme button's icon and label depend on the active theme, so redraw the
  // header when it flips.
  Shell.onThemeChange(render);

  render();

  // Esc closes the mobile drawer too (docs/ui/admin-app.md section 3.5).
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && Shell.isDrawerOpen()) {
      Shell.setDrawerOpen(false);
      const toggle = mount.querySelector("#sidebar-toggle");
      if (toggle) toggle.focus();
    }
  });
})();
