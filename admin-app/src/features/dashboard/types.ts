export interface DateRangeParams {
  from?: string;
  to?: string;
}

export interface SalesSummary {
  range: { from: string; to: string };
  totalOrders: number;
  totalRevenue: number;
  ordersByStatus: Record<string, number>;
}

export interface SalesOverTimePoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface SalesOverTime {
  range: { from: string; to: string };
  bucket: "day" | "week";
  series: SalesOverTimePoint[];
}

export interface TopProduct {
  productId: string;
  name: string;
  slug: string;
  unitsSold: number;
  revenue: number;
}

export interface TopProducts {
  range: { from: string; to: string };
  products: TopProduct[];
}

export interface CatalogSummary {
  totalProducts: number;
  productsByStatus: Record<string, number>;
  totalCategories: number;
  activeCategories: number;
  totalBrands: number;
  activeBrands: number;
}
