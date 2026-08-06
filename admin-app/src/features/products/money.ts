const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatPrice(amountInRupees: number): string {
  return currencyFormatter.format(amountInRupees);
}
