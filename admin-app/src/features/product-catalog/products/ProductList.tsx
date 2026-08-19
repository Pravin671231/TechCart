import { Link } from "react-router";
import { useGetBrandsQuery } from "@/features/product-catalog/brands/brandsApi";
import { useGetCategoriesQuery } from "@/features/product-catalog/categories/categoriesApi";
import { PRODUCT_CATALOG_ROUTES } from "@/features/product-catalog/routePaths";
import { LoadingState } from "@/components/ui/LoadingState";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/form/SearchInput";
import { SortableHeader } from "@/components/ui/SortableHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyRow, Table, TableHeadRow } from "@/components/ui/Table";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useGetProductsQuery, useUpdateProductStatusMutation } from "./productsApi";
import { STATUS_LABEL, STATUS_TONE } from "./statusPresentation";
import type { Product, ProductSort, ProductStatus } from "./types";

export interface ProductListProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: ProductStatus | "";
  onStatusChange: (value: ProductStatus | "") => void;
  sort: ProductSort | undefined;
  onSortChange: (sort: ProductSort | undefined) => void;
  page: number;
  onPageChange: (page: number) => void;
}

export const ProductList = ({
  search,
  onSearchChange,
  status,
  onStatusChange,
  sort,
  onSortChange,
  page,
  onPageChange,
}: ProductListProps) => {
  const debouncedSearch = useDebouncedValue(search, 300);
  const { data, isLoading, isFetching } = useGetProductsQuery({
    page,
    sort,
    search: debouncedSearch || undefined,
    status: status || undefined,
  });
  const { data: brandsData } = useGetBrandsQuery({ limit: 100 });
  const { data: categoriesData } = useGetCategoriesQuery({ limit: 100 });
  const brands = brandsData?.items ?? [];
  const categories = categoriesData?.items ?? [];
  const [updateStatus] = useUpdateProductStatusMutation();

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
      </div>

      {isLoading ? (
        <LoadingState label="Loading…" spaced={false} />
      ) : (
        <Table minWidthClassName="min-w-[700px]" isFetching={isFetching}>
          <TableHeadRow variant="shaded">
            <SortableHeader<ProductSort>
              label="Name"
              sortKeyAsc="name"
              sortKeyDesc="-name"
              currentSort={sort}
              onSortChange={onSortChange}
            />
            <th className="px-3 py-2 font-medium text-neutral-500">Brand</th>
            <th className="px-3 py-2 font-medium text-neutral-500">Category</th>
            <th className="px-3 py-2 text-right font-medium text-neutral-500">Variants</th>
            <th className="px-3 py-2 font-medium text-neutral-500">Status</th>
            <th className="px-3 py-2 font-medium text-neutral-500">Actions</th>
          </TableHeadRow>
          <tbody className="divide-y divide-neutral-100">
            {products.map((product) => (
              <tr key={product._id}>
                <td className="px-3 py-2 font-medium text-neutral-900">
                  <Link
                    to={PRODUCT_CATALOG_ROUTES.products.detail(product._id)}
                    className="hover:underline"
                  >
                    {product.name}
                  </Link>
                </td>
                <td className="px-3 py-2">{brandNameById.get(product.brand) ?? "—"}</td>
                <td className="px-3 py-2">{categoryNameById.get(product.category) ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{product.variants.length}</td>
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
            ))}
            {products.length === 0 && <EmptyRow colSpan={6} message="No products found." />}
          </tbody>
        </Table>
      )}

      {pagination && <Pagination page={page} pagination={pagination} onPageChange={onPageChange} />}
    </section>
  );
};
