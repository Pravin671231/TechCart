export type CategoryStatus = "active" | "inactive";

export type Category = {
  id: string;
  name: string;
  parent: string | null;
  productCount: number;
  sortOrder: number;
  status: CategoryStatus;
};

export const mockCategories: Category[] = [
  {
    id: "electronics",
    name: "Electronics",
    parent: null,
    productCount: 0,
    sortOrder: 1,
    status: "active",
  },
  {
    id: "smartphones",
    name: "Smartphones",
    parent: "Electronics",
    productCount: 36,
    sortOrder: 1,
    status: "active",
  },
  {
    id: "laptops",
    name: "Laptops",
    parent: "Electronics",
    productCount: 18,
    sortOrder: 2,
    status: "active",
  },
  {
    id: "accessories",
    name: "Accessories",
    parent: null,
    productCount: 0,
    sortOrder: 3,
    status: "inactive",
  },
];
