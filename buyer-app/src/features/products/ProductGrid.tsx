import { ProductCard } from "./ProductCard";
import type { PublicProductListItem } from "./types";

export function ProductGrid({ products }: { products: PublicProductListItem[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product._id} product={product} />
      ))}
    </div>
  );
}
