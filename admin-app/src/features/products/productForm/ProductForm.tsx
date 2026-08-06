import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { getApiErrorEnvelope } from "@/store/api";
import { useGetBrandsQuery } from "@/features/brands/brandsApi";
import { useGetCategoriesQuery } from "@/features/categories/categoriesApi";
import { formatPrice } from "../money";
import { useCreateProductMutation, useUpdateProductMutation } from "../productsApi";
import type { CreateProductInput, Product, ProductSpecificationGroup, UpdateProductInput } from "../types";
import { ProductImagesEditor, type UploadedImage } from "./ProductImagesEditor";
import { ProductSpecificationsFields } from "./ProductSpecificationsFields";
import { ProductVariantsEditor } from "./ProductVariantsEditor";
import type { SpecificationValues } from "./specificationValues";

function parseSpecKey(key: string): { groupName: string; fieldName: string } {
  const separatorIndex = key.indexOf("::");
  return { groupName: key.slice(0, separatorIndex), fieldName: key.slice(separatorIndex + 2) };
}

function buildSpecificationGroups(values: SpecificationValues): ProductSpecificationGroup[] {
  const groups = new Map<string, ProductSpecificationGroup>();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === "") continue;
    const { groupName, fieldName } = parseSpecKey(key);
    const group = groups.get(groupName) ?? { groupName, values: [] };
    group.values.push({ name: fieldName, value });
    groups.set(groupName, group);
  }
  return [...groups.values()];
}

function initialSpecValues(product: Product | null): SpecificationValues {
  if (!product) return {};
  const values: SpecificationValues = {};
  for (const group of product.specifications) {
    for (const entry of group.values) {
      values[`${group.groupName}::${entry.name}`] = entry.value;
    }
  }
  return values;
}

function computeSellingPreview(mrp: number, discount: number): number | null {
  if (!Number.isFinite(mrp) || mrp <= 0) return null;
  const clamped = Math.min(Math.max(Number.isFinite(discount) ? discount : 0, 0), 99);
  return mrp - Math.floor((mrp * clamped) / 100);
}

function describeApiError(envelope: ReturnType<typeof getApiErrorEnvelope>): string | null {
  if (!envelope) return null;
  if (envelope.message) return envelope.message;
  if (envelope.errors && typeof envelope.errors === "object") {
    return Object.values(envelope.errors as Record<string, string>).join("; ");
  }
  return "Unable to save this product.";
}

