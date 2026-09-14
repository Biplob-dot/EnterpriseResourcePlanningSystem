import { db } from "@/db";
import {
  suppliers,
  supplierTransactions,
  purchaseOrders,
  purchaseOrderItems,
  goodsReceipts,
  goodsReceiptItems,
  purchaseReturns,
  purchaseReturnItems,
  payments,
  products,
  units,
  warehouses,
  bins,
  auditLogs,
  batches,
} from "@/db/schema";
import { and, asc, desc, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";
import { getProductStock, postInventoryTransaction } from "./inventory";
import { ACC, accountCodeForMethod, nextDocNumber, postJournal, recordBankMovement, type Db } from "./accounting";
import { calcLine, calcTotals, round2 } from "@/lib/calc";
import { num } from "@/lib/format";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type LineInput = {
  productId: number;
  quantity: number;
  unitId: number | null;
  unitPrice: number;
  discount: number;
  taxRate: number;
};

export type PoInput = {
  supplierId: number;
  date: Date;
  expectedDeliveryDate: Date | null;
  notes: string | null;
  status: "DRAFT" | "ORDERED";
  items: LineInput[];
};

export type GrnLineInput = {
  productId: number;
  poItemId: number | null;
  quantityReceived: number;
  quantityDamaged: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  warehouseId: number | null;
  binId: number | null;
  batchNumber: string | null;
};

export type GrnInput = {
  supplierId: number;
  poId: number | null;
  date: Date;
  notes: string | null;
  updateCost: boolean;
  items: GrnLineInput[];
};

export type ReturnLineInput = { productId: number; quantity: number; unitPrice: number; taxRate: number };

export type PurchaseReturnInput = {
  supplierId: number;
  grnId: number | null;
  date: Date;
  reason: string;
  notes: string | null;
  items: ReturnLineInput[];
};

export type SupplierPaymentInput = {
  supplierId: number;
  date: Date;
  amount: number;
  method: string;
  reference: string | null;
  notes: string | null;
  isAdvance: boolean;
};

/* ------------------------------------------------------------------ */
/* Supplier ledger                                                     */
/* ------------------------------------------------------------------ */

/** credit = we owe more (purchase), debit = we owe less (payment / return). */
export async function postSupplierLedger(
  tx: Db,
  input: {
    supplierId: number;
    date: Date;
    type: "OPENING" | "PURCHASE" | "PAYMENT" | "RETURN" | "ADJUSTMENT";
    reference: string;
    referenceId?: number | null;
    debit?: number;
    credit?: number;
    notes?: string | null;
  }
) {
  const [s] = await tx
    .select({ balance: suppliers.outstandingBalance })
    .from(suppliers)
    .where(eq(suppliers.id, input.supplierId))
    .limit(1);
  if (!s) throw new Error("Supplier not found.");

  const debit = round2(input.debit ?? 0);
  const credit = round2(input.credit ?? 0);
  const newBalance = round2(num(s.balance) + credit - debit);

  await tx.update(suppliers).set({ outstandingBalance: newBalance.toFixed(2) }).where(eq(suppliers.id, input.supplierId));
  await tx.insert(supplierTransactions).values({
    supplierId: input.supplierId,
    date: input.date,
    type: input.type,
    reference: input.reference,
    referenceId: input.referenceId ?? null,
    debit: debit.toFixed(2),
    credit: credit.toFixed(2),
    balanceAfter: newBalance.toFixed(2),
    notes: input.notes ?? null,
  });
  return newBalance;
}

/* ------------------------------------------------------------------ */
/* Suppliers                                                           */
/* ------------------------------------------------------------------ */

export async function getSuppliers() {
  return db
    .select({
      id: suppliers.id,
      name: suppliers.name,
      companyName: suppliers.companyName,
      phone: suppliers.phone,
      email: suppliers.email,
      creditPeriod: suppliers.creditPeriod,
      outstandingBalance: suppliers.outstandingBalance,
      isActive: suppliers.isActive,
      totalPurchased: sql<string>`coalesce((select sum(g.total_amount) from goods_receipts g where g.supplier_id = ${suppliers.id}), 0)`,
      grnCount: sql<string>`(select count(*) from goods_receipts g where g.supplier_id = ${suppliers.id})`,
    })
    .from(suppliers)
    .orderBy(suppliers.name);
}

export async function getSupplierOptions() {
  return db
    .select({ id: suppliers.id, name: suppliers.name, companyName: suppliers.companyName, outstandingBalance: suppliers.outstandingBalance })
    .from(suppliers)
    .where(eq(suppliers.isActive, true))
    .orderBy(suppliers.name);
}

export async function getSupplierDetail(id: number) {
  const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
  if (!supplier) return null;

  const [pos, grns, returns, pays, ledger, agg] = await Promise.all([
    db.select().from(purchaseOrders).where(eq(purchaseOrders.supplierId, id)).orderBy(desc(purchaseOrders.id)),
    db.select().from(goodsReceipts).where(eq(goodsReceipts.supplierId, id)).orderBy(desc(goodsReceipts.id)),
    db.select().from(purchaseReturns).where(eq(purchaseReturns.supplierId, id)).orderBy(desc(purchaseReturns.id)),
    db.select().from(payments).where(eq(payments.supplierId, id)).orderBy(desc(payments.id)),
    db
      .select()
      .from(supplierTransactions)
      .where(eq(supplierTransactions.supplierId, id))
      .orderBy(desc(supplierTransactions.date), desc(supplierTransactions.id))
      .limit(50),
    db
      .select({
        purchased: sql<string>`coalesce((select sum(total_amount) from goods_receipts where supplier_id = ${id}), 0)`,
        paid: sql<string>`coalesce((select sum(amount) from payments where supplier_id = ${id} and status = 'COMPLETED'), 0)`,
        returned: sql<string>`coalesce((select sum(total_amount) from purchase_returns where supplier_id = ${id}), 0)`,
      })
      .from(suppliers)
      .where(eq(suppliers.id, id)),
  ]);

  return { supplier, pos, grns, returns, payments: pays, ledger, agg: agg[0] };
}

export async function getSupplierStatement(id: number, from: Date | null, to: Date | null) {
  const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
  if (!supplier) return null;

  let opening = 0;
  if (from) {
    const [o] = await db
      .select({
        credit: sql<string>`coalesce(sum(${supplierTransactions.credit}), 0)`,
        debit: sql<string>`coalesce(sum(${supplierTransactions.debit}), 0)`,
      })
      .from(supplierTransactions)
      .where(and(eq(supplierTransactions.supplierId, id), lt(supplierTransactions.date, from)));
    opening = round2(num(o?.credit) - num(o?.debit));
  }

  const conditions = [eq(supplierTransactions.supplierId, id)];
  if (from) conditions.push(gte(supplierTransactions.date, from));
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    conditions.push(lte(supplierTransactions.date, end));
  }

  const rows = await db
    .select()
    .from(supplierTransactions)
    .where(and(...conditions))
    .orderBy(asc(supplierTransactions.date), asc(supplierTransactions.id));

  return { supplier, opening, rows };
}

