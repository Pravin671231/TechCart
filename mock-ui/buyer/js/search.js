// Search results page (buyer/search.html?q=...) — FR-CAT-004, 006, 010.
// Matching (exact partial + fuzzy/typo-tolerant fallback, Decision #17c) lives in
// MockHelpers.filterAndSortProducts — this page just wires the query string to it.

(function () {
  const H = window.MockHelpers;
  const G = window.ProductGrid;

  const params = new URLSearchParams(window.location.search);
  const query = params.get("q") || "";

  document.getElementById("query-label").textContent = query ? `Showing results for "${query}"` : "Enter a keyword to search.";

  const state = { sort: "relevance", page: 1, pageSize: 6 };

  const gridEl = document.getElementById("grid-container");
  const paginationEl = document.getElementById("pagination-container");
  const resultCountEl = document.getElementById("result-count");

  function fetchAndRender() {
    G.renderGrid(gridEl, { loading: true });
    window.setTimeout(() => {
      const allResults = query ? H.filterAndSortProducts({ query, sort: state.sort }) : [];
      const start = (state.page - 1) * state.pageSize;
      const pageResults = allResults.slice(start, start + state.pageSize);

      resultCountEl.textContent = query ? `${allResults.length} result${allResults.length === 1 ? "" : "s"}` : "";
      G.renderGrid(gridEl, {
        loading: false,
        products: pageResults,
        // Distinct from the catalog page's filter-empty message, per FR-CAT-010.
        emptyMessage: query ? `No results for "${query}".` : "Type a keyword above to search the catalog.",
      });
      G.renderPagination(paginationEl, {
        page: state.page,
        pageSize: state.pageSize,
        total: allResults.length,
        onPageChange: (page) => {
          state.page = page;
          fetchAndRender();
          window.scrollTo({ top: 0, behavior: "smooth" });
        },
      });
    }, 250);
  }

  document.getElementById("sort-select").addEventListener("change", (e) => {
    state.sort = e.target.value;
    state.page = 1;
    fetchAndRender();
  });

  fetchAndRender();
})();
