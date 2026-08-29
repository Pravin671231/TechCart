import { Types } from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProductRecord } from "@/modules/product-catalog/features/products/products.repository";
import type { ProductVariant } from "@/modules/product-catalog/features/products/products.model";
import type { CartRecord } from "../cart.repository";

vi.mock("../cart.repository", () => ({
  findByUser: vi.fn(),
  getOrCreateByUser: vi.fn(),
  replaceItems: vi.fn(),
}));

vi.mock("@/modules/product-catalog/features/products/products.repository", () => ({
  findByVariantId: vi.fn(),
  findByVariantIds: vi.fn(),
}));

vi.mock("@/modules/inventory/inventory.service", () => ({
  allocateNewLine: vi.fn(),
  allocateAdditionalStock: vi.fn(),
  restoreStock: vi.fn(),
}));

import * as cartRepository from "../cart.repository";
import * as productsRepository from "@/modules/product-catalog/features/products/products.repository";
import * as inventoryService from "@/modules/inventory/inventory.service";
import { addItem, clearCart, getCart, removeItem, updateItem } from "../cart.service";

const userId = new Types.ObjectId().toString();
const variantA = new Types.ObjectId();
const variantB = new Types.ObjectId();
const productId = new Types.ObjectId();
const warehouseA = new Types.ObjectId();
const warehouseB = new Types.ObjectId();

