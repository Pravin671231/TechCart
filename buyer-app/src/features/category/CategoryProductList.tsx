import { CategoryProductCard } from "./CategoryProductCard";
import type { PublicProductListItem } from "@/features/products/types";

export function CategoryProductList({ products }: { products: PublicProductListItem[] }) {
  return (
    <div className="flex flex-col">
      {products.map((product) => (
        <CategoryProductCard key={product._id} product={product} />
      ))}
    </div>
  );
}
