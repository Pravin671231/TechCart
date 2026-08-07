import { Route } from "react-router";
import { BrandsPage } from "./brands/BrandsPage";
import { CategoriesPage } from "./categories/CategoriesPage";
import { CategorySpecificationsPage } from "./categorySpecifications/CategorySpecificationsPage";
import { CategoryVariantsPage } from "./categoryVariants/CategoryVariantsPage";
import { ProductsPage } from "./products/ProductsPage";
import { ProductDetailPage } from "./products/ProductDetailPage";
import { ProductFormPage } from "./products/productForm/ProductFormPage";
import { PRODUCT_CATALOG_ROUTES } from "./routePaths";

export function ProductCatalogRoutes() {
  return (
    <>
      <Route path={PRODUCT_CATALOG_ROUTES.brands} element={<BrandsPage />} />
      <Route path={PRODUCT_CATALOG_ROUTES.categories} element={<CategoriesPage />} />
      <Route path={PRODUCT_CATALOG_ROUTES.specifications} element={<CategorySpecificationsPage />} />
      <Route path={PRODUCT_CATALOG_ROUTES.variantTypes} element={<CategoryVariantsPage />} />
      <Route path={PRODUCT_CATALOG_ROUTES.products.list} element={<ProductsPage />} />
      <Route path={PRODUCT_CATALOG_ROUTES.products.new} element={<ProductFormPage />} />
      <Route path={PRODUCT_CATALOG_ROUTES.products.detailPattern} element={<ProductDetailPage />} />
      <Route path={PRODUCT_CATALOG_ROUTES.products.editPattern} element={<ProductFormPage />} />
    </>
  );
}
