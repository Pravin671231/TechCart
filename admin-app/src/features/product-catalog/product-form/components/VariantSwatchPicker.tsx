type VariantSwatchPickerProps = {
  options: string[];
  value: string;
  onChange: (value: string) => void;
};

// Literal Tailwind color utilities here represent actual product swatch
// colors (user-facing content), not UI chrome, so they're exempt from the
// design.md-tokens-only rule that applies to the rest of this app's UI.
const swatchColorMap: Record<string, string> = {
  Black: "bg-neutral-900",
  Silver: "bg-neutral-300",
  Blue: "bg-blue-600",
  White: "bg-white",
  Red: "bg-red-600",
  Green: "bg-green-600",
};

export function VariantSwatchPicker({ options, value, onChange }: VariantSwatchPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-label={option}
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={`h-8 w-8 rounded-full border-2 ${swatchColorMap[option] ?? "bg-neutral-400"} ${
            value === option ? "border-primary-600" : "border-neutral-200"
          }`}
        />
      ))}
    </div>
  );
}
