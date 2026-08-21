const SIZE_CLASSES = {
  sm: {
    price: "text-sm font-semibold text-neutral-900",
    mrp: "text-xs text-neutral-400 line-through",
    badge: "px-1.5 py-0.5 text-[10px]",
    gap: "gap-1.5",
  },
  md: {
    price: "text-lg font-bold text-neutral-900",
    mrp: "text-xs text-neutral-400 line-through",
    badge: "px-1.5 py-0.5 text-[10px]",
    gap: "gap-1.5",
  },
  lg: {
    price: "text-2xl font-bold text-neutral-900",
    mrp: "text-sm text-neutral-400 line-through",
    badge: "px-2 py-0.5 text-xs",
    gap: "gap-2",
  },
} as const;

export function PriceDisplay({
  price,
  mrp,
  discount,
  size = "md",
  stacked = false,
}: {
  price: string;
  mrp: string;
  discount: number;
  size?: keyof typeof SIZE_CLASSES;
  stacked?: boolean;
}) {
  const classes = SIZE_CLASSES[size];
  const badge = (
    <span className={`rounded-md bg-accent-100 font-medium text-accent-700 ${classes.badge}`}>
      {discount}% off
    </span>
  );

  if (stacked) {
    return (
      <>
        <p className={classes.price}>{price}</p>
        {discount > 0 && (
          <>
            <p className={classes.mrp}>{mrp}</p>
            {badge}
          </>
        )}
      </>
    );
  }

  return (
    <p className={`flex flex-wrap items-baseline ${classes.gap}`}>
      <span className={classes.price}>{price}</span>
      {discount > 0 && (
        <>
          <span className={classes.mrp}>{mrp}</span>
          {badge}
        </>
      )}
    </p>
  );
}
