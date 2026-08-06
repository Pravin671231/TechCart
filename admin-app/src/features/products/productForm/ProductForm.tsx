import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { getApiErrorEnvelope } from "@/store/api";
import { useGetBrandsQuery } from "@/features/brands/brandsApi";
import { useGetCategoriesQuery } from "@/features/categories/categoriesApi";
import { Button } from "@/components/ui/Button";
import { Card, CardHeading } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { ReadOnlyField, SelectField, TextAreaField, TextField } from "@/components/ui/FormField";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { formatPrice } from "../money";
import { useCreateProductMutation, useUpdateProductMutation } from "../productsApi";
import type {
  CreateProductInput,
  Product,
  ProductSpecificationGroup,
  UpdateProductInput,
} from "../types";
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
  const [specValues, setSpecValues] = useState<SpecificationValues>(() =>
    initialSpecValues(product),
  );

  const [createProduct, { isLoading: isCreating, error: createError }] = useCreateProductMutation();
  const [updateProduct, { isLoading: isUpdating, error: updateError }] = useUpdateProductMutation();

  const isSaving = isCreating || isUpdating;
  const saveErrorMessage = describeApiError(getApiErrorEnvelope(createError ?? updateError));

  const mrpNum = Number(mrp);
  const discountNum = discount === "" ? 0 : Number(discount);
  const sellingPreview = computeSellingPreview(mrpNum, discountNum);

  const categoryOptions = categories.map((c) => {
    const parent = c.parentCategory
      ? categories.find((p) => p._id === c.parentCategory)
      : undefined;
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
        const patch: UpdateProductInput = {
          ...shared,
          ...(images.length > 0 ? { images: imagesPayload } : {}),
        };
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
        <Card>
          <CardHeading spacing="mb-4">Basics</CardHeading>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="product-name"
              label="Name *"
              type="text"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <TextField
              id="product-sku"
              label="SKU *"
              type="text"
              required
              disabled={Boolean(product)}
              value={sku}
              onChange={(event) => setSku(event.target.value)}
              className="font-mono text-xs"
              hint={product ? "SKU is immutable after create." : undefined}
            />
            <SelectField
              id="product-brand"
              label="Brand *"
              required
              value={brand}
              onChange={(event) => setBrand(event.target.value)}
            >
              <option value="">— select —</option>
              {brands.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </SelectField>
            <SelectField
              id="product-category"
              label="Category *"
              required
              value={category}
              onChange={(event) => handleCategoryChange(event.target.value)}
              hint="Changing this re-validates the specifications below against the new schema."
            >
              <option value="">— select —</option>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </SelectField>
            <Checkbox
              label="Featured (isFeatured)"
              checked={isFeatured}
              onChange={(event) => setIsFeatured(event.target.checked)}
            />
            <TextAreaField
              id="product-description"
              label="Description *"
              required
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              containerClassName="sm:col-span-2"
              height="h-24"
            />
          </div>
        </Card>

        <Card>
          <CardHeading spacing="mb-4">Images</CardHeading>
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
          <ProductImagesEditor
            images={images}
            onChange={setImages}
            min={product ? 0 : 1}
            max={8}
            purpose="product-image"
          />
        </Card>

        <Card>
          <CardHeading spacing="mb-4">Pricing &amp; stock</CardHeading>
          <div className="grid gap-4 sm:grid-cols-4">
            <TextField
              id="product-mrp"
              label="MRP (₹) *"
              type="number"
              required
              min={1}
              value={mrp}
              onChange={(event) => setMrp(event.target.value)}
              className="tabular-nums"
            />
            <TextField
              id="product-discount"
              label="Discount %"
              type="number"
              min={0}
              max={99}
              value={discount}
              onChange={(event) => setDiscount(event.target.value)}
              className="tabular-nums"
            />
            <ReadOnlyField
              label="Selling price"
              bordered
              size="sm"
              value={
                <span className="tabular-nums">
                  {sellingPreview !== null ? formatPrice(sellingPreview) : "—"}
                </span>
              }
            />
            <TextField
              id="product-stock"
              label="Stock *"
              type="number"
              required
              min={0}
              value={stock}
              onChange={(event) => setStock(event.target.value)}
              className="tabular-nums"
            />
            <TextField
              id="product-low-stock-threshold"
              label="Low-stock threshold"
              type="number"
              min={0}
              value={lowStockThreshold}
              onChange={(event) => setLowStockThreshold(event.target.value)}
              className="tabular-nums"
            />
          </div>
          <p className="mt-3 text-[11px] text-neutral-400">
            Selling price is read-only here: it is always recomputed server-side and a submitted
            value is ignored.
          </p>
        </Card>

        <Card>
          <CardHeading spacing="mb-1">Specifications</CardHeading>
          <p className="mb-4 text-[11px] text-neutral-400">
            Rendered from the selected category&apos;s schema, not a fixed field list.
          </p>
          <ProductSpecificationsFields
            categoryId={category}
            values={specValues}
            onChange={handleSpecChange}
          />
        </Card>

        {product && (
          <Card>
            <CardHeading spacing="mb-1">Variants</CardHeading>
            <ProductVariantsEditor
              productId={product._id}
              categoryId={category}
              variants={product.variants}
            />
          </Card>
        )}
        {!product && (
          <Card dashed className="text-sm text-neutral-500">
            Save the product first — variants are added on the edit screen.
          </Card>
        )}

        <Card>
          <CardHeading spacing="mb-4">SEO</CardHeading>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="product-meta-title"
              label="Meta title"
              type="text"
              placeholder="Defaults to the product name"
              value={metaTitle}
              onChange={(event) => setMetaTitle(event.target.value)}
            />
            <TextField
              id="product-meta-description"
              label="Meta description"
              type="text"
              placeholder="Defaults to a truncation of the description"
              value={metaDescription}
              onChange={(event) => setMetaDescription(event.target.value)}
            />
          </div>
        </Card>

        {saveErrorMessage && <InlineAlert>{saveErrorMessage}</InlineAlert>}

        <div className="flex gap-2">
          <Button type="submit" loading={isSaving} loadingLabel="Saving…">
            Save
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate("/products")}>
            Cancel
          </Button>
        </div>
      </form>
    </main>
  );
}
