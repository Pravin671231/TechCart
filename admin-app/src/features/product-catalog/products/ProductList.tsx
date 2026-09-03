import { useMemo } from "react";
import { Link } from "react-router";
import { DataTable, type DataTableColumn, type SortState } from "@/components/data-table";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useListQueryState } from "@/hooks/useListQueryState";
import { useGetBrandsQuery } from "@/features/product-catalog/brands/brandsApi";
import { useGetCategoriesQuery } from "@/features/product-catalog/categories/categoriesApi";
import { PRODUCT_CATALOG_ROUTES } from "@/features/product-catalog/routePaths";
import { useGetProductsQuery } from "./productsApi";
import { STATUS_LABEL, STATUS_TONE } from "./statusPresentation";
import type { Product, ProductSort, ProductStatus } from "./types";

interface ProductFilters {
  search: string;
  status: ProductStatus | "";
  sort?: ProductSort;
}

const STATUS_OPTIONS = [
  { label: "Draft", value: "draft" },
  { label: "Published", value: "published" },
  { label: "Archived", value: "archived" },
];

// ProductSort is one combined string ("name" | "-name" | …); DataTable speaks
// { columnId, direction }. Adapt at this boundary — productsApi.ts keeps
// splitting the combined string into ?sortBy=/?orderBy= as before.
function toSortState(sort: ProductSort | undefined): SortState | null {
  if (!sort) return null;
  return sort.startsWith("-")
    ? { columnId: sort.slice(1), direction: "desc" }
    : { columnId: sort, direction: "asc" };
}

function fromSortState(next: SortState | null): ProductSort | undefined {
  if (!next) return undefined;
  const base = next.columnId as "name" | "createdAt";
  return (next.direction === "desc" ? `-${base}` : base) as ProductSort;
}

export const ProductList = () => {
  const { filters, setFilter, page, setPage, limit, setLimit } = useListQueryState<ProductFilters>({
    search: "",
    status: "",
    sort: undefined,
  });

  const { data, isLoading, isFetching, isError, refetch } = useGetProductsQuery({
    page,
    limit,
    sort: filters.sort,
    search: filters.search || undefined,
    status: filters.status || undefined,
  });
  const { data: brandsData } = useGetBrandsQuery({ limit: 100 });
  const { data: categoriesData } = useGetCategoriesQuery({ limit: 100 });

  const brandNameById = useMemo(
    () => new Map((brandsData?.items ?? []).map((brand) => [brand._id, brand.name])),
    [brandsData],
  );
  const categoryNameById = useMemo(
    () => new Map((categoriesData?.items ?? []).map((category) => [category._id, category.name])),
    [categoriesData],
  );

  const columns = useMemo<DataTableColumn<Product>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        sortable: true,
        cell: (product) => (
          <Link
            to={PRODUCT_CATALOG_ROUTES.products.detail(product._id)}
            className="font-medium text-primary-600 hover:underline"
          >
            {product.name}
          </Link>
        ),
      },
      {
        id: "brand",
        header: "Brand",
        cell: (product) => brandNameById.get(product.brand) ?? "—",
      },
      {
        id: "category",
        header: "Category",
        cell: (product) => categoryNameById.get(product.category) ?? "—",
      },
      {
        id: "variants",
        header: "Variants",
        align: "right",
        cell: (product) => product.variants.length,
      },
      {
        id: "status",
        header: "Status",
        cell: (product) => (
          <StatusBadge tone={STATUS_TONE[product.status]}>
            {STATUS_LABEL[product.status]}
          </StatusBadge>
        ),
      },
    ],
    [brandNameById, categoryNameById],
  );

  const products = data?.items ?? [];
  const total = data?.pagination.total ?? 0;

  return (
    <DataTable<Product>
      className="mt-4 min-h-0 flex-1"
      columns={columns}
      rows={products}
      getRowId={(product) => product._id}
      isLoading={isLoading}
      isFetching={isFetching}
      isError={isError}
      onRetry={refetch}
      emptyMessage="No products found."
      caption="Product list"
      minWidth="52rem"
      search={{
        label: "Search products",
        placeholder: "Search name or SKU…",
        onSearch: (value) => setFilter("search", value),
      }}
      filters={{
        fields: [
          {
            type: "select",
            key: "status",
            label: "Status",
            placeholder: "Status: All",
            options: STATUS_OPTIONS,
          },
        ],
        values: { status: filters.status },
        onChange: (_key, value) => setFilter("status", value as ProductStatus | ""),
      }}
      sort={toSortState(filters.sort)}
      onSortChange={(next) => setFilter("sort", fromSortState(next))}
      pagination={{ page, pageSize: limit, total }}
      onPaginationChange={({ page: nextPage, pageSize }) => {
        if (pageSize !== limit) setLimit(pageSize);
        else setPage(nextPage);
      }}
    />
  );
};
