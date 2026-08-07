export const PRODUCT_CATALOG_ROUTES = {
  brands: "/brands",
  categories: "/categories",
  specifications: "/specifications",
  variantTypes: "/variant-types",
  products: {
    list: "/products",
    new: "/products/new",
    detailPattern: "/products/:id",
    editPattern: "/products/:id/edit",
    detail: (id: string) => `/products/${id}`,
    edit: (id: string) => `/products/${id}/edit`,
  },
} as const;