function makeVariant(overrides: Partial<ProductVariant> = {}): ProductVariant {
  return {
    _id: variantA,
    sku: "NOVA-X5P-128-BLK",
    attributes: [
      { name: "Storage", value: "128GB" },
      { name: "Color", value: "Midnight Black" },
    ],
    images: [{ url: "https://cdn.test/a.webp", alt: "Nova", isPrimary: true }],
    mrp: 5000000,
    discount: 20,
    sellingPrice: 4000000,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeProduct(
  variants: ProductVariant[],
  overrides: Partial<ProductRecord> = {},
): ProductRecord {
  return {
    _id: productId,
    name: "Nova X5 Pro 5G",
    slug: "nova-x5-pro-5g",
    description: "A phone.",
    brand: new Types.ObjectId(),
    category: new Types.ObjectId(),
    specifications: [],
    variants,
    isFeatured: false,
    status: "published",
    createdBy: null,
    updatedBy: null,
    ...overrides,
  } as ProductRecord;
}

function cartWith(
  items: { variant: Types.ObjectId; quantity: number; warehouse?: Types.ObjectId }[],
): CartRecord {
  const withWarehouse = items.map((item) => ({ warehouse: warehouseA, ...item }));
  return { _id: new Types.ObjectId(), user: new Types.ObjectId(), items: withWarehouse } as CartRecord;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("getCart", () => {
  it("returns the empty-cart shape (no id) for a buyer with no cart document", async () => {
    vi.mocked(cartRepository.findByUser).mockResolvedValue(null);

    const cart = await getCart(userId);

    expect(cart).toEqual({ items: [], itemCount: 0, subtotal: 0 });
    expect(cart.id).toBeUndefined();
  });

  it("resolves live price, lineTotal, subtotal and itemCount from the referenced variant", async () => {
    vi.mocked(cartRepository.findByUser).mockResolvedValue(
      cartWith([{ variant: variantA, quantity: 2 }]),
    );
    vi.mocked(productsRepository.findByVariantIds).mockResolvedValue([
      makeProduct([makeVariant()]),
    ]);

    const cart = await getCart(userId);

    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]).toMatchObject({
      quantity: 2,
      sellingPrice: 4000000,
      lineTotal: 8000000,
      unavailable: false,
    });
    expect(cart.items[0]?.variant).toMatchObject({
      id: variantA.toString(),
      sku: "NOVA-X5P-128-BLK",
      product: { id: productId.toString(), name: "Nova X5 Pro 5G", slug: "nova-x5-pro-5g" },
      primaryImage: { url: "https://cdn.test/a.webp", alt: "Nova" },
    });
    expect(cart.itemCount).toBe(2);
    expect(cart.subtotal).toBe(8000000);
    // Issue #190/M10.2 — warehouse is an internal allocation detail, never
    // surfaced on the buyer-facing cart line view.
    expect(cart.items[0]).not.toHaveProperty("warehouse");
  });

  it("reflects a variant price change on the next read with no cart-side update", async () => {
    vi.mocked(cartRepository.findByUser).mockResolvedValue(
      cartWith([{ variant: variantA, quantity: 1 }]),
    );
    vi.mocked(productsRepository.findByVariantIds).mockResolvedValue([
      makeProduct([makeVariant({ sellingPrice: 3599900 })]),
    ]);

    const cart = await getCart(userId);

    expect(cart.items[0]?.sellingPrice).toBe(3599900);
    expect(cart.subtotal).toBe(3599900);
  });

  it("flags a deactivated variant unavailable, keeps it in items, excludes it from subtotal, still counts it", async () => {
    vi.mocked(cartRepository.findByUser).mockResolvedValue(
      cartWith([
        { variant: variantA, quantity: 1 },
        { variant: variantB, quantity: 3 },
      ]),
    );
    vi.mocked(productsRepository.findByVariantIds).mockResolvedValue([
      makeProduct([
        makeVariant({ _id: variantA, active: true, sellingPrice: 100000 }),
        makeVariant({ _id: variantB, active: false, sellingPrice: 129900 }),
      ]),
    ]);

    const cart = await getCart(userId);

    const lineB = cart.items.find((line) => line.variant.id === variantB.toString());
    expect(lineB).toMatchObject({ unavailable: true, lineTotal: 0 });
    expect(cart.items).toHaveLength(2);
    expect(cart.subtotal).toBe(100000); // only line A
    expect(cart.itemCount).toBe(4); // both lines counted
  });

  it("flags a line unavailable when its parent product is no longer published", async () => {
    vi.mocked(cartRepository.findByUser).mockResolvedValue(
      cartWith([{ variant: variantA, quantity: 1 }]),
    );
    vi.mocked(productsRepository.findByVariantIds).mockResolvedValue([
      makeProduct([makeVariant()], { status: "archived" }),
    ]);

    const cart = await getCart(userId);

    expect(cart.items[0]?.unavailable).toBe(true);
    expect(cart.subtotal).toBe(0);
  });

  it("flags an over-cap stored line unavailable without silently reducing it", async () => {
    vi.mocked(cartRepository.findByUser).mockResolvedValue(
      cartWith([{ variant: variantA, quantity: 11 }]),
    );
    vi.mocked(productsRepository.findByVariantIds).mockResolvedValue([
      makeProduct([makeVariant()]),
    ]);

    const cart = await getCart(userId);

    expect(cart.items[0]).toMatchObject({ quantity: 11, unavailable: true, lineTotal: 0 });
    expect(cart.itemCount).toBe(11);
  });
});

describe("addItem", () => {
  it("rejects a variant id that does not exist", async () => {
    vi.mocked(productsRepository.findByVariantId).mockResolvedValue(null);

    await expect(addItem(userId, variantA.toString(), 1)).rejects.toMatchObject({
      statusCode: 400,
      code: "VARIANT_NOT_FOUND",
    });
  });

  it("adds a new line, allocating it to whichever warehouse allocateNewLine returns (FR-INV-009)", async () => {
    vi.mocked(productsRepository.findByVariantId).mockResolvedValue(makeProduct([makeVariant()]));
    vi.mocked(cartRepository.getOrCreateByUser).mockResolvedValue(cartWith([]));
    vi.mocked(inventoryService.allocateNewLine).mockResolvedValue(warehouseB);
    vi.mocked(cartRepository.replaceItems).mockResolvedValue(
      cartWith([{ variant: variantA, quantity: 2, warehouse: warehouseB }]),
    );
    vi.mocked(productsRepository.findByVariantIds).mockResolvedValue([
      makeProduct([makeVariant()]),
    ]);

    await addItem(userId, variantA.toString(), 2);

    expect(inventoryService.allocateNewLine).toHaveBeenCalledWith(variantA, 2);
    expect(cartRepository.replaceItems).toHaveBeenCalledWith(expect.anything(), [
      { variant: variantA, quantity: 2, warehouse: warehouseB },
    ]);
  });

  it("propagates INSUFFICIENT_STOCK from allocateNewLine without persisting anything", async () => {
    vi.mocked(productsRepository.findByVariantId).mockResolvedValue(makeProduct([makeVariant()]));
    vi.mocked(cartRepository.getOrCreateByUser).mockResolvedValue(cartWith([]));
    vi.mocked(inventoryService.allocateNewLine).mockRejectedValue(
      Object.assign(new Error("out of stock"), { statusCode: 409, code: "INSUFFICIENT_STOCK" }),
    );

    await expect(addItem(userId, variantA.toString(), 2)).rejects.toMatchObject({
      statusCode: 409,
      code: "INSUFFICIENT_STOCK",
    });
    expect(cartRepository.replaceItems).not.toHaveBeenCalled();
  });

  it("combines with an existing line, re-checking only its own recorded warehouse (FR-INV-011)", async () => {
    vi.mocked(productsRepository.findByVariantId).mockResolvedValue(makeProduct([makeVariant()]));
    vi.mocked(cartRepository.getOrCreateByUser).mockResolvedValue(
      cartWith([{ variant: variantA, quantity: 2, warehouse: warehouseA }]),
    );
    vi.mocked(cartRepository.replaceItems).mockResolvedValue(
      cartWith([{ variant: variantA, quantity: 5, warehouse: warehouseA }]),
    );
    vi.mocked(productsRepository.findByVariantIds).mockResolvedValue([
      makeProduct([makeVariant()]),
    ]);

    await addItem(userId, variantA.toString(), 3);

    expect(inventoryService.allocateAdditionalStock).toHaveBeenCalledWith(variantA, warehouseA, 3);
    expect(inventoryService.allocateNewLine).not.toHaveBeenCalled();
    const passed = vi.mocked(cartRepository.replaceItems).mock.calls[0]?.[1];
    expect(passed).toHaveLength(1);
    expect(passed?.[0]?.quantity).toBe(5);
  });

  it("rejects an accumulated quantity above the cap, not clamped, before checking stock", async () => {
    vi.mocked(productsRepository.findByVariantId).mockResolvedValue(makeProduct([makeVariant()]));
    vi.mocked(cartRepository.getOrCreateByUser).mockResolvedValue(
      cartWith([{ variant: variantA, quantity: 8, warehouse: warehouseA }]),
    );

    await expect(addItem(userId, variantA.toString(), 5)).rejects.toMatchObject({
      statusCode: 400,
      code: "QUANTITY_OUT_OF_RANGE",
    });
    expect(inventoryService.allocateAdditionalStock).not.toHaveBeenCalled();
    expect(cartRepository.replaceItems).not.toHaveBeenCalled();
  });
});

describe("updateItem", () => {
  it("removes the line when quantity is set to 0, restoring its full quantity", async () => {
    vi.mocked(cartRepository.findByUser).mockResolvedValue(
      cartWith([
        { variant: variantA, quantity: 2, warehouse: warehouseA },
        { variant: variantB, quantity: 1, warehouse: warehouseB },
      ]),
    );
    vi.mocked(cartRepository.replaceItems).mockResolvedValue(
      cartWith([{ variant: variantB, quantity: 1, warehouse: warehouseB }]),
    );
    vi.mocked(productsRepository.findByVariantIds).mockResolvedValue([]);

    await updateItem(userId, variantA.toString(), 0);

    expect(inventoryService.restoreStock).toHaveBeenCalledWith(variantA, warehouseA, 2);
    const passed = vi.mocked(cartRepository.replaceItems).mock.calls[0]?.[1];
    expect(passed).toHaveLength(1);
    expect(passed?.[0]?.variant.equals(variantB)).toBe(true);
  });

  it("allocates only the delta at the line's own warehouse on an increase", async () => {
    vi.mocked(cartRepository.findByUser).mockResolvedValue(
      cartWith([{ variant: variantA, quantity: 2, warehouse: warehouseA }]),
    );
    vi.mocked(cartRepository.replaceItems).mockResolvedValue(
      cartWith([{ variant: variantA, quantity: 5, warehouse: warehouseA }]),
    );
    vi.mocked(productsRepository.findByVariantIds).mockResolvedValue([]);

    await updateItem(userId, variantA.toString(), 5);

    expect(inventoryService.allocateAdditionalStock).toHaveBeenCalledWith(variantA, warehouseA, 3);
    expect(inventoryService.restoreStock).not.toHaveBeenCalled();
  });

  it("restores only the delta at the line's own warehouse on a decrease", async () => {
    vi.mocked(cartRepository.findByUser).mockResolvedValue(
      cartWith([{ variant: variantA, quantity: 5, warehouse: warehouseA }]),
    );
    vi.mocked(cartRepository.replaceItems).mockResolvedValue(
      cartWith([{ variant: variantA, quantity: 2, warehouse: warehouseA }]),
    );
    vi.mocked(productsRepository.findByVariantIds).mockResolvedValue([]);

    await updateItem(userId, variantA.toString(), 2);

    expect(inventoryService.restoreStock).toHaveBeenCalledWith(variantA, warehouseA, 3);
    expect(inventoryService.allocateAdditionalStock).not.toHaveBeenCalled();
  });

  it("touches neither allocate nor restore when the quantity is unchanged", async () => {
    vi.mocked(cartRepository.findByUser).mockResolvedValue(
      cartWith([{ variant: variantA, quantity: 3, warehouse: warehouseA }]),
    );
    vi.mocked(cartRepository.replaceItems).mockResolvedValue(
      cartWith([{ variant: variantA, quantity: 3, warehouse: warehouseA }]),
    );
    vi.mocked(productsRepository.findByVariantIds).mockResolvedValue([]);

    await updateItem(userId, variantA.toString(), 3);

    expect(inventoryService.allocateAdditionalStock).not.toHaveBeenCalled();
    expect(inventoryService.restoreStock).not.toHaveBeenCalled();
  });

  it("propagates INSUFFICIENT_STOCK from an increase without persisting anything", async () => {
    vi.mocked(cartRepository.findByUser).mockResolvedValue(
      cartWith([{ variant: variantA, quantity: 2, warehouse: warehouseA }]),
    );
    vi.mocked(inventoryService.allocateAdditionalStock).mockRejectedValue(
      Object.assign(new Error("not enough"), { statusCode: 409, code: "INSUFFICIENT_STOCK" }),
    );

    await expect(updateItem(userId, variantA.toString(), 9)).rejects.toMatchObject({
      statusCode: 409,
      code: "INSUFFICIENT_STOCK",
    });
    expect(cartRepository.replaceItems).not.toHaveBeenCalled();
  });

  it("throws CART_ITEM_NOT_FOUND for a variant not in the cart", async () => {
    vi.mocked(cartRepository.findByUser).mockResolvedValue(
      cartWith([{ variant: variantB, quantity: 1 }]),
    );

    await expect(updateItem(userId, variantA.toString(), 3)).rejects.toMatchObject({
      statusCode: 404,
      code: "CART_ITEM_NOT_FOUND",
    });
  });

  it("throws CART_ITEM_NOT_FOUND when the buyer has no cart", async () => {
    vi.mocked(cartRepository.findByUser).mockResolvedValue(null);

    await expect(updateItem(userId, variantA.toString(), 3)).rejects.toMatchObject({
      code: "CART_ITEM_NOT_FOUND",
    });
  });
});

describe("removeItem", () => {
  it("drops the line and restores its full quantity to its recorded warehouse", async () => {
    vi.mocked(cartRepository.findByUser).mockResolvedValue(
      cartWith([
        { variant: variantA, quantity: 2, warehouse: warehouseA },
        { variant: variantB, quantity: 1, warehouse: warehouseB },
      ]),
    );
    vi.mocked(cartRepository.replaceItems).mockResolvedValue(
      cartWith([{ variant: variantB, quantity: 1, warehouse: warehouseB }]),
    );
    vi.mocked(productsRepository.findByVariantIds).mockResolvedValue([]);

    await removeItem(userId, variantA.toString());

    expect(inventoryService.restoreStock).toHaveBeenCalledWith(variantA, warehouseA, 2);
    const passed = vi.mocked(cartRepository.replaceItems).mock.calls[0]?.[1];
    expect(passed).toHaveLength(1);
  });

  it("throws CART_ITEM_NOT_FOUND when the line is absent", async () => {
    vi.mocked(cartRepository.findByUser).mockResolvedValue(
      cartWith([{ variant: variantB, quantity: 1 }]),
    );

    await expect(removeItem(userId, variantA.toString())).rejects.toMatchObject({
      code: "CART_ITEM_NOT_FOUND",
    });
    expect(inventoryService.restoreStock).not.toHaveBeenCalled();
  });
});

describe("clearCart", () => {
  it("restores every remaining line's quantity to its own warehouse, then replaces items with an empty one", async () => {
    vi.mocked(cartRepository.findByUser).mockResolvedValue(
      cartWith([
        { variant: variantA, quantity: 2, warehouse: warehouseA },
        { variant: variantB, quantity: 4, warehouse: warehouseB },
      ]),
    );
    vi.mocked(cartRepository.replaceItems).mockResolvedValue(cartWith([]));

    const cart = await clearCart(userId);

    expect(inventoryService.restoreStock).toHaveBeenCalledWith(variantA, warehouseA, 2);
    expect(inventoryService.restoreStock).toHaveBeenCalledWith(variantB, warehouseB, 4);
    expect(cartRepository.replaceItems).toHaveBeenCalledWith(expect.anything(), []);
    expect(cart).toMatchObject({ itemCount: 0, subtotal: 0, items: [] });
  });

  it("is a no-op for a buyer with no cart", async () => {
    vi.mocked(cartRepository.findByUser).mockResolvedValue(null);

    const cart = await clearCart(userId);

    expect(inventoryService.restoreStock).not.toHaveBeenCalled();
    expect(cartRepository.replaceItems).not.toHaveBeenCalled();
    expect(cart).toEqual({ items: [], itemCount: 0, subtotal: 0 });
  });
});