/* ------------------------------------------------------------------ */
/* Purchase orders                                                     */
/* ------------------------------------------------------------------ */

function validateLines(items: { quantity: number; unitPrice: number; discount?: number; taxRate?: number }[]) {
  if (!items.length) throw new Error("Add at least one product.");
  for (const i of items) {
    if (!(i.quantity > 0)) throw new Error("Every line needs a quantity greater than zero.");
    if (i.unitPrice < 0) throw new Error("Unit price cannot be negative.");
    if ((i.discount ?? 0) < 0) throw new Error("Discount cannot be negative.");
    if ((i.taxRate ?? 0) < 0) throw new Error("Tax rate cannot be negative.");
  }
}

export async function getPurchaseOrders() {
  return db
    .select({
      id: purchaseOrders.id,
      poNumber: purchaseOrders.poNumber,
      date: purchaseOrders.date,
      expectedDeliveryDate: purchaseOrders.expectedDeliveryDate,
      status: purchaseOrders.status,
      totalAmount: purchaseOrders.totalAmount,
      supplier: suppliers.name,
      supplierId: suppliers.id,
      itemCount: sql<string>`(select count(*) from purchase_order_items i where i.po_id = ${purchaseOrders.id})`,
    })
    .from(purchaseOrders)
    .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .orderBy(desc(purchaseOrders.id));
}

export async function getPurchaseOrder(id: number) {
  const [po] = await db
    .select({ po: purchaseOrders, supplier: suppliers })
    .from(purchaseOrders)
    .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .where(eq(purchaseOrders.id, id))
    .limit(1);
  if (!po) return null;

  const items = await db
    .select({
      id: purchaseOrderItems.id,
      productId: purchaseOrderItems.productId,
      code: products.code,
      name: products.name,
      quantity: purchaseOrderItems.quantity,
      receivedQuantity: purchaseOrderItems.receivedQuantity,
      unitId: purchaseOrderItems.unitId,
      unit: units.symbol,
      unitPrice: purchaseOrderItems.unitPrice,
      discount: purchaseOrderItems.discount,
      taxRate: purchaseOrderItems.taxRate,
      total: purchaseOrderItems.total,
    })
    .from(purchaseOrderItems)
    .leftJoin(products, eq(purchaseOrderItems.productId, products.id))
    .leftJoin(units, eq(purchaseOrderItems.unitId, units.id))
    .where(eq(purchaseOrderItems.poId, id))
    .orderBy(purchaseOrderItems.id);

  const grns = await db.select().from(goodsReceipts).where(eq(goodsReceipts.poId, id)).orderBy(desc(goodsReceipts.id));

  return { ...po.po, supplier: po.supplier, items, grns };
}

