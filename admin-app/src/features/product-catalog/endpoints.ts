export const PRODUCT_CATALOG_ENDPOINTS = {
  brands: {
    list: "/brands",
    detail: (id: string) => `/brands/${id}`,
    status: (id: string) => `/brands/${id}/status`,
  },
  categories: {
    list: "/categories",
    detail: (id: string) => `/categories/${id}`,
    status: (id: string) => `/categories/${id}/status`,
  },
  categorySpecifications: {
    detail: (categoryId: string) => `/categories/${categoryId}/specifications`,
  },
  categoryVariants: {
    detail: (categoryId: string) => `/categories/${categoryId}/variant-types`,
  },
  products: {
    list: "/products",
    detail: (id: string) => `/products/${id}`,
    status: (id: string) => `/products/${id}/status`,
    stock: (id: string) => `/products/${id}/stock`,
    variants: (productId: string) => `/products/${productId}/variants`,
    variant: (productId: string, variantId: string) => `/products/${productId}/variants/${variantId}`,
  },
} as const;
