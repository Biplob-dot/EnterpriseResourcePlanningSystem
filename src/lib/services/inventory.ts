import { db } from "@/db";
import {
  products,
  categories,
  brands,
  units,
  inventoryTransactions,
  warehouses,
  bins,
  racks,
  warehouseZones,
  stockAdjustments,
  auditLogs,
} from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { num } from "@/lib/format";

export type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type TxType = "PURCHASE" | "SALE" | "RETURN_SALE" | "RETURN_PURCHASE" | "ADJUSTMENT" | "TRANSFER";

export type PostTxInput = {
  productId: number;
  warehouseId?: number | null;
  binId?: number | null;
  /** Signed quantity: positive increases stock, negative decreases. */
  quantity: number;
  unitId?: number | null;
  transactionType: TxType;
  referenceDocument?: string | null;
  notes?: string | null;
};

/** Current stock for a single product (optionally per warehouse). */
export async function getProductStock(
  productId: number,
  warehouseId?: number | null,
  tx: DbTx | typeof db = db
): Promise<number> {
  const where = warehouseId
    ? and(eq(inventoryTransactions.productId, productId), eq(inventoryTransactions.warehouseId, warehouseId))
    : eq(inventoryTransactions.productId, productId);

  const [row] = await tx
    .select({ total: sql<string>`coalesce(sum(${inventoryTransactions.quantity}), 0)` })
    .from(inventoryTransactions)
    .where(where);
  return num(row?.total);
}

/**
 * Records an inventory movement with previous/new stock snapshot.
 * Must be called inside a transaction for multi-step operations.
 */
export async function postInventoryTransaction(tx: DbTx | typeof db, input: PostTxInput) {
  const previous = await getProductStock(input.productId, null, tx);
  const next = previous + input.quantity;

  await tx.insert(inventoryTransactions).values({
    productId: input.productId,
    warehouseId: input.warehouseId ?? null,
    binId: input.binId ?? null,
    quantity: input.quantity.toFixed(4),
    unitId: input.unitId ?? null,
    transactionType: input.transactionType,
    referenceDocument: input.referenceDocument ?? null,
    previousStock: previous.toFixed(4),
    newStock: next.toFixed(4),
    notes: input.notes ?? null,
  });

  return { previous, next };
}

export type StockRow = {
  id: number;
  code: string;
  name: string;
  barcode: string | null;
  unitId: number | null;
  taxRate: string | null;
  category: string | null;
  brand: string | null;
  unit: string | null;
  purchasePrice: string | null;
  sellingPrice: string | null;
  reorderLevel: string | null;
  minStockLevel: string | null;
  isActive: boolean | null;
  stock: number;
  stockValue: number;
};

