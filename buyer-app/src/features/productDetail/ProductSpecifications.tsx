import type { ProductSpecificationGroup } from "@/features/products/types";

export function ProductSpecifications({ groups }: { groups: ProductSpecificationGroup[] }) {
  if (groups.length === 0) return null;

  return (
    <section className="mt-10 max-w-3xl">
      <h2 className="mb-2 text-sm font-medium tracking-wide text-neutral-500 uppercase">
        Specifications
      </h2>
      <div className="overflow-hidden rounded-lg border border-neutral-200">
        {groups.map((group) => (
          <div key={group.groupName}>
            <p className="border-y border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-800 first:border-t-0">
              {group.groupName}
            </p>
            <dl className="divide-y divide-neutral-100 text-sm">
              {group.values.map((value) => (
                <div key={value.name} className="flex px-3 py-2">
                  <dt className="w-48 shrink-0 text-neutral-500">{value.name}</dt>
                  <dd className="text-neutral-800">{String(value.value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}
