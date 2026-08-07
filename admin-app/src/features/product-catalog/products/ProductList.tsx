import { useState } from "react";
import { Link } from "react-router";
import { useGetBrandsQuery } from "@/features/product-catalog/brands/brandsApi";
import { useGetCategoriesQuery } from "@/features/product-catalog/categories/categoriesApi";
import { PRODUCT_CATALOG_ROUTES } from "@/features/product-catalog/routePaths";
import { Checkbox } from "@/components/form/Checkbox";
import { LoadingState } from "@/components/ui/LoadingState";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/form/SearchInput";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyRow, Table, TableHeadRow } from "@/components/ui/Table";
import { formatPrice } from "./money";
import {
  useGetProductsQuery,
  useUpdateProductStatusMutation,
  useUpdateProductStockMutation,
} from "./productsApi";
import { STATUS_LABEL, STATUS_TONE } from "./statusPresentation";
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
        <SearchInput
          id="product-search"
          label="Search products"
          placeholder="Search name or SKU…"
          value={search}
          onChange={onSearchChange}
          width="w-72"
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
        <Checkbox
          label="Low stock only"
          checked={lowStockOnly}
          onChange={(event) => onLowStockOnlyChange(event.target.checked)}
        />
      </div>

      {isLoading ? (
        <LoadingState label="Loading…" spaced={false} />
      ) : (
        <Table minWidthClassName="min-w-[900px]">
          <TableHeadRow variant="shaded">
            <th className="px-3 py-2 font-medium text-neutral-500">Name</th>
            <th className="px-3 py-2 font-medium text-neutral-500">SKU</th>
            <th className="px-3 py-2 font-medium text-neutral-500">Brand</th>
            <th className="px-3 py-2 font-medium text-neutral-500">Category</th>
            <th className="px-3 py-2 text-right font-medium text-neutral-500">Price</th>
            <th className="px-3 py-2 text-right font-medium text-neutral-500">Stock</th>
            <th className="px-3 py-2 font-medium text-neutral-500">Status</th>
            <th className="px-3 py-2 font-medium text-neutral-500">Actions</th>
          </TableHeadRow>
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
                        onClick={() =>
                          setStockDraft({ id: product._id, value: String(product.stock) })
                        }
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
                    <StatusBadge tone={STATUS_TONE[product.status]}>
                      {STATUS_LABEL[product.status]}
                    </StatusBadge>
                  </td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap text-neutral-500">
                    <Link
                      to={PRODUCT_CATALOG_ROUTES.products.detail(product._id)}
                      className="text-primary-600 hover:underline"
                    >
                      View
                    </Link>
                    {" · "}
                    <Link
                      to={PRODUCT_CATALOG_ROUTES.products.edit(product._id)}
                      className="text-primary-600 hover:underline"
                    >
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
            {products.length === 0 && <EmptyRow colSpan={8} message="No products found." />}
          </tbody>
        </Table>
      )}

      {pagination && <Pagination page={page} pagination={pagination} onPageChange={onPageChange} />}
    </section>
  );
}
