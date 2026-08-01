import { useFormContext, useWatch } from "react-hook-form";
import { FormField } from "@/components/form/FormField";
import { TextInput } from "@/components/form/TextInput";
import type { ProductFormValues } from "@/features/product-catalog/product-form/productFormSchema";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function PricingInventoryStep() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<ProductFormValues>();
  const mrp = useWatch({ control, name: "pricing.mrp" });
  const discount = useWatch({ control, name: "pricing.discount" });

  const sellingPrice =
    Number.isFinite(mrp) && Number.isFinite(discount)
      ? Math.max(0, mrp - Math.floor((mrp * discount) / 100))
      : 0;

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-4">
        <FormField label="MRP (₹)" htmlFor="pricing.mrp" required error={errors.pricing?.mrp?.message}>
          <TextInput
            id="pricing.mrp"
            type="number"
            hasError={!!errors.pricing?.mrp}
            {...register("pricing.mrp", { valueAsNumber: true })}
          />
        </FormField>

        <FormField label="Discount %" htmlFor="pricing.discount" error={errors.pricing?.discount?.message}>
          <TextInput
            id="pricing.discount"
            type="number"
            hasError={!!errors.pricing?.discount}
            {...register("pricing.discount", { valueAsNumber: true })}
          />
        </FormField>

        <FormField label="Selling price" htmlFor="pricing.sellingPrice">
          <TextInput id="pricing.sellingPrice" disabled readOnly value={currency.format(sellingPrice)} />
        </FormField>

        <FormField label="Stock" htmlFor="pricing.stock" required error={errors.pricing?.stock?.message}>
          <TextInput
            id="pricing.stock"
            type="number"
            hasError={!!errors.pricing?.stock}
            {...register("pricing.stock", { valueAsNumber: true })}
          />
        </FormField>

        <FormField label="Low-stock threshold" htmlFor="pricing.lowStockThreshold">
          <TextInput
            id="pricing.lowStockThreshold"
            type="number"
            hasError={!!errors.pricing?.lowStockThreshold}
            {...register("pricing.lowStockThreshold", { valueAsNumber: true })}
          />
        </FormField>
      </div>

      <p className="mt-3 text-[11px] text-neutral-400">
        Money is stored as integer paise. Discount is 0–99 (100 is excluded). Selling price is
        read-only here — it is always server-computed, never accepted from the client · FR-CAT-085,
        086, 087.
      </p>
    </div>
  );
}