/** Open POs with remaining quantities, used by the goods-receipt screen. */
export async function getOpenPurchaseOrders() {
  const pos = await db
    .select({
      id: purchaseOrders.id,
      poNumber: purchaseOrders.poNumber,
      supplierId: purchaseOrders.supplierId,
      supplierName: suppliers.name,
      date: purchaseOrders.date,
      status: purchaseOrders.status,
    })
    .from(purchaseOrders)
    .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .where(inArray(purchaseOrders.status, ["ORDERED", "PARTIALLY_RECEIVED"]))
    .orderBy(desc(purchaseOrders.id));

  if (pos.length === 0) return [];

  const items = await db
    .select({
      poItemId: purchaseOrderItems.id,
      poId: purchaseOrderItems.poId,
      productId: purchaseOrderItems.productId,
      code: products.code,
      name: products.name,
      unitId: purchaseOrderItems.unitId,
      unit: units.symbol,
      quantity: purchaseOrderItems.quantity,
      receivedQuantity: purchaseOrderItems.receivedQuantity,
      unitPrice: purchaseOrderItems.unitPrice,
      discount: purchaseOrderItems.discount,
      taxRate: purchaseOrderItems.taxRate,
    })
    .from(purchaseOrderItems)
    .leftJoin(products, eq(purchaseOrderItems.productId, products.id))
    .leftJoin(units, eq(purchaseOrderItems.unitId, units.id))
    .where(inArray(purchaseOrderItems.poId, pos.map((p) => p.id)));

  return pos.map((po) => ({
    ...po,
    items: items
      .filter((i) => i.poId === po.id)
      .map((i) => {
        const ordered = num(i.quantity);
        const received = num(i.receivedQuantity);
        return {
          poItemId: i.poItemId,
          productId: i.productId!,
          code: i.code ?? "",
          name: i.name ?? "",
          unitId: i.unitId,
          unit: i.unit,
          ordered,
          received,
          remaining: Math.max(0, round2(ordered - received)),
          unitPrice: num(i.unitPrice),
          discountPerUnit: ordered > 0 ? num(i.discount) / ordered : 0,
          taxRate: num(i.taxRate),
        };
      }),
  }));
}

export async function createPurchaseOrder(input: PoInput) {
  validateLines(input.items);
  return db.transaction(async (tx) => {
    const poNumber = await nextDocNumber(tx, purchaseOrders, purchaseOrders.id, purchaseOrders.poNumber, "PO-");
    const totals = calcTotals(input.items);
    const [po] = await tx
      .insert(purchaseOrders)
      .values({
        poNumber,
        supplierId: input.supplierId,
        date: input.date,
        expectedDeliveryDate: input.expectedDeliveryDate,
        status: input.status,
        subtotal: totals.subtotal.toFixed(2),
        discountAmount: totals.discount.toFixed(2),
        taxAmount: totals.tax.toFixed(2),
        totalAmount: totals.total.toFixed(2),
        notes: input.notes,
      })
      .returning();

    await tx.insert(purchaseOrderItems).values(
      input.items.map((i) => ({
        poId: po.id,
        productId: i.productId,
        quantity: i.quantity.toFixed(4),
        unitId: i.unitId,
        unitPrice: i.unitPrice.toFixed(2),
        discount: i.discount.toFixed(2),
        taxRate: i.taxRate.toFixed(2),
        total: calcLine(i).total.toFixed(2),
      }))
    );

    await tx.insert(auditLogs).values({
      action: "PURCHASE_ORDER_CREATED",
      tableName: "purchase_orders",
      recordId: po.id,
      newValue: `${poNumber} • ${input.items.length} lines • total ${totals.total.toFixed(2)} • ${input.status}`,
    });
    return po;
  });
}

export async function updatePurchaseOrder(id: number, input: PoInput) {
  validateLines(input.items);
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).limit(1);
    if (!existing) throw new Error("Purchase order not found.");
    if (existing.status !== "DRAFT") throw new Error("Only draft purchase orders can be edited.");

    const totals = calcTotals(input.items);
    await tx
      .update(purchaseOrders)
      .set({
        supplierId: input.supplierId,
        date: input.date,
        expectedDeliveryDate: input.expectedDeliveryDate,
        status: input.status,
        subtotal: totals.subtotal.toFixed(2),
        discountAmount: totals.discount.toFixed(2),
        taxAmount: totals.tax.toFixed(2),
        totalAmount: totals.total.toFixed(2),
        notes: input.notes,
      })
      .where(eq(purchaseOrders.id, id));

    await tx.delete(purchaseOrderItems).where(eq(purchaseOrderItems.poId, id));
    await tx.insert(purchaseOrderItems).values(
      input.items.map((i) => ({
        poId: id,
        productId: i.productId,
        quantity: i.quantity.toFixed(4),
        unitId: i.unitId,
        unitPrice: i.unitPrice.toFixed(2),
        discount: i.discount.toFixed(2),
        taxRate: i.taxRate.toFixed(2),
        total: calcLine(i).total.toFixed(2),
      }))
    );

    await tx.insert(auditLogs).values({
      action: "PURCHASE_ORDER_CHANGED",
      tableName: "purchase_orders",
      recordId: id,
      previousValue: `total ${existing.totalAmount} • ${existing.status}`,
      newValue: `total ${totals.total.toFixed(2)} • ${input.status}`,
    });
    return existing;
  });
}

