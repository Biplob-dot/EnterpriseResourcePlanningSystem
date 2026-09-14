import { db } from "@/db";
import {
  products,
  categories,
  units,
  inventoryTransactions,
  invoices,
  invoiceItems,
  salesReturns,
  salesReturnItems,
  customers,
  goodsReceipts,
  goodsReceiptItems,
  purchaseReturns,
  purchaseReturnItems,
  suppliers,
  payments,
  expenses,
  income,
} from "@/db/schema";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { getStockLevels } from "./inventory";
import { num } from "@/lib/format";
import { round2 } from "@/lib/calc";

export type ReportRange = { from: Date; to: Date };

export function reportRange(from: Date | null, to: Date | null): ReportRange {
  const start = from ?? new Date(new Date().getFullYear(), 0, 1, 0, 0, 0, 0);
  const end = to ?? new Date();
  end.setHours(23, 59, 59, 999);
  return { from: start, to: end };
}

export async function getInventoryReportData(from: Date | null, to: Date | null, deadDays = 90) {
  const range = reportRange(from, to);
  const levels = await getStockLevels();

  const movement = await db
    .select({
      id: inventoryTransactions.id,
      date: inventoryTransactions.createdAt,
      productId: products.id,
      code: products.code,
      product: products.name,
      category: categories.name,
      type: inventoryTransactions.transactionType,
      reference: inventoryTransactions.referenceDocument,
      quantity: inventoryTransactions.quantity,
      balance: inventoryTransactions.newStock,
      unit: units.symbol,
    })
    .from(inventoryTransactions)
    .innerJoin(products, eq(inventoryTransactions.productId, products.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(units, eq(inventoryTransactions.unitId, units.id))
    .where(and(gte(inventoryTransactions.createdAt, range.from), lte(inventoryTransactions.createdAt, range.to)))
    .orderBy(desc(inventoryTransactions.createdAt), desc(inventoryTransactions.id));

  const salesByProduct = await db
    .select({
      productId: products.id,
      code: products.code,
      product: products.name,
      category: categories.name,
      unit: units.symbol,
      quantity: sql<string>`coalesce(sum(${invoiceItems.quantity}), 0)`,
      value: sql<string>`coalesce(sum(${invoiceItems.total}), 0)`,
      lastSale: sql<Date | null>`max(${invoices.date})`,
    })
    .from(invoiceItems)
    .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
    .innerJoin(products, eq(invoiceItems.productId, products.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(units, eq(products.unitId, units.id))
    .where(and(eq(invoices.isCancelled, false), gte(invoices.date, range.from), lte(invoices.date, range.to)))
    .groupBy(products.id, products.code, products.name, categories.name, units.symbol)
    .orderBy(desc(sql`sum(${invoiceItems.quantity})`));

  const lastMovementRows = await db
    .select({
      productId: products.id,
      lastMovement: sql<Date | null>`max(${inventoryTransactions.createdAt})`,
    })
    .from(products)
    .leftJoin(inventoryTransactions, eq(inventoryTransactions.productId, products.id))
    .groupBy(products.id);

  const salesMap = new Map(salesByProduct.map((r) => [r.productId, r]));
  const lastMap = new Map(lastMovementRows.map((r) => [r.productId, r.lastMovement]));
  const cutoff = new Date(range.to.getTime() - deadDays * 86400000);

  const ranked = levels.map((l) => {
    const sales = salesMap.get(l.id);
    const lastMovement = lastMap.get(l.id) ?? null;
    return {
      ...l,
      soldQuantity: num(sales?.quantity),
      soldValue: num(sales?.value),
      lastSale: sales?.lastSale ?? null,
      lastMovement,
      daysSinceMovement: lastMovement
        ? Math.max(0, Math.floor((range.to.getTime() - new Date(lastMovement).getTime()) / 86400000))
        : null,
    };
  });

  return {
    range,
    levels,
    movement,
    fastMoving: [...ranked].filter((r) => r.soldQuantity > 0).sort((a, b) => b.soldQuantity - a.soldQuantity),
    slowMoving: [...ranked].filter((r) => r.stock > 0).sort((a, b) => a.soldQuantity - b.soldQuantity || b.stockValue - a.stockValue),
    deadStock: ranked
      .filter((r) => r.stock > 0 && (!r.lastMovement || new Date(r.lastMovement) < cutoff))
      .sort((a, b) => b.stockValue - a.stockValue),
  };
}

export async function getSalesReportData(from: Date | null, to: Date | null) {
  const range = reportRange(from, to);
  const conditions = and(eq(invoices.isCancelled, false), gte(invoices.date, range.from), lte(invoices.date, range.to));

  const [invoiceRows, byDay, byMonth, byProduct, byCategory, byCustomer, byMethod, returnRows] = await Promise.all([
    db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        date: invoices.date,
        customer: customers.name,
        paymentMethod: invoices.paymentMethod,
        status: invoices.status,
        subtotal: invoices.subtotal,
        discount: invoices.discountAmount,
        tax: invoices.taxAmount,
        total: invoices.totalAmount,
        paid: invoices.amountPaid,
        due: invoices.amountDue,
      })
      .from(invoices)
      .leftJoin(customers, eq(invoices.customerId, customers.id))
      .where(conditions)
      .orderBy(desc(invoices.date), desc(invoices.id)),
    db
      .select({
        period: sql<string>`to_char(${invoices.date}, 'YYYY-MM-DD')`,
        invoices: sql<string>`count(*)`,
        subtotal: sql<string>`coalesce(sum(${invoices.subtotal}), 0)`,
        tax: sql<string>`coalesce(sum(${invoices.taxAmount}), 0)`,
        total: sql<string>`coalesce(sum(${invoices.totalAmount}), 0)`,
      })
      .from(invoices)
      .where(conditions)
      .groupBy(sql`to_char(${invoices.date}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${invoices.date}, 'YYYY-MM-DD')`),
    db
      .select({
        period: sql<string>`to_char(${invoices.date}, 'YYYY-MM')`,
        invoices: sql<string>`count(*)`,
        subtotal: sql<string>`coalesce(sum(${invoices.subtotal}), 0)`,
        tax: sql<string>`coalesce(sum(${invoices.taxAmount}), 0)`,
        total: sql<string>`coalesce(sum(${invoices.totalAmount}), 0)`,
      })
      .from(invoices)
      .where(conditions)
      .groupBy(sql`to_char(${invoices.date}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${invoices.date}, 'YYYY-MM')`),
    db
      .select({
        productId: products.id,
        code: products.code,
        product: products.name,
        unit: units.symbol,
        quantity: sql<string>`coalesce(sum(${invoiceItems.quantity}), 0)`,
        sales: sql<string>`coalesce(sum(${invoiceItems.total}), 0)`,
      })
      .from(invoiceItems)
      .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
      .innerJoin(products, eq(invoiceItems.productId, products.id))
      .leftJoin(units, eq(products.unitId, units.id))
      .where(conditions)
      .groupBy(products.id, products.code, products.name, units.symbol)
      .orderBy(desc(sql`sum(${invoiceItems.total})`)),
    db
      .select({
        category: categories.name,
        quantity: sql<string>`coalesce(sum(${invoiceItems.quantity}), 0)`,
        sales: sql<string>`coalesce(sum(${invoiceItems.total}), 0)`,
      })
      .from(invoiceItems)
      .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
      .innerJoin(products, eq(invoiceItems.productId, products.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(conditions)
      .groupBy(categories.name)
      .orderBy(desc(sql`sum(${invoiceItems.total})`)),
    db
      .select({
        customerId: customers.id,
        customer: customers.name,
        invoices: sql<string>`count(${invoices.id})`,
        sales: sql<string>`coalesce(sum(${invoices.totalAmount}), 0)`,
        paid: sql<string>`coalesce(sum(${invoices.amountPaid}), 0)`,
        due: sql<string>`coalesce(sum(${invoices.amountDue}), 0)`,
      })
      .from(invoices)
      .leftJoin(customers, eq(invoices.customerId, customers.id))
      .where(conditions)
      .groupBy(customers.id, customers.name)
      .orderBy(desc(sql`sum(${invoices.totalAmount})`)),
    db
      .select({
        method: invoices.paymentMethod,
        invoices: sql<string>`count(*)`,
        total: sql<string>`coalesce(sum(${invoices.totalAmount}), 0)`,
        paid: sql<string>`coalesce(sum(${invoices.amountPaid}), 0)`,
      })
      .from(invoices)
      .where(conditions)
      .groupBy(invoices.paymentMethod)
      .orderBy(desc(sql`sum(${invoices.totalAmount})`)),
    db
      .select({
        id: salesReturns.id,
        returnNumber: salesReturns.returnNumber,
        date: salesReturns.date,
        customer: customers.name,
        condition: salesReturns.condition,
        reason: salesReturns.reason,
        subtotal: salesReturns.subtotal,
        tax: salesReturns.taxAmount,
        total: salesReturns.totalAmount,
      })
      .from(salesReturns)
      .leftJoin(customers, eq(salesReturns.customerId, customers.id))
      .where(and(gte(salesReturns.date, range.from), lte(salesReturns.date, range.to)))
      .orderBy(desc(salesReturns.date)),
  ]);

  return { range, invoiceRows, byDay, byMonth, byProduct, byCategory, byCustomer, byMethod, returnRows };
}

export async function getPurchaseReportData(from: Date | null, to: Date | null) {
  const range = reportRange(from, to);
  const conditions = and(gte(goodsReceipts.date, range.from), lte(goodsReceipts.date, range.to));

  const [receipts, bySupplier, byProduct, byCategory, returns] = await Promise.all([
    db
      .select({
        id: goodsReceipts.id,
        grnNumber: goodsReceipts.grnNumber,
        date: goodsReceipts.date,
        supplier: suppliers.name,
        subtotal: goodsReceipts.subtotal,
        tax: goodsReceipts.taxAmount,
        total: goodsReceipts.totalAmount,
      })
      .from(goodsReceipts)
      .leftJoin(suppliers, eq(goodsReceipts.supplierId, suppliers.id))
      .where(conditions)
      .orderBy(desc(goodsReceipts.date)),
    db
      .select({
        supplierId: suppliers.id,
        supplier: suppliers.name,
        receipts: sql<string>`count(${goodsReceipts.id})`,
        subtotal: sql<string>`coalesce(sum(${goodsReceipts.subtotal}), 0)`,
        tax: sql<string>`coalesce(sum(${goodsReceipts.taxAmount}), 0)`,
        total: sql<string>`coalesce(sum(${goodsReceipts.totalAmount}), 0)`,
        outstanding: suppliers.outstandingBalance,
      })
      .from(goodsReceipts)
      .leftJoin(suppliers, eq(goodsReceipts.supplierId, suppliers.id))
      .where(conditions)
      .groupBy(suppliers.id, suppliers.name, suppliers.outstandingBalance)
      .orderBy(desc(sql`sum(${goodsReceipts.totalAmount})`)),
    db
      .select({
        productId: products.id,
        code: products.code,
        product: products.name,
        unit: units.symbol,
        received: sql<string>`coalesce(sum(${goodsReceiptItems.quantityReceived} - coalesce(${goodsReceiptItems.quantityDamaged}, 0)), 0)`,
        damaged: sql<string>`coalesce(sum(${goodsReceiptItems.quantityDamaged}), 0)`,
        total: sql<string>`coalesce(sum(${goodsReceiptItems.total}), 0)`,
      })
      .from(goodsReceiptItems)
      .innerJoin(goodsReceipts, eq(goodsReceiptItems.grnId, goodsReceipts.id))
      .innerJoin(products, eq(goodsReceiptItems.productId, products.id))
      .leftJoin(units, eq(products.unitId, units.id))
      .where(conditions)
      .groupBy(products.id, products.code, products.name, units.symbol)
      .orderBy(desc(sql`sum(${goodsReceiptItems.total})`)),
    db
      .select({
        category: categories.name,
        received: sql<string>`coalesce(sum(${goodsReceiptItems.quantityReceived} - coalesce(${goodsReceiptItems.quantityDamaged}, 0)), 0)`,
        total: sql<string>`coalesce(sum(${goodsReceiptItems.total}), 0)`,
      })
      .from(goodsReceiptItems)
      .innerJoin(goodsReceipts, eq(goodsReceiptItems.grnId, goodsReceipts.id))
      .innerJoin(products, eq(goodsReceiptItems.productId, products.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(conditions)
      .groupBy(categories.name)
      .orderBy(desc(sql`sum(${goodsReceiptItems.total})`)),
    db
      .select({
        id: purchaseReturns.id,
        returnNumber: purchaseReturns.returnNumber,
        date: purchaseReturns.date,
        supplier: suppliers.name,
        reason: purchaseReturns.reason,
        subtotal: purchaseReturns.subtotal,
        tax: purchaseReturns.taxAmount,
        total: purchaseReturns.totalAmount,
      })
      .from(purchaseReturns)
      .leftJoin(suppliers, eq(purchaseReturns.supplierId, suppliers.id))
      .where(and(gte(purchaseReturns.date, range.from), lte(purchaseReturns.date, range.to)))
      .orderBy(desc(purchaseReturns.date)),
  ]);

  return { range, receipts, bySupplier, byProduct, byCategory, returns };
}

export async function getProfitReportData(from: Date | null, to: Date | null) {
  const range = reportRange(from, to);
  const conditions = and(eq(invoices.isCancelled, false), gte(invoices.date, range.from), lte(invoices.date, range.to));

  const [invoiceSummary, returnSummary, expenseSummary, incomeSummary, byProduct, byCategory, byCustomer] = await Promise.all([
    db
      .select({
        sales: sql<string>`coalesce(sum(${invoices.subtotal} - ${invoices.discountAmount} + coalesce(${invoices.transportAmount}, 0)), 0)`,
        tax: sql<string>`coalesce(sum(${invoices.taxAmount}), 0)`,
        cogs: sql<string>`coalesce(sum(${invoices.costOfGoods}), 0)`,
        transport: sql<string>`coalesce(sum(coalesce(${invoices.transportAmount}, 0)), 0)`,
      })
      .from(invoices)
      .where(conditions),
    db
      .select({
        returns: sql<string>`coalesce(sum(${salesReturns.subtotal}), 0)`,
        returnTax: sql<string>`coalesce(sum(${salesReturns.taxAmount}), 0)`,
      })
      .from(salesReturns)
      .where(and(gte(salesReturns.date, range.from), lte(salesReturns.date, range.to))),
    db
      .select({ total: sql<string>`coalesce(sum(${expenses.amount}), 0)` })
      .from(expenses)
      .where(and(gte(expenses.date, range.from), lte(expenses.date, range.to), sql`${expenses.description} not like '%[VOID]%' or ${expenses.description} is null`)),
    db
      .select({ total: sql<string>`coalesce(sum(${income.amount}), 0)` })
      .from(income)
      .where(and(gte(income.date, range.from), lte(income.date, range.to))),
    db
      .select({
        productId: products.id,
        code: products.code,
        product: products.name,
        quantity: sql<string>`coalesce(sum(${invoiceItems.quantity}), 0)`,
        // Net item value + transport (VAT excluded)
        sales: sql<string>`coalesce(sum((${invoiceItems.quantity} * ${invoiceItems.unitPrice}) - coalesce(${invoiceItems.discount}, 0) + coalesce(${invoiceItems.transport}, 0)), 0)`,
        cogs: sql<string>`coalesce(sum(${invoiceItems.quantity} * ${invoiceItems.unitCost}), 0)`,
      })
      .from(invoiceItems)
      .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
      .innerJoin(products, eq(invoiceItems.productId, products.id))
      .where(conditions)
      .groupBy(products.id, products.code, products.name)
      .orderBy(desc(sql`sum((${invoiceItems.quantity} * ${invoiceItems.unitPrice}) - coalesce(${invoiceItems.discount}, 0) + coalesce(${invoiceItems.transport}, 0))`)),
    db
      .select({
        category: categories.name,
        // Net item value + transport (VAT excluded)
        sales: sql<string>`coalesce(sum((${invoiceItems.quantity} * ${invoiceItems.unitPrice}) - coalesce(${invoiceItems.discount}, 0) + coalesce(${invoiceItems.transport}, 0)), 0)`,
        cogs: sql<string>`coalesce(sum(${invoiceItems.quantity} * ${invoiceItems.unitCost}), 0)`,
      })
      .from(invoiceItems)
      .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
      .innerJoin(products, eq(invoiceItems.productId, products.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(conditions)
      .groupBy(categories.name)
      .orderBy(desc(sql`sum((${invoiceItems.quantity} * ${invoiceItems.unitPrice}) - coalesce(${invoiceItems.discount}, 0) + coalesce(${invoiceItems.transport}, 0))`)),
    db
      .select({
        customerId: customers.id,
        customer: customers.name,
        sales: sql<string>`coalesce(sum(${invoices.subtotal} - ${invoices.discountAmount} + coalesce(${invoices.transportAmount}, 0)), 0)`,
        cogs: sql<string>`coalesce(sum(${invoices.costOfGoods}), 0)`,
      })
      .from(invoices)
      .leftJoin(customers, eq(invoices.customerId, customers.id))
      .where(conditions)
      .groupBy(customers.id, customers.name)
      .orderBy(desc(sql`sum((${invoices.subtotal} - ${invoices.discountAmount} + coalesce(${invoices.transportAmount}, 0)) - ${invoices.costOfGoods})`)),
  ]);

  const grossSales = num(invoiceSummary[0]?.sales);
  const returns = num(returnSummary[0]?.returns);
  const netSales = round2(grossSales - returns);
  const cogs = num(invoiceSummary[0]?.cogs);
  const grossProfit = round2(netSales - cogs);
  const expenseTotal = num(expenseSummary[0]?.total);
  const otherIncome = num(incomeSummary[0]?.total);
  const netProfit = round2(grossProfit + otherIncome - expenseTotal);

  return {
    range,
    summary: {
      grossSales,
      returns,
      netSales,
      tax: round2(num(invoiceSummary[0]?.tax) - num(returnSummary[0]?.returnTax)),
      transport: round2(num(invoiceSummary[0]?.transport)),
      cogs,
      grossProfit,
      expenses: expenseTotal,
      otherIncome,
      netProfit,
    },
    byProduct: byProduct.map((r) => ({ ...r, salesNumber: num(r.sales), cogsNumber: num(r.cogs), profit: round2(num(r.sales) - num(r.cogs)) })),
    byCategory: byCategory.map((r) => ({ ...r, salesNumber: num(r.sales), cogsNumber: num(r.cogs), profit: round2(num(r.sales) - num(r.cogs)) })),
    byCustomer: byCustomer.map((r) => ({ ...r, salesNumber: num(r.sales), cogsNumber: num(r.cogs), profit: round2(num(r.sales) - num(r.cogs)) })),
  };
}

export async function getTaxReportData(from: Date | null, to: Date | null) {
  const range = reportRange(from, to);
  const [sales, salesRet, purchases, purchaseRet] = await Promise.all([
    db
      .select({ period: sql<string>`to_char(${invoices.date}, 'YYYY-MM')`, taxable: sql<string>`coalesce(sum(${invoices.subtotal} - ${invoices.discountAmount}), 0)`, tax: sql<string>`coalesce(sum(${invoices.taxAmount}), 0)` })
      .from(invoices)
      .where(and(eq(invoices.isCancelled, false), gte(invoices.date, range.from), lte(invoices.date, range.to)))
      .groupBy(sql`to_char(${invoices.date}, 'YYYY-MM')`),
    db
      .select({ period: sql<string>`to_char(${salesReturns.date}, 'YYYY-MM')`, taxable: sql<string>`coalesce(sum(${salesReturns.subtotal}), 0)`, tax: sql<string>`coalesce(sum(${salesReturns.taxAmount}), 0)` })
      .from(salesReturns)
      .where(and(gte(salesReturns.date, range.from), lte(salesReturns.date, range.to)))
      .groupBy(sql`to_char(${salesReturns.date}, 'YYYY-MM')`),
    db
      .select({ period: sql<string>`to_char(${goodsReceipts.date}, 'YYYY-MM')`, taxable: sql<string>`coalesce(sum(${goodsReceipts.subtotal} - ${goodsReceipts.discountAmount}), 0)`, tax: sql<string>`coalesce(sum(${goodsReceipts.taxAmount}), 0)` })
      .from(goodsReceipts)
      .where(and(gte(goodsReceipts.date, range.from), lte(goodsReceipts.date, range.to)))
      .groupBy(sql`to_char(${goodsReceipts.date}, 'YYYY-MM')`),
    db
      .select({ period: sql<string>`to_char(${purchaseReturns.date}, 'YYYY-MM')`, taxable: sql<string>`coalesce(sum(${purchaseReturns.subtotal}), 0)`, tax: sql<string>`coalesce(sum(${purchaseReturns.taxAmount}), 0)` })
      .from(purchaseReturns)
      .where(and(gte(purchaseReturns.date, range.from), lte(purchaseReturns.date, range.to)))
      .groupBy(sql`to_char(${purchaseReturns.date}, 'YYYY-MM')`),
  ]);

  const periods = [...new Set([...sales, ...salesRet, ...purchases, ...purchaseRet].map((r) => r.period))].sort();
  const rows = periods.map((period) => {
    const s = sales.find((r) => r.period === period);
    const sr = salesRet.find((r) => r.period === period);
    const p = purchases.find((r) => r.period === period);
    const pr = purchaseRet.find((r) => r.period === period);
    const outputTax = round2(num(s?.tax) - num(sr?.tax));
    const inputTax = round2(num(p?.tax) - num(pr?.tax));
    return {
      period,
      salesTaxable: round2(num(s?.taxable) - num(sr?.taxable)),
      outputTax,
      purchaseTaxable: round2(num(p?.taxable) - num(pr?.taxable)),
      inputTax,
      netTax: round2(outputTax - inputTax),
    };
  });
  return { range, rows };
}
