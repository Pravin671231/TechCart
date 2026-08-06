import { useState } from "react";
import { Link } from "react-router";
import { useGetBrandsQuery } from "@/features/brands/brandsApi";
import { useGetCategoriesQuery } from "@/features/categories/categoriesApi";
import { formatPrice } from "./money";
import {
  useGetProductsQuery,
  useUpdateProductStatusMutation,
  useUpdateProductStockMutation,
} from "./productsApi";
import type { Product, ProductStatus } from "./types";

export interface ProductListProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: ProductStatus | "";
  onStatusChange: (value: ProductStatus | "") => void;
  lowStockOnly: boolean;
  onLowStockOnlyChange: (value: boolean) => void;
  page: number;
  onPageChange: (page: number) => void;
}

const STATUS_LABEL: Record<ProductStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

const STATUS_BADGE_CLASS: Record<ProductStatus, string> = {
  published: "bg-green-100 text-green-700",
  draft: "bg-neutral-100 text-neutral-600",
  archived: "bg-neutral-100 text-neutral-500",
};

export function ProductList({
  search,
  onSearchChange,
  status,
  onStatusChange,
  lowStockOnly,
  onLowStockOnlyChange,
  page,
  onPageChange,
}: ProductListProps) {
  const { data, isLoading } = useGetProductsQuery({
    page,
    search: search || undefined,
    status: status || undefined,
    lowStock: lowStockOnly,
  });
  const { data: brands = [] } = useGetBrandsQuery(undefined);
  const { data: categories = [] } = useGetCategoriesQuery(undefined);
  const [updateStatus] = useUpdateProductStatusMutation();
  const [updateStock] = useUpdateProductStockMutation();
  const [stockDraft, setStockDraft] = useState<{ id: string; value: string } | null>(null);

  const brandNameById = new Map(brands.map((b) => [b._id, b.name]));
  const categoryNameById = new Map(categories.map((c) => [c._id, c.name]));

  const products = data?.items ?? [];
  const pagination = data?.pagination;

  async function handleArchive(product: Product) {
    await updateStatus({ id: product._id, status: "archived" }).unwrap();
  }

  async function handleRestore(product: Product) {
    await updateStatus({ id: product._id, status: "draft" }).unwrap();
  }

  async function handleSaveStock(product: Product) {
    if (!stockDraft || stockDraft.id !== product._id) return;
    const stock = Number(stockDraft.value);
    if (!Number.isFinite(stock) || stock < 0) return;
    await updateStock({ id: product._id, stock }).unwrap();
    setStockDraft(null);
  }

  return (
    <section className="min-w-0 flex-1">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label htmlFor="product-search" className="sr-only">
          Search products
        </label>
        <input
          id="product-search"
          type="text"
          placeholder="Search name or SKU…"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="h-9 w-72 rounded-md border border-neutral-300 px-3 text-sm focus:border-primary-600 focus:ring-1 focus:ring-primary-600 focus:outline-none"
        />
        <label htmlFor="product-status" className="sr-only">
          Status
        </label>
        <select
          id="product-status"
          value={status}
          onChange={(event) => onStatusChange(event.target.value as ProductStatus | "")}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-600"
        >
          <option value="">Status: All</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-neutral-600">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(event) => onLowStockOnlyChange(event.target.checked)}
            className="h-4 w-4 rounded border-neutral-300"
          />
          Low stock only
        </label>
      </div>

      {isLoading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead className="bg-neutral-50 text-left">
              <tr className="border-b border-neutral-200">
                <th className="px-3 py-2 font-medium text-neutral-500">Name</th>
                <th className="px-3 py-2 font-medium text-neutral-500">SKU</th>
                <th className="px-3 py-2 font-medium text-neutral-500">Brand</th>
                <th className="px-3 py-2 font-medium text-neutral-500">Category</th>
                <th className="px-3 py-2 text-right font-medium text-neutral-500">Price</th>
                <th className="px-3 py-2 text-right font-medium text-neutral-500">Stock</th>
                <th className="px-3 py-2 font-medium text-neutral-500">Status</th>
                <th className="px-3 py-2 font-medium text-neutral-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {products.map((product) => {
                const isLowStock = product.stock <= product.lowStockThreshold;
                const isEditingStock = stockDraft?.id === product._id;
                return (
                  <tr key={product._id}>
                    <td className="px-3 py-2 font-medium text-neutral-900">{product.name}</td>
                    <td className="px-3 py-2 font-mono text-xs text-neutral-500">{product.sku}</td>
                    <td className="px-3 py-2">{brandNameById.get(product.brand) ?? "—"}</td>
                    <td className="px-3 py-2">{categoryNameById.get(product.category) ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatPrice(product.sellingPrice)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {isEditingStock ? (
                        <span className="inline-flex items-center gap-1">
                          <input
                            type="text"
                            aria-label={`Stock for ${product.name}`}
                            value={stockDraft.value}
                            onChange={(event) =>
                              setStockDraft({ id: product._id, value: event.target.value })
                            }
                            className="w-14 rounded-md border border-primary-300 px-1.5 py-0.5 text-right text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => void handleSaveStock(product)}
                            className="rounded-md bg-primary-600 px-1.5 py-0.5 text-[10px] font-medium text-white"
                          >
                            Save
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setStockDraft({ id: product._id, value: String(product.stock) })}
                          className="tabular-nums hover:underline"
                        >
                          {product.stock}
                          {isLowStock && (
                            <span className="ml-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                              Low
                            </span>
                          )}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[product.status]}`}
                      >
                        {STATUS_LABEL[product.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap text-neutral-500">
                      <Link to={`/products/${product._id}`} className="text-primary-600 hover:underline">
                        View
                      </Link>
                      {" · "}
                      <Link to={`/products/${product._id}/edit`} className="text-primary-600 hover:underline">
                        Edit
                      </Link>
                      {product.status === "archived" ? (
                        <>
                          {" · "}
                          <button
                            type="button"
                            onClick={() => void handleRestore(product)}
                            className="text-primary-600 hover:underline"
                          >
                            Restore
                          </button>
                        </>
                      ) : (
                        <>
                          {" · "}
                          <button
                            type="button"
                            onClick={() => void handleArchive(product)}
                            className="text-primary-600 hover:underline"
                          >
                            Archive
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {products.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-center text-neutral-500">
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <p className="text-neutral-500">
            Showing {(pagination.page - 1) * pagination.limit + 1}–
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </p>
          <nav className="flex gap-2">
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="rounded-md border border-neutral-200 px-3 py-1 text-neutral-500 disabled:cursor-not-allowed disabled:text-neutral-300"
            >
              ‹ Prev
            </button>
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={!pagination.hasNextPage}
              className="rounded-md border border-neutral-300 px-3 py-1 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:text-neutral-300"
            >
              Next ›
            </button>
          </nav>
        </div>
      )}
    </section>
  );
}
