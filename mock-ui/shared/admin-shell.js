// Shell state for every admin/*.html page: theme (light/dark) and sidebar
// collapse. Both persist to localStorage per docs/ui/admin/admin-main-ui.md section 5.4.
//
// The theme class itself is applied by a tiny inline script in each page's
// <head> (see any admin/*.html) so it lands before first paint — a flash of the
// wrong theme is a defect, not a nicety (section 2.2). This file owns everything
// after that: reading state, toggling it, and letting the nav/header subscribe.

(function () {
  const THEME_KEY = "techcart-admin-theme";
  const SIDEBAR_KEY = "techcart-admin-sidebar";

  const listeners = { theme: [], sidebar: [] };

  function emit(channel, value) {
    listeners[channel].forEach((fn) => fn(value));
  }

  // --- Theme -------------------------------------------------------------

  // Resolution order (section 2.2): stored choice -> OS preference -> light.
  function resolveTheme() {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function getTheme() {
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  }

  function applyTheme(theme) {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem(THEME_KEY, theme);
    emit("theme", theme);
  }

  function toggleTheme() {
    applyTheme(getTheme() === "dark" ? "light" : "dark");
  }

  // --- Sidebar -----------------------------------------------------------
  //
  // Two independent things share one button (section 3.1):
  //   lg and up  -> collapsed rail vs expanded, persisted
  //   below lg   -> off-canvas drawer, never persisted (always shut on load)

  function isDesktop() {
    return window.matchMedia("(min-width: 1024px)").matches;
  }

  let drawerOpen = false;

  function isCollapsed() {
    return localStorage.getItem(SIDEBAR_KEY) === "collapsed";
  }

  function setCollapsed(collapsed) {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? "collapsed" : "expanded");
    emit("sidebar", { collapsed, drawerOpen });
  }

  function setDrawerOpen(open) {
    drawerOpen = open;
    emit("sidebar", { collapsed: isCollapsed(), drawerOpen });
  }

  function toggleSidebar() {
    if (isDesktop()) {
      setCollapsed(!isCollapsed());
    } else {
      setDrawerOpen(!drawerOpen);
    }
  }

  // --- Layout ------------------------------------------------------------
  //
  // The sidebar is fixed, so it occupies no layout space and <main> has to
  // carry its own left offset (docs/ui/admin/admin-main-ui.md section 5.5). Driving that
  // offset from the same state as the sidebar itself is what stops the two
  // drifting out of sync.

  function syncLayout() {
    const main = document.querySelector("[data-admin-main]");
    if (!main) return;
    const collapsed = isCollapsed();
    main.classList.toggle("lg:ml-64", !collapsed);
    main.classList.toggle("lg:ml-16", collapsed);
  }

  listeners.sidebar.push(syncLayout);
  document.addEventListener("DOMContentLoaded", syncLayout);

  // Crossing the lg boundary must not leave a drawer "open" behind a sidebar
  // that is now persistent.
  window.matchMedia("(min-width: 1024px)").addEventListener("change", () => {
    drawerOpen = false;
    emit("sidebar", { collapsed: isCollapsed(), drawerOpen });
  });

  window.AdminShell = {
    resolveTheme,
    getTheme,
    applyTheme,
    toggleTheme,
    isDesktop,
    isCollapsed,
    setCollapsed,
    isDrawerOpen: () => drawerOpen,
    setDrawerOpen,
    toggleSidebar,
    syncLayout,
    onThemeChange: (fn) => listeners.theme.push(fn),
    onSidebarChange: (fn) => listeners.sidebar.push(fn),
  };
})();
