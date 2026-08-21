import { useState } from "react";

export function PriceRangeInput({
  minPrice,
  maxPrice,
  onCommit,
}: {
  minPrice: number | undefined;
  maxPrice: number | undefined;
  onCommit: (minPrice: number | undefined, maxPrice: number | undefined) => void;
}) {
  const [minInput, setMinInput] = useState(minPrice?.toString() ?? "");
  const [maxInput, setMaxInput] = useState(maxPrice?.toString() ?? "");

  function commit() {
    onCommit(minInput === "" ? undefined : Number(minInput), maxInput === "" ? undefined : Number(maxInput));
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <input
        type="number"
        aria-label="Minimum price"
        placeholder="Min ₹"
        value={minInput}
        onChange={(event) => setMinInput(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
        }}
        className="w-full min-w-0 rounded-md border border-neutral-300 px-2 py-1.5 text-neutral-700"
      />
      <span className="text-neutral-400">—</span>
      <input
        type="number"
        aria-label="Maximum price"
        placeholder="Max ₹"
        value={maxInput}
        onChange={(event) => setMaxInput(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
        }}
        className="w-full min-w-0 rounded-md border border-neutral-300 px-2 py-1.5 text-neutral-700"
      />
    </div>
  );
}
