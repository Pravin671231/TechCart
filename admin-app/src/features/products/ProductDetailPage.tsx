import { Link, useParams } from "react-router";
import { useGetBrandsQuery } from "@/features/brands/brandsApi";
import { useGetCategoriesQuery } from "@/features/categories/categoriesApi";
import { LinkButton } from "@/components/ui/Button";
import { Card, CardHeading } from "@/components/ui/Card";
import { ErrorState, LoadingState } from "@/components/ui/LoadingState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableHeadRow } from "@/components/ui/Table";
import { formatPrice } from "./money";
import { STATUS_LABEL, STATUS_TONE } from "./statusPresentation";
import { useGetProductQuery, useUpdateProductStatusMutation } from "./productsApi";
import type { ProductStatus } from "./types";

function formatAttributes(attributes: { name: string; value: string }[]): string {
  return attributes.map((attribute) => `${attribute.name}=${attribute.value}`).join(" · ");
}

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: product, isLoading, isError } = useGetProductQuery(id ?? "", { skip: !id });
  const { data: brands = [] } = useGetBrandsQuery(undefined);
  const { data: categories = [] } = useGetCategoriesQuery(undefined);
  const [updateStatus, { isLoading: isChangingStatus }] = useUpdateProductStatusMutation();

  if (isLoading) return <LoadingState fullPage />;
  if (isError || !product) {
    return <ErrorState fullPage message="Unable to load this product." />;
  }

  const brandName = brands.find((b) => b._id === product.brand)?.name ?? "—";
  const category = categories.find((c) => c._id === product.category);
  const parentCategory = category?.parentCategory
    ? categories.find((c) => c._id === category.parentCategory)
    : undefined;
  const categoryLabel = category
    ? parentCategory
      ? `${parentCategory.name} › ${category.name}`
      : category.name
    : "—";

  const primaryImage = product.images.find((image) => image.isPrimary) ?? product.images[0];

  async function handleStatusChange(status: ProductStatus) {
    await updateStatus({ id: product!._id, status }).unwrap();
  }

  return (
    <main className="p-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
          <Link to="/products" className="text-neutral-400 hover:text-primary-600">
            Products
          </Link>
          <span className="mx-1 text-neutral-300">/</span>
          {product.name}
        </h1>
        <div className="flex items-center gap-2 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-neutral-500">Change status</span>
            <select
              value={product.status}
              disabled={isChangingStatus}
              onChange={(event) => void handleStatusChange(event.target.value as ProductStatus)}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 font-medium text-neutral-600"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <LinkButton to={`/products/${product._id}/edit`} size="sm">
            Edit
          </LinkButton>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusBadge tone={STATUS_TONE[product.status]}>{STATUS_LABEL[product.status]}</StatusBadge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeading>Images</CardHeading>
          {product.images.length === 0 ? (
            <p className="text-sm text-neutral-400">No images.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {product.images.map((image, index) => (
                <div
                  key={image.url + index}
                  className={`flex aspect-square items-center justify-center rounded-md bg-neutral-50 text-[10px] text-neutral-500 ${
                    image === primaryImage
                      ? "border-2 border-primary-600"
                      : "border border-neutral-200"
                  }`}
                >
                  {image === primaryImage ? "Primary" : ""}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeading>Details</CardHeading>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="w-36 shrink-0 text-neutral-500">Name</dt>
              <dd className="text-neutral-900">{product.name}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-36 shrink-0 text-neutral-500">Slug</dt>
              <dd className="font-mono text-xs text-neutral-800">{product.slug}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-36 shrink-0 text-neutral-500">SKU</dt>
              <dd className="font-mono text-xs text-neutral-800">{product.sku}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-36 shrink-0 text-neutral-500">Brand</dt>
              <dd className="text-neutral-900">{brandName}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-36 shrink-0 text-neutral-500">Category</dt>
              <dd className="text-neutral-900">{categoryLabel}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-36 shrink-0 text-neutral-500">Featured</dt>
              <dd className="text-neutral-900">{product.isFeatured ? "Yes" : "No"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-36 shrink-0 text-neutral-500">MRP</dt>
              <dd className="text-neutral-900">{formatPrice(product.mrp)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-36 shrink-0 text-neutral-500">Discount</dt>
              <dd className="text-neutral-900">{product.discount}%</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-36 shrink-0 text-neutral-500">Selling price</dt>
              <dd className="font-medium text-neutral-900">
                {formatPrice(product.sellingPrice)}{" "}
                <span className="text-[11px] font-normal text-neutral-400">server-computed</span>
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-36 shrink-0 text-neutral-500">Stock</dt>
              <dd className="text-neutral-900">{product.stock}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-36 shrink-0 text-neutral-500">Low-stock threshold</dt>
              <dd className="text-neutral-900">{product.lowStockThreshold}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-36 shrink-0 text-neutral-500">Meta title</dt>
              <dd className={product.metaTitle ? "text-neutral-900" : "text-neutral-400"}>
                {product.metaTitle ?? "— falls back to name"}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-36 shrink-0 text-neutral-500">Created by</dt>
              <dd className="font-mono text-xs text-neutral-400">{product.createdBy ?? "null"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-36 shrink-0 text-neutral-500">Updated by</dt>
              <dd className="font-mono text-xs text-neutral-400">{product.updatedBy ?? "null"}</dd>
            </div>
          </dl>
        </Card>
      </div>

      {product.specifications.length > 0 && (
        <Card className="mt-6">
          <CardHeading>Specifications</CardHeading>
          <div className="grid gap-4 sm:grid-cols-3">
            {product.specifications.map((group) => (
              <div key={group.groupName}>
                <p className="mb-1 text-sm font-medium text-neutral-900">{group.groupName}</p>
                <dl className="text-sm text-neutral-600">
                  {group.values.map((value) => (
                    <div
                      key={value.name}
                      className="flex justify-between border-b border-neutral-100 py-1"
                    >
                      <dt>{value.name}</dt>
                      <dd className="text-neutral-800">{String(value.value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </Card>
      )}

      {product.variants.length > 0 && (
        <Card className="mt-6">
          <CardHeading>Variants</CardHeading>
          <Table minWidthClassName="min-w-[700px]">
            <TableHeadRow variant="shaded">
              <th className="px-3 py-2 font-medium text-neutral-500">SKU</th>
              <th className="px-3 py-2 font-medium text-neutral-500">Attributes</th>
              <th className="px-3 py-2 text-right font-medium text-neutral-500">MRP</th>
              <th className="px-3 py-2 text-right font-medium text-neutral-500">Disc.</th>
              <th className="px-3 py-2 text-right font-medium text-neutral-500">Selling</th>
              <th className="px-3 py-2 text-right font-medium text-neutral-500">Stock</th>
              <th className="px-3 py-2 font-medium text-neutral-500">Active</th>
            </TableHeadRow>
            <tbody className="divide-y divide-neutral-100">
              {product.variants.map((variant) => (
                <tr key={variant._id} className={variant.active ? undefined : "text-neutral-400"}>
                  <td className="px-3 py-2 font-mono text-xs text-neutral-500">{variant.sku}</td>
                  <td className="px-3 py-2">{formatAttributes(variant.attributes)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatPrice(variant.mrp)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{variant.discount}%</td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums text-neutral-900">
                    {formatPrice(variant.sellingPrice)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{variant.stock}</td>
                  <td className="px-3 py-2">
                    <StatusBadge tone={variant.active ? "success" : "neutral"}>
                      {variant.active ? "Yes" : "No"}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="mt-2 text-[11px] text-neutral-400">
            Deactivated variants stay embedded on the document — never hard-removed.
          </p>
        </Card>
      )}
    </main>
  );
}
