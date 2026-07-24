// Injects a consistent sidebar into <div id="admin-nav"></div> on every admin/*.html page.
// `data-page` on <body> marks the active link (set per page).

(function () {
  const activePage = document.body.getAttribute("data-page") || "";

  function link(href, label, page) {
    const active = page === activePage;
    const cls = active
      ? "block rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white"
      : "block rounded-md px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900";
    return `<a href="${href}" class="${cls}">${label}</a>`;
  }

  const html = `
    <aside class="flex h-full w-56 shrink-0 flex-col border-r border-neutral-200 bg-white">
      <div class="border-b border-neutral-200 px-4 py-4">
        <a href="index.html" class="text-lg font-semibold tracking-tight text-neutral-900">TechCart Admin</a>
      </div>
      <nav class="flex flex-col gap-1 p-3">
        ${link("index.html", "Products", "products")}
        ${link("categories.html", "Categories", "categories")}
        ${link("brands.html", "Brands", "brands")}
      </nav>
      <div class="mt-auto p-3">
        <a href="product-form.html" class="block rounded-md bg-emerald-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-emerald-500">
          + New product
        </a>
      </div>
    </aside>
  `;

  document.getElementById("admin-nav").innerHTML = html;
})();
