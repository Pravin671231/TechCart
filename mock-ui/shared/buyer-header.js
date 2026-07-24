// Injects a consistent header/nav into <div id="site-header"></div> on every buyer/*.html page.
// Search is a plain GET form to search.html — no JS required for it to work.

(function () {
  // Only status:true categories appear in buyer-facing nav (FR-CAT-026, Decision #13).
  const categories = window.MockHelpers.getBuyerVisibleTopLevelCategories();

  const navLinks = categories
    .map(
      (c) =>
        `<a href="category.html?slug=${encodeURIComponent(c.slug)}" class="text-sm text-neutral-600 hover:text-neutral-900">${c.name}</a>`,
    )
    .join("");

  const params = new URLSearchParams(window.location.search);
  const currentQuery = params.get("q") || "";

  const html = `
    <header class="border-b border-neutral-200 bg-white">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
        <a href="index.html" class="text-xl font-semibold tracking-tight text-neutral-900">TechCart</a>
        <nav class="flex flex-wrap items-center gap-4">${navLinks}</nav>
        <form action="search.html" method="get" class="ml-auto flex w-full max-w-xs items-center gap-2 sm:w-auto">
          <input
            type="search"
            name="q"
            value="${currentQuery.replace(/"/g, "&quot;")}"
            placeholder="Search products..."
            class="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-neutral-500 focus:outline-none"
          />
          <button type="submit" class="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-700">
            Search
          </button>
        </form>
      </div>
    </header>
  `;

  document.getElementById("site-header").innerHTML = html;
})();