/** Product list with derived stock quantities and valuation. */
export async function getStockLevels(): Promise<StockRow[]> {
  const rows = await db
    .select({
      id: products.id,
      code: products.code,
      name: products.name,
      barcode: products.barcode,
      unitId: products.unitId,
      taxRate: products.taxRate,
      category: categories.name,
      brand: brands.name,
      unit: units.symbol,
      purchasePrice: products.purchasePrice,
      sellingPrice: products.sellingPrice,
      reorderLevel: products.reorderLevel,
      minStockLevel: products.minStockLevel,
      isActive: products.isActive,
      stock: sql<string>`coalesce((
        select sum(it.quantity) from inventory_transactions it where it.product_id = ${products.id}
      ), 0)`,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(brands, eq(products.brandId, brands.id))
    .leftJoin(units, eq(products.unitId, units.id))
    .orderBy(products.name);

  return rows.map((r) => {
    const stock = num(r.stock);
    return { ...r, stock, stockValue: stock * num(r.purchasePrice) };
  });
}

export function stockStatus(stock: number, reorder: unknown, min: unknown) {
  const reorderLevel = num(reorder);
  const minLevel = num(min);
  if (stock <= 0) return { label: "Out of Stock", tone: "red" as const };
  if (minLevel > 0 && stock <= minLevel) return { label: "Critical", tone: "red" as const };
  if (reorderLevel > 0 && stock <= reorderLevel) return { label: "Low Stock", tone: "amber" as const };
  return { label: "In Stock", tone: "green" as const };
}

/** Stock grouped by warehouse location. */
export async function getStockByLocation() {
  const rows = await db
    .select({
      productId: products.id,
      product: products.name,
      code: products.code,
      warehouse: warehouses.name,
      bin: bins.name,
      rack: racks.name,
      zone: warehouseZones.name,
      unit: units.symbol,
      quantity: sql<string>`sum(${inventoryTransactions.quantity})`,
    })
    .from(inventoryTransactions)
    .innerJoin(products, eq(inventoryTransactions.productId, products.id))
    .leftJoin(warehouses, eq(inventoryTransactions.warehouseId, warehouses.id))
    .leftJoin(bins, eq(inventoryTransactions.binId, bins.id))
    .leftJoin(racks, eq(bins.rackId, racks.id))
    .leftJoin(warehouseZones, eq(racks.zoneId, warehouseZones.id))
    .leftJoin(units, eq(products.unitId, units.id))
    .groupBy(
      products.id,
      products.name,
      products.code,
      warehouses.name,
      bins.name,
      racks.name,
      warehouseZones.name,
      units.symbol
    )
    .orderBy(products.name);

  return rows.map((r) => ({ ...r, quantity: num(r.quantity) }));
}

export async function getMovements(limit = 300) {
  const rows = await db
    .select({
      id: inventoryTransactions.id,
      createdAt: inventoryTransactions.createdAt,
      product: products.name,
      code: products.code,
      type: inventoryTransactions.transactionType,
      quantity: inventoryTransactions.quantity,
      previousStock: inventoryTransactions.previousStock,
      newStock: inventoryTransactions.newStock,
      reference: inventoryTransactions.referenceDocument,
      warehouse: warehouses.name,
      unit: units.symbol,
      notes: inventoryTransactions.notes,
    })
    .from(inventoryTransactions)
    .leftJoin(products, eq(inventoryTransactions.productId, products.id))
    .leftJoin(warehouses, eq(inventoryTransactions.warehouseId, warehouses.id))
    .leftJoin(units, eq(inventoryTransactions.unitId, units.id))
    .orderBy(desc(inventoryTransactions.id))
    .limit(limit);
  return rows;
}

/** Adjust stock to an exact new quantity, recording reason + audit trail. */
export async function adjustStock(input: {
  productId: number;
  warehouseId: number | null;
  binId: number | null;
  newQuantity: number;
  reason: string;
  notes?: string;
}) {
  return db.transaction(async (tx) => {
    const current = await getProductStock(input.productId, null, tx);
    const delta = input.newQuantity - current;

    if (delta === 0) {
      throw new Error("The new quantity is the same as the current quantity. Nothing to adjust.");
    }

    const [product] = await tx.select().from(products).where(eq(products.id, input.productId)).limit(1);
    if (!product) throw new Error("Product not found.");

    await postInventoryTransaction(tx, {
      productId: input.productId,
      warehouseId: input.warehouseId,
      binId: input.binId,
      quantity: delta,
      unitId: product.unitId,
      transactionType: "ADJUSTMENT",
      referenceDocument: `ADJ-${Date.now().toString().slice(-8)}`,
      notes: `${input.reason}${input.notes ? ` - ${input.notes}` : ""}`,
    });

    await tx.insert(stockAdjustments).values({
      productId: input.productId,
      warehouseId: input.warehouseId,
      binId: input.binId,
      currentQuantity: current.toFixed(4),
      newQuantity: input.newQuantity.toFixed(4),
      adjustmentQuantity: delta.toFixed(4),
      reason: `${input.reason}${input.notes ? ` - ${input.notes}` : ""}`,
    });

    await tx.insert(auditLogs).values({
      action: "STOCK_ADJUSTMENT",
      tableName: "products",
      recordId: input.productId,
      previousValue: `Stock: ${current}`,
      newValue: `Stock: ${input.newQuantity} (${input.reason})`,
    });

    return { previous: current, next: input.newQuantity, delta };
  });
}

export type ProductOption = {
  id: number;
  code: string;
  name: string;
  barcode: string | null;
  brand: string | null;
  unitId: number | null;
  unit: string | null;
  purchasePrice: number;
  sellingPrice: number;
  taxRate: number;
  stock: number;
};

/** Lightweight product list for pickers in purchase/sales screens. */
export async function getProductOptions(includeInactive = false): Promise<ProductOption[]> {
  const levels = await getStockLevels();
  return levels
    .filter((l) => includeInactive || l.isActive !== false)
    .map((l) => ({
      id: l.id,
      code: l.code,
      name: l.name,
      barcode: l.barcode,
      brand: l.brand,
      unitId: l.unitId,
      unit: l.unit,
      purchasePrice: num(l.purchasePrice),
      sellingPrice: num(l.sellingPrice),
      taxRate: num(l.taxRate),
      stock: l.stock,
    }));
}

/** Bins with their parent warehouse so forms can filter shelves by warehouse. */
export async function getBinOptions() {
  return db
    .select({
      id: bins.id,
      name: bins.name,
      rack: racks.name,
      warehouseId: warehouseZones.warehouseId,
    })
    .from(bins)
    .leftJoin(racks, eq(bins.rackId, racks.id))
    .leftJoin(warehouseZones, eq(racks.zoneId, warehouseZones.id))
    .orderBy(bins.name);
}

export async function getInventorySummary() {
  const levels = await getStockLevels();
  const totalProducts = levels.length;
  const totalQuantity = levels.reduce((s, r) => s + r.stock, 0);
  const totalValue = levels.reduce((s, r) => s + r.stockValue, 0);
  const lowStock = levels.filter((r) => r.stock > 0 && num(r.reorderLevel) > 0 && r.stock <= num(r.reorderLevel));
  const outOfStock = levels.filter((r) => r.stock <= 0);
  return { totalProducts, totalQuantity, totalValue, lowStock, outOfStock, levels };
}
