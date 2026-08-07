import { useState, type FormEvent } from "react";
import { getApiErrorEnvelope } from "@/app/api/responseEnvelope";
import { useGetCategoryVariantsQuery } from "@/features/product-catalog/categoryVariants/categoryVariantsApi";
import type { VariantAxis } from "@/features/product-catalog/categoryVariants/types";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/form/Checkbox";
import { TextField } from "@/components/form/FormField";
import { formatPrice } from "../money";
import { useAddVariantMutation, useUpdateVariantMutation } from "../productsApi";
import type { ProductVariant } from "../types";
import { ProductImagesEditor, type UploadedImage } from "./ProductImagesEditor";

function computeSellingPreview(mrp: number, discount: number): number | null {
  if (!Number.isFinite(mrp) || mrp <= 0) return null;
  const clamped = Math.min(Math.max(discount, 0), 99);
  return mrp - Math.floor((mrp * clamped) / 100);
}

function AxisControl({
  axis,
  value,
  onChange,
}: {
  axis: VariantAxis;
  value: string;
  onChange: (value: string) => void;
}) {
  if (axis.type === "color") {
    return (
      <div className="mt-1 flex flex-wrap gap-1">
        {(axis.options ?? []).map((option) => (
          <button
            key={option.value}
            type="button"
            title={option.label}
            aria-label={`${axis.name}: ${option.label}`}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            style={{ background: option.value }}
            className={
              value === option.value
                ? "h-8 w-8 rounded-full ring-2 ring-primary-600 ring-offset-2"
                : "h-8 w-8 rounded-full border border-neutral-300"
            }
          />
        ))}
      </div>
    );
  }

  if (axis.type === "select") {
    return (
      <select
        aria-label={axis.name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2"
      >
        <option value="">— select —</option>
        {(axis.options ?? []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      type={axis.type === "number" ? "number" : "text"}
      aria-label={axis.name}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2"
    />
  );
}

function VariantForm({
  productId,
  axes,
  variant,
  onDone,
  onCancel,
}: {
  productId: string;
  axes: VariantAxis[];
  variant: ProductVariant | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [addVariant, { isLoading: isAdding, error: addError }] = useAddVariantMutation();
  const [updateVariant, { isLoading: isUpdating, error: updateError }] = useUpdateVariantMutation();

  const [attributeValues, setAttributeValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const axis of axes) {
      initial[axis.code] = variant?.attributes.find((a) => a.name === axis.name)?.value ?? "";
    }
    return initial;
  });
  const [sku, setSku] = useState(variant?.sku ?? "");
  const [mrp, setMrp] = useState(variant ? String(variant.mrp) : "");
  const [discount, setDiscount] = useState(variant ? String(variant.discount) : "0");
  const [stock, setStock] = useState(variant ? String(variant.stock) : "");
  const [weight, setWeight] = useState(variant?.weight !== undefined ? String(variant.weight) : "");
  const [active, setActive] = useState(variant?.active ?? true);
  const [images, setImages] = useState<UploadedImage[]>([]);

  const isSaving = isAdding || isUpdating;
  const saveError = getApiErrorEnvelope(addError ?? updateError);

  const mrpNum = Number(mrp);
  const discountNum = discount === "" ? 0 : Number(discount);
  const sellingPreview = computeSellingPreview(mrpNum, discountNum);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const attributes = axes
      .map((axis) => ({ name: axis.name, value: attributeValues[axis.code] ?? "" }))
      .filter((attribute) => attribute.value !== "");

    const body = {
      sku: sku.trim(),
      attributes,
      mrp: Number(mrp),
      discount: discount === "" ? 0 : Number(discount),
      stock: Number(stock),
      ...(weight !== "" ? { weight: Number(weight) } : {}),
      ...(images.length > 0
        ? {
            images: images.map((image) => ({
              objectKey: image.objectKey,
              alt: image.alt || undefined,
              isPrimary: image.isPrimary,
            })),
          }
        : {}),
    };

    try {
      if (variant) {
        await updateVariant({
          productId,
          variantId: variant._id,
          patch: { ...body, active },
        }).unwrap();
      } else {
        await addVariant({ productId, body }).unwrap();
      }
      onDone();
    } catch {
      // surfaced via saveError below
    }
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="mb-4 rounded-lg border border-neutral-200 bg-neutral-50 p-3"
    >
      <div className="grid gap-3 sm:grid-cols-5">
        {axes.map((axis) => (
          <label key={axis.code} className="block text-sm">
            <span className="text-neutral-500">
              {axis.name} <em>({axis.type})</em>
            </span>
            <AxisControl
              axis={axis}
              value={attributeValues[axis.code] ?? ""}
              onChange={(value) => setAttributeValues((prev) => ({ ...prev, [axis.code]: value }))}
            />
          </label>
        ))}
        <TextField
          id={`variant-sku-${variant?._id ?? "new"}`}
          label="SKU *"
          type="text"
          required
          value={sku}
          onChange={(event) => setSku(event.target.value)}
          className="bg-white font-mono text-xs"
        />
        <TextField
          id={`variant-mrp-${variant?._id ?? "new"}`}
          label="MRP (₹) *"
          type="number"
          required
          value={mrp}
          onChange={(event) => setMrp(event.target.value)}
          className="bg-white tabular-nums"
        />
        <TextField
          id={`variant-discount-${variant?._id ?? "new"}`}
          label="Discount %"
          type="number"
          value={discount}
          onChange={(event) => setDiscount(event.target.value)}
          className="bg-white tabular-nums"
        />
        <TextField
          id={`variant-stock-${variant?._id ?? "new"}`}
          label="Stock *"
          type="number"
          required
          value={stock}
          onChange={(event) => setStock(event.target.value)}
          className="bg-white tabular-nums"
        />
      </div>

      <p className="mt-2 text-xs text-neutral-500">
        Selling price: {sellingPreview !== null ? formatPrice(sellingPreview) : "—"}{" "}
        <span className="text-[11px] text-neutral-400">(preview — server-computed)</span>
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-neutral-500">
        <Checkbox
          label="Active"
          labelClassName="gap-1.5"
          checked={active}
          onChange={(event) => setActive(event.target.checked)}
        />
        <label className="flex items-center gap-1.5">
          Weight (optional)
          <input
            type="number"
            value={weight}
            onChange={(event) => setWeight(event.target.value)}
            className="w-20 rounded-md border border-neutral-300 bg-white px-2 py-1"
          />
        </label>
      </div>

      <div className="mt-3">
        <ProductImagesEditor
          images={images}
          onChange={setImages}
          min={0}
          max={2}
          purpose="product-image"
          label="Images 0–2 (falls back to the product's)"
        />
      </div>

      {saveError && (
        <p role="alert" className="mt-3 text-sm text-red-800">
          {saveError.message ?? "Unable to save this variant."}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <Button type="submit" size="sm" loading={isSaving} loadingLabel="Saving…">
          {variant ? "Save variant" : "Add variant"}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function formatAttributes(attributes: { name: string; value: string }[]): string {
  return attributes.map((attribute) => `${attribute.name}=${attribute.value}`).join(" · ");
}

export function ProductVariantsEditor({
  productId,
  categoryId,
  variants,
}: {
  productId: string;
  categoryId: string;
  variants: ProductVariant[];
}) {
  const { data, isLoading } = useGetCategoryVariantsQuery(categoryId, { skip: !categoryId });
  const axes = data?.variants ?? [];
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  function closeEditors() {
    setEditingVariantId(null);
    setIsAddingNew(false);
  }

  return (
    <div>
      <p className="mb-4 text-[11px] text-neutral-400">
        One control per axis, chosen by the axis type defined for this category — swatch for color,
        dropdown for select, numeric for number, text otherwise.
      </p>

      {isLoading && <p className="text-sm text-neutral-500">Loading variant axes…</p>}

      {variants.map((variant) =>
        editingVariantId === variant._id ? (
          <VariantForm
            key={variant._id}
            productId={productId}
            axes={axes}
            variant={variant}
            onDone={closeEditors}
            onCancel={closeEditors}
          />
        ) : (
          <div
            key={variant._id}
            className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 p-3 text-sm text-neutral-500"
          >
            <span>
              {formatAttributes(variant.attributes)} — {formatPrice(variant.sellingPrice)} · stock{" "}
              {variant.stock} · {variant.active ? "active" : "inactive"}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsAddingNew(false);
                setEditingVariantId(variant._id);
              }}
              className="text-xs text-primary-600 hover:underline"
            >
              Edit
            </button>
          </div>
        ),
      )}

      {isAddingNew ? (
        <VariantForm
          productId={productId}
          axes={axes}
          variant={null}
          onDone={closeEditors}
          onCancel={closeEditors}
        />
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setEditingVariantId(null);
            setIsAddingNew(true);
          }}
        >
          + Add variant
        </Button>
      )}
    </div>
  );
}