export async function setPurchaseOrderStatus(id: number, status: "ORDERED" | "CANCELLED" | "RECEIVED") {
  return db.transaction(async (tx) => {
    const [po] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).limit(1);
    if (!po) throw new Error("Purchase order not found.");
    const current = po.status ?? "DRAFT";

    if (status === "ORDERED" && current !== "DRAFT") throw new Error("Only a draft order can be marked as ordered.");
    if (status === "CANCELLED") {
      if (current === "PARTIALLY_RECEIVED") throw new Error("Goods have already been received against this order. Mark it as complete instead.");
      if (current === "RECEIVED" || current === "CANCELLED") throw new Error("This order is already closed.");
    }
    if (status === "RECEIVED" && !(current === "ORDERED" || current === "PARTIALLY_RECEIVED")) {
      throw new Error("Only open orders can be marked as complete.");
    }

    await tx.update(purchaseOrders).set({ status }).where(eq(purchaseOrders.id, id));
    await tx.insert(auditLogs).values({
      action: "PURCHASE_ORDER_STATUS",
      tableName: "purchase_orders",
      recordId: id,
      previousValue: current,
      newValue: status,
    });
  });
}

/* ------------------------------------------------------------------ */
/* Goods receipts                                                      */
/* ------------------------------------------------------------------ */

export async function getGoodsReceipts() {
  return db
    .select({
      id: goodsReceipts.id,
      grnNumber: goodsReceipts.grnNumber,
      date: goodsReceipts.date,
      totalAmount: goodsReceipts.totalAmount,
      supplier: suppliers.name,
      supplierId: suppliers.id,
      poNumber: purchaseOrders.poNumber,
      poId: purchaseOrders.id,
      itemCount: sql<string>`(select count(*) from goods_receipt_items i where i.grn_id = ${goodsReceipts.id})`,
    })
    .from(goodsReceipts)
    .leftJoin(suppliers, eq(goodsReceipts.supplierId, suppliers.id))
    .leftJoin(purchaseOrders, eq(goodsReceipts.poId, purchaseOrders.id))
    .orderBy(desc(goodsReceipts.id));
}

export async function getGoodsReceipt(id: number) {
  const [row] = await db
    .select({ grn: goodsReceipts, supplier: suppliers, poNumber: purchaseOrders.poNumber })
    .from(goodsReceipts)
    .leftJoin(suppliers, eq(goodsReceipts.supplierId, suppliers.id))
    .leftJoin(purchaseOrders, eq(goodsReceipts.poId, purchaseOrders.id))
    .where(eq(goodsReceipts.id, id))
    .limit(1);
  if (!row) return null;

  const items = await db
    .select({
      id: goodsReceiptItems.id,
      productId: goodsReceiptItems.productId,
      code: products.code,
      name: products.name,
      unit: units.symbol,
      quantityReceived: goodsReceiptItems.quantityReceived,
      quantityDamaged: goodsReceiptItems.quantityDamaged,
      unitPrice: goodsReceiptItems.unitPrice,
      discount: goodsReceiptItems.discount,
      taxRate: goodsReceiptItems.taxRate,
      total: goodsReceiptItems.total,
      warehouse: warehouses.name,
      bin: bins.name,
      batchNumber: goodsReceiptItems.batchNumber,
    })
    .from(goodsReceiptItems)
    .leftJoin(products, eq(goodsReceiptItems.productId, products.id))
    .leftJoin(units, eq(products.unitId, units.id))
    .leftJoin(warehouses, eq(goodsReceiptItems.warehouseId, warehouses.id))
    .leftJoin(bins, eq(goodsReceiptItems.binId, bins.id))
    .where(eq(goodsReceiptItems.grnId, id))
    .orderBy(goodsReceiptItems.id);

  return { ...row.grn, supplier: row.supplier, poNumber: row.poNumber, items };
}

