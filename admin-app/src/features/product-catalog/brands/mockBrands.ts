export type BrandStatus = "active" | "inactive";

export type Brand = {
  id: string;
  name: string;
  productCount: number;
  status: BrandStatus;
};

export const mockBrands: Brand[] = [
  { id: "brand-a", name: "Brand A", productCount: 42, status: "active" },
  { id: "brand-b", name: "Brand B", productCount: 17, status: "active" },
  { id: "brand-c", name: "Brand C", productCount: 0, status: "inactive" },
];
