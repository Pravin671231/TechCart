import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { getApiErrorEnvelope } from "@/app/api/apiError";
import { useGetBrandsQuery } from "@/features/product-catalog/brands/brandsApi";
import { useGetCategoriesQuery } from "@/features/product-catalog/categories/categoriesApi";
import { PRODUCT_CATALOG_ROUTES } from "@/features/product-catalog/routePaths";
import { BreadcrumbHeading } from "@/components/ui/BreadcrumbHeading";
import { Button } from "@/components/ui/Button";
import { Card, CardHeading } from "@/components/ui/Card";
import { Checkbox } from "@/components/form/Checkbox";
import { SelectField, TextAreaField, TextField } from "@/components/form/FormField";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { useCreateProductMutation, useUpdateProductMutation } from "../productsApi";
import type {
  CreateProductInput,
  Product,
  ProductSpecificationGroup,
  UpdateProductInput,
} from "../types";
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

function describeApiError(envelope: ReturnType<typeof getApiErrorEnvelope>): string | null {
  if (!envelope) return null;
  if (envelope.message) return envelope.message;
  if (envelope.errors && typeof envelope.errors === "object") {
    return Object.values(envelope.errors as Record<string, string>).join("; ");
  }
  return "Unable to save this product.";
}

export const ProductForm = ({ product }: { product: Product | null }) => {
  const navigate = useNavigate();
  const { data: brandsData } = useGetBrandsQuery({ limit: 100 });
  const { data: categoriesData } = useGetCategoriesQuery({ limit: 100 });
  const brands = brandsData?.items ?? [];
  const categories = categoriesData?.items ?? [];

  const [name, setName] = useState(product?.name ?? "");
  const [brand, setBrand] = useState(product?.brand ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [isFeatured, setIsFeatured] = useState(product?.isFeatured ?? false);
  const [metaTitle, setMetaTitle] = useState(product?.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(product?.metaDescription ?? "");
  const [specValues, setSpecValues] = useState<SpecificationValues>(() =>
    initialSpecValues(product),
  );

  const [createProduct, { isLoading: isCreating, error: createError }] = useCreateProductMutation();
  const [updateProduct, { isLoading: isUpdating, error: updateError }] = useUpdateProductMutation();

  const isSaving = isCreating || isUpdating;
  const saveErrorMessage = describeApiError(getApiErrorEnvelope(createError ?? updateError));

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
      isFeatured,
      ...(metaTitle.trim() ? { metaTitle: metaTitle.trim() } : {}),
      ...(metaDescription.trim() ? { metaDescription: metaDescription.trim() } : {}),
    };

    try {
      if (product) {
        const patch: UpdateProductInput = shared;
        await updateProduct({ id: product._id, patch }).unwrap();
        navigate(PRODUCT_CATALOG_ROUTES.products.detail(product._id));
      } else {
        const input: CreateProductInput = shared;
        const created = await createProduct(input).unwrap();
        navigate(PRODUCT_CATALOG_ROUTES.products.edit(created._id));
      }
    } catch {
      // surfaced via saveErrorMessage below
    }
  }

  return (
    <main className="p-6">
      <div className="mb-2 flex items-center justify-between">
        <BreadcrumbHeading
          backTo={PRODUCT_CATALOG_ROUTES.products.list}
          backLabel="Products"
          current={product ? "Edit product" : "New product"}
        />
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
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(PRODUCT_CATALOG_ROUTES.products.list)}
          >
            Cancel
          </Button>
        </div>
      </form>
    </main>
  );
};