export async function confirmGoodsReceipt(input: GrnInput) {
  if (!input.items.length) throw new Error("Add at least one product to receive.");
  for (const i of input.items) {
    if (!(i.quantityReceived > 0)) throw new Error("Received quantity must be greater than zero on every line.");
    if (i.quantityDamaged < 0) throw new Error("Damaged quantity cannot be negative.");
    if (i.quantityDamaged > i.quantityReceived) throw new Error("Damaged quantity cannot be more than the received quantity.");
    if (i.unitPrice < 0) throw new Error("Unit price cannot be negative.");
  }

  return db.transaction(async (tx) => {
    const [supplier] = await tx.select().from(suppliers).where(eq(suppliers.id, input.supplierId)).limit(1);
    if (!supplier) throw new Error("Please choose a supplier.");

    let po: typeof purchaseOrders.$inferSelect | null = null;
    let poItems: (typeof purchaseOrderItems.$inferSelect)[] = [];
    if (input.poId) {
      const [found] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, input.poId)).limit(1);
      if (!found) throw new Error("Purchase order not found.");
      if (found.supplierId !== input.supplierId) throw new Error("The selected purchase order belongs to a different supplier.");
      if (!(found.status === "ORDERED" || found.status === "PARTIALLY_RECEIVED")) {
        throw new Error(`Purchase order ${found.poNumber} is ${found.status?.toLowerCase()} and cannot receive goods.`);
      }
      po = found;
      poItems = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.poId, found.id));
    }

    const productIds = [...new Set(input.items.map((i) => i.productId))];
    const prodRows = await tx.select().from(products).where(inArray(products.id, productIds));
    const prodById = new Map(prodRows.map((p) => [p.id, p]));

    const lines = input.items.map((i) => {
      const product = prodById.get(i.productId);
      if (!product) throw new Error("One of the products no longer exists.");
      const accepted = round2(i.quantityReceived - i.quantityDamaged);
      if (i.poItemId) {
        const pi = poItems.find((p) => p.id === i.poItemId);
        if (!pi) throw new Error(`Purchase order line for ${product.name} was not found.`);
        const remaining = round2(num(pi.quantity) - num(pi.receivedQuantity));
        if (accepted > remaining + 0.0001) {
          throw new Error(`Cannot receive ${accepted} of ${product.name}: only ${remaining} remaining on the purchase order.`);
        }
      }
      const amounts = calcLine({ quantity: accepted, unitPrice: i.unitPrice, discount: i.discount, taxRate: i.taxRate });
      return { ...i, product, accepted, amounts };
    });

    const totals = calcTotals(lines.map((l) => ({ quantity: l.accepted, unitPrice: l.unitPrice, discount: l.discount, taxRate: l.taxRate })));
    const grnNumber = await nextDocNumber(tx, goodsReceipts, goodsReceipts.id, goodsReceipts.grnNumber, "GRN-");

    const [grn] = await tx
      .insert(goodsReceipts)
      .values({
        grnNumber,
        supplierId: input.supplierId,
        poId: po?.id ?? null,
        date: input.date,
        subtotal: totals.subtotal.toFixed(2),
        discountAmount: totals.discount.toFixed(2),
        taxAmount: totals.tax.toFixed(2),
        totalAmount: totals.total.toFixed(2),
        notes: input.notes,
      })
      .returning();

    for (const l of lines) {
      await tx.insert(goodsReceiptItems).values({
        grnId: grn.id,
        poItemId: l.poItemId,
        productId: l.productId,
        warehouseId: l.warehouseId,
        binId: l.binId,
        quantityReceived: l.quantityReceived.toFixed(4),
        quantityDamaged: l.quantityDamaged.toFixed(4),
        unitPrice: l.unitPrice.toFixed(2),
        discount: l.amounts.discount.toFixed(2),
        taxRate: l.taxRate.toFixed(2),
        total: l.amounts.total.toFixed(2),
        batchNumber: l.batchNumber,
      });

      if (l.accepted > 0) {
        await postInventoryTransaction(tx, {
          productId: l.productId,
          warehouseId: l.warehouseId,
          binId: l.binId,
          quantity: l.accepted,
          unitId: l.product.unitId,
          transactionType: "PURCHASE",
          referenceDocument: grnNumber,
          notes: l.quantityDamaged > 0 ? `${l.quantityDamaged} damaged units rejected at receipt` : `Received from ${supplier.name}`,
        });
      }

      if (l.poItemId) {
        const pi = poItems.find((p) => p.id === l.poItemId)!;
        const newReceived = round2(num(pi.receivedQuantity) + l.accepted);
        pi.receivedQuantity = newReceived.toFixed(4);
        await tx.update(purchaseOrderItems).set({ receivedQuantity: newReceived.toFixed(4) }).where(eq(purchaseOrderItems.id, pi.id));
      }

      if (l.batchNumber && l.accepted > 0) {
        await tx.insert(batches).values({
          productId: l.productId,
          batchNumber: l.batchNumber,
          supplierId: input.supplierId,
          purchaseDate: input.date,
          quantityReceived: l.accepted.toFixed(4),
          remainingQuantity: l.accepted.toFixed(4),
          cost: l.unitPrice.toFixed(2),
          reference: grnNumber,
        });
      }

      if (input.updateCost && round2(num(l.product.purchasePrice)) !== round2(l.unitPrice)) {
        await tx.update(products).set({ purchasePrice: l.unitPrice.toFixed(2), updatedAt: new Date() }).where(eq(products.id, l.productId));
        await tx.insert(auditLogs).values({
          action: "PRICE_CHANGE",
          tableName: "products",
          recordId: l.productId,
          previousValue: `Purchase price: ${l.product.purchasePrice}`,
          newValue: `Purchase price: ${l.unitPrice.toFixed(2)} (from ${grnNumber})`,
        });
      }
    }

    if (po) {
      const allDone = poItems.every((p) => num(p.receivedQuantity) + 0.0001 >= num(p.quantity));
      const anyDone = poItems.some((p) => num(p.receivedQuantity) > 0);
      const newStatus = allDone ? "RECEIVED" : anyDone ? "PARTIALLY_RECEIVED" : "ORDERED";
      if (newStatus !== po.status) {
        await tx.update(purchaseOrders).set({ status: newStatus }).where(eq(purchaseOrders.id, po.id));
      }
    }

    if (totals.total > 0) {
      await postSupplierLedger(tx, {
        supplierId: input.supplierId,
        date: input.date,
        type: "PURCHASE",
        reference: grnNumber,
        referenceId: grn.id,
        credit: totals.total,
        notes: po ? `Goods received against ${po.poNumber}` : "Direct purchase",
      });

      await postJournal(tx, {
        date: input.date,
        reference: grnNumber,
        description: `Goods received from ${supplier.name}`,
        lines: [
          { account: ACC.INVENTORY, debit: round2(totals.subtotal - totals.discount) },
          { account: ACC.VAT, debit: totals.tax },
          { account: ACC.AP, credit: totals.total },
        ],
      });
    }

    await tx.insert(auditLogs).values({
      action: "GOODS_RECEIVED",
      tableName: "goods_receipts",
      recordId: grn.id,
      newValue: `${grnNumber} • ${lines.length} lines • total ${totals.total.toFixed(2)}`,
    });

    return grn;
  });
}

