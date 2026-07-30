export type ProductStatus = "published" | "draft" | "archived";

export type Product = {
  id: string;
  name: string;
  sku: string;
  brand: string;
  category: string;
  sellingPrice: number;
  stock: number;
  lowStockThreshold: number;
  status: ProductStatus;
};

export const mockProducts: Product[] = [
  {
    id: "1",
    name: "Aurora X12 Smartphone",
    sku: "TC-SP-0001",
    brand: "Brand A",
    category: "Smartphones",
    sellingPrice: 44910,
    stock: 128,
    lowStockThreshold: 10,
    status: "published",
  },
  {
    id: "2",
    name: "Nova Lite Smartphone",
    sku: "TC-SP-0002",
    brand: "Brand B",
    category: "Smartphones",
    sellingPrice: 31999,
    stock: 2,
    lowStockThreshold: 5,
    status: "published",
  },
  {
    id: "3",
    name: "ProBook 14 Laptop",
    sku: "TC-LP-0007",
    brand: "Brand C",
    category: "Laptops",
    sellingPrice: 89900,
    stock: 14,
    lowStockThreshold: 5,
    status: "draft",
  },
  {
    id: "4",
    name: "SoundBeam Earbuds",
    sku: "TC-AC-0045",
    brand: "Brand D",
    category: "Accessories",
    sellingPrice: 2499,
    stock: 40,
    lowStockThreshold: 10,
    status: "published",
  },
  {
    id: "5",
    name: "USB-C Charger 20W",
    sku: "TC-AC-0031",
    brand: "Brand A",
    category: "Accessories",
    sellingPrice: 1299,
    stock: 0,
    lowStockThreshold: 10,
    status: "archived",
  },
];