export function ProductForm({ product }: { product: Product | null }) {
  const navigate = useNavigate();
  const { data: brands = [] } = useGetBrandsQuery(undefined);
  const { data: categories = [] } = useGetCategoriesQuery(undefined);

  const [name, setName] = useState(product?.name ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [brand, setBrand] = useState(product?.brand ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [isFeatured, setIsFeatured] = useState(product?.isFeatured ?? false);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [mrp, setMrp] = useState(product ? String(product.mrp) : "");
  const [discount, setDiscount] = useState(product ? String(product.discount) : "0");
  const [stock, setStock] = useState(product ? String(product.stock) : "");
  const [lowStockThreshold, setLowStockThreshold] = useState(
    product ? String(product.lowStockThreshold) : "0",
  );
  const [metaTitle, setMetaTitle] = useState(product?.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(product?.metaDescription ?? "");
  const [specValues, setSpecValues] = useState<SpecificationValues>(() => initialSpecValues(product));

  const [createProduct, { isLoading: isCreating, error: createError }] = useCreateProductMutation();
  const [updateProduct, { isLoading: isUpdating, error: updateError }] = useUpdateProductMutation();

  const isSaving = isCreating || isUpdating;
  const saveErrorMessage = describeApiError(getApiErrorEnvelope(createError ?? updateError));

  const mrpNum = Number(mrp);
  const discountNum = discount === "" ? 0 : Number(discount);
  const sellingPreview = computeSellingPreview(mrpNum, discountNum);

  const categoryOptions = categories.map((c) => {
    const parent = c.parentCategory ? categories.find((p) => p._id === c.parentCategory) : undefined;
    return { id: c._id, label: parent ? `${parent.name} › ${c.name}` : c.name };
  });

  function handleCategoryChange(nextCategoryId: string) {
    setCategory(nextCategoryId);
    // A different category has a different specification schema — carrying
    // stale values across would submit values the new schema never defined.
    setSpecValues({});
  }

  function handleSpecChange(key: string, value: string | number | boolean | undefined) {
    setSpecValues((prev) => {
      const next = { ...prev };
      if (value === undefined) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const specifications = buildSpecificationGroups(specValues);
    const shared = {
      name: name.trim(),
      description: description.trim(),
      brand,
      category,
      specifications,
      mrp: Number(mrp),
      discount: discount === "" ? 0 : Number(discount),
      stock: Number(stock),
      lowStockThreshold: lowStockThreshold === "" ? 0 : Number(lowStockThreshold),
      isFeatured,
      ...(metaTitle.trim() ? { metaTitle: metaTitle.trim() } : {}),
      ...(metaDescription.trim() ? { metaDescription: metaDescription.trim() } : {}),
    };
    const imagesPayload = images.map((image) => ({
      objectKey: image.objectKey,
      alt: image.alt || undefined,
      isPrimary: image.isPrimary,
    }));

    try {
      if (product) {
        const patch: UpdateProductInput = { ...shared, ...(images.length > 0 ? { images: imagesPayload } : {}) };
        await updateProduct({ id: product._id, patch }).unwrap();
        navigate(`/products/${product._id}`);
      } else {
        const input: CreateProductInput = { ...shared, sku: sku.trim(), images: imagesPayload };
        const created = await createProduct(input).unwrap();
        navigate(`/products/${created._id}/edit`);
      }
    } catch {
      // surfaced via saveErrorMessage below
    }
  }

  return (
    <main className="p-6">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
          {product ? "Edit product" : "New product"}
        </h1>
      </div>

      <form onSubmit={(event) => void handleSubmit(event)} className="max-w-4xl space-y-6">
        <section className="rounded-lg border border-neutral-200 p-4">
          <h2 className="mb-4 text-xs font-semibold tracking-wide text-neutral-700 uppercase">Basics</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-neutral-500">Name *</span>
              <input
                type="text"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2"
              />
            </label>
            <div className="text-sm">
              <label htmlFor="product-sku" className="block text-neutral-500">
                SKU *
              </label>
              <input
                id="product-sku"
                type="text"
                required
                disabled={Boolean(product)}
                value={sku}
                onChange={(event) => setSku(event.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-xs disabled:bg-neutral-50 disabled:text-neutral-500"
              />
              {product && (
                <span className="mt-1 block text-[11px] text-neutral-400">
                  SKU is immutable after create.
                </span>
              )}
            </div>
            <label className="block text-sm">
              <span className="text-neutral-500">Brand *</span>
              <select
                required
                value={brand}
                onChange={(event) => setBrand(event.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2"
              >
                <option value="">— select —</option>
                {brands.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="text-sm">
              <label htmlFor="product-category" className="block text-neutral-500">
                Category *
              </label>
              <select
                id="product-category"
                required
                value={category}
                onChange={(event) => handleCategoryChange(event.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2"
              >
                <option value="">— select —</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[11px] text-neutral-400">
                Changing this re-validates the specifications below against the new schema.
              </span>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(event) => setIsFeatured(event.target.checked)}
                className="h-4 w-4 rounded border-neutral-300"
              />
              <span className="text-neutral-500">Featured (isFeatured)</span>
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-neutral-500">Description *</span>
              <textarea
                required
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="mt-1 block h-24 w-full rounded-md border border-neutral-300 px-3 py-2"
              />
            </label>
          </div>
        </section>

        <section className="rounded-lg border border-neutral-200 p-4">
          <h2 className="mb-4 text-xs font-semibold tracking-wide text-neutral-700 uppercase">Images</h2>
          {product && product.images.length > 0 && (
            <div className="mb-3">
              <p className="mb-2 text-[11px] text-neutral-400">
                Current images — upload a full new set below to replace them (the previous set is
                fully replaced, not merged, since a stored image carries no re-editable identifier).
              </p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                {product.images.map((image, index) => (
                  <img
                    key={image.url + index}
                    src={image.url}
                    alt={image.alt ?? product.name}
                    className="aspect-square w-full rounded-md border border-neutral-200 object-cover"
                  />
                ))}
              </div>
            </div>
          )}
          <ProductImagesEditor images={images} onChange={setImages} min={product ? 0 : 1} max={8} purpose="product-image" />
        </section>

        <section className="rounded-lg border border-neutral-200 p-4">
          <h2 className="mb-4 text-xs font-semibold tracking-wide text-neutral-700 uppercase">
            Pricing &amp; stock
          </h2>
          <div className="grid gap-4 sm:grid-cols-4">
            <label className="block text-sm">
              <span className="text-neutral-500">MRP (₹) *</span>
              <input
                type="number"
                required
                min={1}
                value={mrp}
                onChange={(event) => setMrp(event.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 tabular-nums"
              />
            </label>
            <label className="block text-sm">
              <span className="text-neutral-500">Discount %</span>
              <input
                type="number"
                min={0}
                max={99}
                value={discount}
                onChange={(event) => setDiscount(event.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 tabular-nums"
              />
            </label>
            <label className="block text-sm">
              <span className="text-neutral-500">Selling price</span>
              <span className="mt-1 block rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 tabular-nums text-neutral-500">
                {sellingPreview !== null ? formatPrice(sellingPreview) : "—"}
              </span>
            </label>
            <label className="block text-sm">
              <span className="text-neutral-500">Stock *</span>
              <input
                type="number"
                required
                min={0}
                value={stock}
                onChange={(event) => setStock(event.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 tabular-nums"
              />
            </label>
            <label className="block text-sm">
              <span className="text-neutral-500">Low-stock threshold</span>
              <input
                type="number"
                min={0}
                value={lowStockThreshold}
                onChange={(event) => setLowStockThreshold(event.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 tabular-nums"
              />
            </label>
          </div>
          <p className="mt-3 text-[11px] text-neutral-400">
            Selling price is read-only here: it is always recomputed server-side and a submitted
            value is ignored.
          </p>
        </section>

        <section className="rounded-lg border border-neutral-200 p-4">
          <h2 className="mb-1 text-xs font-semibold tracking-wide text-neutral-700 uppercase">
            Specifications
          </h2>
          <p className="mb-4 text-[11px] text-neutral-400">
            Rendered from the selected category&apos;s schema, not a fixed field list.
          </p>
          <ProductSpecificationsFields categoryId={category} values={specValues} onChange={handleSpecChange} />
        </section>

        {product && (
          <section className="rounded-lg border border-neutral-200 p-4">
            <h2 className="mb-1 text-xs font-semibold tracking-wide text-neutral-700 uppercase">
              Variants
            </h2>
            <ProductVariantsEditor productId={product._id} categoryId={category} variants={product.variants} />
          </section>
        )}
        {!product && (
          <section className="rounded-lg border border-dashed border-neutral-300 p-4 text-sm text-neutral-500">
            Save the product first — variants are added on the edit screen.
          </section>
        )}

        <section className="rounded-lg border border-neutral-200 p-4">
          <h2 className="mb-4 text-xs font-semibold tracking-wide text-neutral-700 uppercase">SEO</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-neutral-500">Meta title</span>
              <input
                type="text"
                placeholder="Defaults to the product name"
                value={metaTitle}
                onChange={(event) => setMetaTitle(event.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-neutral-500">Meta description</span>
              <input
                type="text"
                placeholder="Defaults to a truncation of the description"
                value={metaDescription}
                onChange={(event) => setMetaDescription(event.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2"
              />
            </label>
          </div>
        </section>

        {saveErrorMessage && (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {saveErrorMessage}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/products")}
            className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Cancel
          </button>
        </div>
      </form>
    </main>
  );
}