/* ------------------------------------------------------------------ */
/* Purchase returns                                                    */
/* ------------------------------------------------------------------ */

export async function getPurchaseReturns() {
  return db
    .select({
      id: purchaseReturns.id,
      returnNumber: purchaseReturns.returnNumber,
      date: purchaseReturns.date,
      totalAmount: purchaseReturns.totalAmount,
      reason: purchaseReturns.reason,
      supplier: suppliers.name,
      supplierId: suppliers.id,
      grnNumber: goodsReceipts.grnNumber,
      grnId: goodsReceipts.id,
    })
    .from(purchaseReturns)
    .leftJoin(suppliers, eq(purchaseReturns.supplierId, suppliers.id))
    .leftJoin(goodsReceipts, eq(purchaseReturns.originalPurchaseId, goodsReceipts.id))
    .orderBy(desc(purchaseReturns.id));
}

export async function getPurchaseReturn(id: number) {
  const [row] = await db
    .select({ ret: purchaseReturns, supplier: suppliers, grnNumber: goodsReceipts.grnNumber })
    .from(purchaseReturns)
    .leftJoin(suppliers, eq(purchaseReturns.supplierId, suppliers.id))
    .leftJoin(goodsReceipts, eq(purchaseReturns.originalPurchaseId, goodsReceipts.id))
    .where(eq(purchaseReturns.id, id))
    .limit(1);
  if (!row) return null;

  const items = await db
    .select({
      id: purchaseReturnItems.id,
      code: products.code,
      name: products.name,
      unit: units.symbol,
      quantity: purchaseReturnItems.quantity,
      unitPrice: purchaseReturnItems.unitPrice,
      taxRate: purchaseReturnItems.taxRate,
      total: purchaseReturnItems.total,
    })
    .from(purchaseReturnItems)
    .leftJoin(products, eq(purchaseReturnItems.productId, products.id))
    .leftJoin(units, eq(products.unitId, units.id))
    .where(eq(purchaseReturnItems.returnId, id))
    .orderBy(purchaseReturnItems.id);

  return { ...row.ret, supplier: row.supplier, grnNumber: row.grnNumber, items };
}

