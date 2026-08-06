import type { PublicProductVariant } from "@/features/products/types";

function collectAxes(variants: PublicProductVariant[]): Map<string, string[]> {
  const axes = new Map<string, string[]>();
  for (const variant of variants) {
    for (const attribute of variant.attributes) {
      const values = axes.get(attribute.name) ?? [];
      if (!values.includes(attribute.value)) values.push(attribute.value);
      axes.set(attribute.name, values);
    }
  }
  return axes;
}

// A value is offered as selectable when at least one variant carries it
// alongside every *other* currently-selected axis value — changing one axis
// should only rule out combinations that don't exist, not the whole axis.
function isValueAvailable(
  variants: PublicProductVariant[],
  axisName: string,
  value: string,
  selectedAttributes: Record<string, string>,
): boolean {
  return variants.some(
    (variant) =>
      variant.attributes.some((a) => a.name === axisName && a.value === value) &&
      Object.entries(selectedAttributes).every(
        ([otherAxis, otherValue]) =>
          otherAxis === axisName ||
          variant.attributes.some((a) => a.name === otherAxis && a.value === otherValue),
      ),
  );
}

export function VariantSelector({
  variants,
  selectedAttributes,
  onSelect,
}: {
  variants: PublicProductVariant[];
  selectedAttributes: Record<string, string>;
  onSelect: (axisName: string, value: string) => void;
}) {
  const axes = collectAxes(variants);
  if (axes.size === 0) return null;

  return (
    <section className="rounded-lg border border-neutral-200 p-4">
      <h2 className="mb-3 text-xs font-semibold tracking-wide text-neutral-700 uppercase">
        Choose a variant
      </h2>
      {[...axes.entries()].map(([axisName, values]) => (
        <div key={axisName} className="mb-4 last:mb-0">
          <p className="mb-1 text-sm text-neutral-500">{axisName}</p>
          <div className="flex flex-wrap gap-2">
            {values.map((value) => {
              const isSelected = selectedAttributes[axisName] === value;
              const isAvailable = isValueAvailable(variants, axisName, value, selectedAttributes);
              return (
                <button
                  key={value}
                  type="button"
                  disabled={!isAvailable}
                  onClick={() => onSelect(axisName, value)}
                  aria-pressed={isSelected}
                  className={
                    isSelected
                      ? "rounded-md border-2 border-primary-600 bg-primary-50 px-3 py-1 text-sm font-medium text-primary-700"
                      : isAvailable
                        ? "rounded-md border border-neutral-300 px-3 py-1 text-sm text-neutral-600 hover:border-primary-400"
                        : "rounded-md border border-neutral-200 px-3 py-1 text-sm text-neutral-300 line-through"
                  }
                >
                  {value}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="mt-3 text-[11px] text-neutral-400">
        Defaults to the lowest-priced active variant. Selecting another updates price, stock, and
        images.
      </p>
    </section>
  );
}
