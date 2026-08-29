export interface Warehouse {
  _id: string;
  name: string;
  code: string;
  active: boolean;
  createdAt: string;
}

export interface CreateWarehouseInput {
  name: string;
  code: string;
}

export interface InventoryItem {
  _id: string;
  productId: string;
  productName: string;
  variantId: string;
  variantSku: string;
  warehouseId: string;
  warehouseName: string;
  stock: number;
}