/** GRNs with per-product accepted and already-returned quantities (for the return screen). */
export async function getReceiptsForReturn() {
  const grns = await db
    .select({
      id: goodsReceipts.id,
      grnNumber: goodsReceipts.grnNumber,
      supplierId: goodsReceipts.supplierId,
      date: goodsReceipts.date,
    })
    .from(goodsReceipts)
    .orderBy(desc(goodsReceipts.id))
    .limit(200);
  if (grns.length === 0) return [];

  const grnIds = grns.map((g) => g.id);
  const items = await db
    .select({
      grnId: goodsReceiptItems.grnId,
      productId: goodsReceiptItems.productId,
      code: products.code,
      name: products.name,
      unit: units.symbol,
      accepted: sql<string>`sum(${goodsReceiptItems.quantityReceived} - coalesce(${goodsReceiptItems.quantityDamaged}, 0))`,
      unitPrice: sql<string>`max(${goodsReceiptItems.unitPrice})`,
      taxRate: sql<string>`max(${goodsReceiptItems.taxRate})`,
    })
    .from(goodsReceiptItems)
    .leftJoin(products, eq(goodsReceiptItems.productId, products.id))
    .leftJoin(units, eq(products.unitId, units.id))
    .where(inArray(goodsReceiptItems.grnId, grnIds))
    .groupBy(goodsReceiptItems.grnId, goodsReceiptItems.productId, products.code, products.name, units.symbol);

  const returned = await db
    .select({
      grnId: purchaseReturns.originalPurchaseId,
      productId: purchaseReturnItems.productId,
      qty: sql<string>`sum(${purchaseReturnItems.quantity})`,
    })
    .from(purchaseReturnItems)
    .innerJoin(purchaseReturns, eq(purchaseReturnItems.returnId, purchaseReturns.id))
    .where(inArray(purchaseReturns.originalPurchaseId, grnIds))
    .groupBy(purchaseReturns.originalPurchaseId, purchaseReturnItems.productId);

  return grns.map((g) => ({
    ...g,
    items: items
      .filter((i) => i.grnId === g.id)
      .map((i) => {
        const r = returned.find((x) => x.grnId === g.id && x.productId === i.productId);
        return {
          productId: i.productId!,
          code: i.code ?? "",
          name: i.name ?? "",
          unit: i.unit,
          accepted: num(i.accepted),
          returned: num(r?.qty),
          unitPrice: num(i.unitPrice),
          taxRate: num(i.taxRate),
        };
      }),
  }));
}

export async function createPurchaseReturn(input: PurchaseReturnInput) {
  const items = input.items.filter((i) => i.quantity > 0);
  if (!items.length) throw new Error("Enter a return quantity for at least one product.");
  for (const i of items) {
    if (i.unitPrice < 0) throw new Error("Unit price cannot be negative.");
  }
  if (!input.reason) throw new Error("Please choose a reason for the return.");

  return db.transaction(async (tx) => {
    const [supplier] = await tx.select().from(suppliers).where(eq(suppliers.id, input.supplierId)).limit(1);
    if (!supplier) throw new Error("Please choose a supplier.");

    if (input.grnId) {
      const [grn] = await tx.select().from(goodsReceipts).where(eq(goodsReceipts.id, input.grnId)).limit(1);
      if (!grn) throw new Error("Goods receipt not found.");
      if (grn.supplierId !== input.supplierId) throw new Error("The selected goods receipt belongs to a different supplier.");

      const receipts = await getReceiptsForReturn();
      const grnInfo = receipts.find((g) => g.id === input.grnId);
      for (const i of items) {
        const line = grnInfo?.items.find((x) => x.productId === i.productId);
        if (line) {
          const returnable = round2(line.accepted - line.returned);
          if (i.quantity > returnable + 0.0001) {
            throw new Error(`Cannot return ${i.quantity} of ${line.name}: only ${returnable} can still be returned from this receipt.`);
          }
        }
      }
    }

    const productIds = [...new Set(items.map((i) => i.productId))];
    const prodRows = await tx.select().from(products).where(inArray(products.id, productIds));
    const prodById = new Map(prodRows.map((p) => [p.id, p]));

    for (const i of items) {
      const product = prodById.get(i.productId);
      if (!product) throw new Error("One of the products no longer exists.");
      const stock = await getProductStock(i.productId, null, tx);
      if (stock + 0.0001 < i.quantity) {
        throw new Error(`Cannot return ${i.quantity} of ${product.name}: only ${stock} in stock.`);
      }
    }

    const totals = calcTotals(items.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice, discount: 0, taxRate: i.taxRate })));
    const returnNumber = await nextDocNumber(tx, purchaseReturns, purchaseReturns.id, purchaseReturns.returnNumber, "PRET-");
    const reasonText = input.notes ? `${input.reason} - ${input.notes}` : input.reason;

    const [ret] = await tx
      .insert(purchaseReturns)
      .values({
        returnNumber,
        supplierId: input.supplierId,
        originalPurchaseId: input.grnId,
        date: input.date,
        subtotal: totals.subtotal.toFixed(2),
        taxAmount: totals.tax.toFixed(2),
        totalAmount: totals.total.toFixed(2),
        reason: reasonText,
      })
      .returning();

    for (const i of items) {
      const product = prodById.get(i.productId)!;
      const amounts = calcLine({ quantity: i.quantity, unitPrice: i.unitPrice, discount: 0, taxRate: i.taxRate });
      await tx.insert(purchaseReturnItems).values({
        returnId: ret.id,
        productId: i.productId,
        quantity: i.quantity.toFixed(4),
        unitPrice: i.unitPrice.toFixed(2),
        taxRate: i.taxRate.toFixed(2),
        total: amounts.total.toFixed(2),
      });
      await postInventoryTransaction(tx, {
        productId: i.productId,
        quantity: -i.quantity,
        unitId: product.unitId,
        transactionType: "RETURN_PURCHASE",
        referenceDocument: returnNumber,
        notes: `Returned to ${supplier.name}: ${input.reason}`,
      });
    }

    await postSupplierLedger(tx, {
      supplierId: input.supplierId,
      date: input.date,
      type: "RETURN",
      reference: returnNumber,
      referenceId: ret.id,
      debit: totals.total,
      notes: reasonText,
    });

    await postJournal(tx, {
      date: input.date,
      reference: returnNumber,
      description: `Purchase return to ${supplier.name}`,
      lines: [
        { account: ACC.AP, debit: totals.total },
        { account: ACC.INVENTORY, credit: totals.subtotal },
        { account: ACC.VAT, credit: totals.tax },
      ],
    });

    await tx.insert(auditLogs).values({
      action: "PURCHASE_RETURN",
      tableName: "purchase_returns",
      recordId: ret.id,
      newValue: `${returnNumber} • ${items.length} lines • total ${totals.total.toFixed(2)}`,
    });

    return ret;
  });
}

