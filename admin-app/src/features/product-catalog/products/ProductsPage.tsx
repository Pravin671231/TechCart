import { LinkButton } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";
import { PRODUCT_CATALOG_ROUTES } from "@/features/product-catalog/routePaths";
import { ProductList } from "./ProductList";

export const ProductsPage = () => {
  return (
    <main className="flex h-full min-h-0 flex-col p-6">
      <PageHeader
        title="Products"
        actions={
          <LinkButton to={PRODUCT_CATALOG_ROUTES.products.new}>+ New product</LinkButton>
        }
      />
      <ProductList />
    </main>
  );
};