/* ------------------------------------------------------------------ */
/* Supplier payments                                                   */
/* ------------------------------------------------------------------ */

export async function getSupplierPayments() {
  return db
    .select({
      id: payments.id,
      paymentNumber: payments.paymentNumber,
      date: payments.date,
      amount: payments.amount,
      paymentMethod: payments.paymentMethod,
      reference: payments.reference,
      status: payments.status,
      notes: payments.notes,
      supplier: suppliers.name,
      supplierId: suppliers.id,
    })
    .from(payments)
    .innerJoin(suppliers, eq(payments.supplierId, suppliers.id))
    .orderBy(desc(payments.id));
}

export async function recordSupplierPayment(input: SupplierPaymentInput) {
  if (!(input.amount > 0)) throw new Error("Payment amount must be greater than zero.");
  return db.transaction(async (tx) => {
    const [supplier] = await tx.select().from(suppliers).where(eq(suppliers.id, input.supplierId)).limit(1);
    if (!supplier) throw new Error("Please choose a supplier.");

    const outstanding = num(supplier.outstandingBalance);
    if (!input.isAdvance && input.amount > outstanding + 0.005) {
      throw new Error(
        `The payment (${input.amount.toFixed(2)}) is more than the outstanding balance (${outstanding.toFixed(2)}). Tick "Advance payment" if you are paying ahead.`
      );
    }

    const paymentNumber = await nextDocNumber(tx, payments, payments.id, payments.paymentNumber, "SPAY-");
    const bankAccountId = await recordBankMovement(tx, {
      method: input.method,
      amount: input.amount,
      direction: "OUT",
      date: input.date,
      type: "PAYMENT_OUT",
      reference: paymentNumber,
      description: `Payment to ${supplier.name}`,
    });

    const [payment] = await tx
      .insert(payments)
      .values({
        paymentNumber,
        supplierId: input.supplierId,
        bankAccountId,
        date: input.date,
        amount: input.amount.toFixed(2),
        paymentMethod: input.method,
        reference: input.reference,
        notes: input.notes,
      })
      .returning();

    await postSupplierLedger(tx, {
      supplierId: input.supplierId,
      date: input.date,
      type: "PAYMENT",
      reference: paymentNumber,
      referenceId: payment.id,
      debit: input.amount,
      notes: `${input.method}${input.reference ? ` • ${input.reference}` : ""}${input.isAdvance ? " • advance" : ""}`,
    });

    await postJournal(tx, {
      date: input.date,
      reference: paymentNumber,
      description: `Payment to ${supplier.name} (${input.method})`,
      lines: [
        { account: ACC.AP, debit: input.amount },
        { account: accountCodeForMethod(input.method), credit: input.amount },
      ],
    });

    await tx.insert(auditLogs).values({
      action: "SUPPLIER_PAYMENT",
      tableName: "payments",
      recordId: payment.id,
      newValue: `${paymentNumber} • ${supplier.name} • ${input.amount.toFixed(2)} via ${input.method}`,
    });

    return payment;
  });
}
