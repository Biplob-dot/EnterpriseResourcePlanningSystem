import { db } from "@/db";
import {
  products,
  customers,
  suppliers,
  invoices,
  salesOrders,
  quotations,
  purchaseOrders,
  goodsReceipts,
  salesReturns,
  purchaseReturns,
} from "@/db/schema";
import { desc, eq, ilike, or, sql } from "drizzle-orm";

export type SearchHit = {
  label: string;
  sub: string;
  href: string;
  type: string;
  tone: "green" | "red" | "amber" | "blue" | "slate" | "indigo";
};

const like = (term: string) => `%${term}%`;

export async function globalSearch(term: string, limitPerType = 4): Promise<SearchHit[]> {
  const q = term.trim();
  if (q.length < 2) return [];
  const pattern = like(q);
  const hits: SearchHit[] = [];

  const [prodRows, custRows, suppRows, invRows, soRows, quoteRows, poRows, grnRows, srRows, prRows] = await Promise.all([
    db
      .select({ id: products.id, code: products.code, name: products.name, barcode: products.barcode })
      .from(products)
      .where(or(ilike(products.name, pattern), ilike(products.code, pattern), ilike(products.barcode, pattern)))
      .orderBy(products.name)
      .limit(limitPerType),
    db
      .select({ id: customers.id, name: customers.name, phone: customers.phone, company: customers.companyName })
      .from(customers)
      .where(or(ilike(customers.name, pattern), ilike(customers.phone, pattern), ilike(customers.companyName, pattern)))
      .orderBy(customers.name)
      .limit(limitPerType),
    db
      .select({ id: suppliers.id, name: suppliers.name, phone: suppliers.phone, company: suppliers.companyName })
      .from(suppliers)
      .where(or(ilike(suppliers.name, pattern), ilike(suppliers.phone, pattern), ilike(suppliers.companyName, pattern)))
      .orderBy(suppliers.name)
      .limit(limitPerType),
    db
      .select({ id: invoices.id, number: invoices.invoiceNumber, total: invoices.totalAmount, status: invoices.status })
      .from(invoices)
      .where(ilike(invoices.invoiceNumber, pattern))
      .orderBy(desc(invoices.id))
      .limit(limitPerType),
    db
      .select({ id: salesOrders.id, number: salesOrders.soNumber, status: salesOrders.status })
      .from(salesOrders)
      .where(ilike(salesOrders.soNumber, pattern))
      .orderBy(desc(salesOrders.id))
      .limit(limitPerType),
    db
      .select({ id: quotations.id, number: quotations.quoteNumber, status: quotations.status })
      .from(quotations)
      .where(ilike(quotations.quoteNumber, pattern))
      .orderBy(desc(quotations.id))
      .limit(limitPerType),
    db
      .select({ id: purchaseOrders.id, number: purchaseOrders.poNumber, status: purchaseOrders.status })
      .from(purchaseOrders)
      .where(ilike(purchaseOrders.poNumber, pattern))
      .orderBy(desc(purchaseOrders.id))
      .limit(limitPerType),
    db
      .select({ id: goodsReceipts.id, number: goodsReceipts.grnNumber, total: goodsReceipts.totalAmount })
      .from(goodsReceipts)
      .where(ilike(goodsReceipts.grnNumber, pattern))
      .orderBy(desc(goodsReceipts.id))
      .limit(limitPerType),
    db
      .select({ id: salesReturns.id, number: salesReturns.returnNumber, total: salesReturns.totalAmount })
      .from(salesReturns)
      .where(ilike(salesReturns.returnNumber, pattern))
      .orderBy(desc(salesReturns.id))
      .limit(limitPerType),
    db
      .select({ id: purchaseReturns.id, number: purchaseReturns.returnNumber, total: purchaseReturns.totalAmount })
      .from(purchaseReturns)
      .where(ilike(purchaseReturns.returnNumber, pattern))
      .orderBy(desc(purchaseReturns.id))
      .limit(limitPerType),
  ]);

  for (const p of prodRows) {
    hits.push({ type: "Product", label: p.name, sub: [p.code, p.barcode].filter(Boolean).join(" • "), href: `/inventory/products/${p.id}`, tone: "indigo" });
  }
  for (const c of custRows) {
    hits.push({ type: "Customer", label: c.name, sub: [c.company, c.phone].filter(Boolean).join(" • "), href: `/sales/customers/${c.id}`, tone: "blue" });
  }
  for (const s of suppRows) {
    hits.push({ type: "Supplier", label: s.name, sub: [s.company, s.phone].filter(Boolean).join(" • "), href: `/purchasing/suppliers/${s.id}`, tone: "amber" });
  }
  for (const i of invRows) {
    hits.push({ type: "Invoice", label: i.number, sub: [i.total, i.status ?? ""].filter(Boolean).join(" • "), href: `/sales/invoices/${i.id}`, tone: "green" });
  }
  for (const s of soRows) {
    hits.push({ type: "Sales Order", label: s.number, sub: (s.status ?? "").replace(/_/g, " "), href: `/sales/orders/${s.id}`, tone: "slate" });
  }
  for (const q of quoteRows) {
    hits.push({ type: "Quotation", label: q.number, sub: (q.status ?? "").replace(/_/g, " "), href: `/sales/quotations/${q.id}`, tone: "slate" });
  }
  for (const p of poRows) {
    hits.push({ type: "Purchase Order", label: p.number, sub: (p.status ?? "").replace(/_/g, " "), href: `/purchasing/pos/${p.id}`, tone: "amber" });
  }
  for (const g of grnRows) {
    hits.push({ type: "Goods Received", label: g.number, sub: g.total ?? "", href: `/purchasing/grn/${g.id}`, tone: "green" });
  }
  for (const r of srRows) {
    hits.push({ type: "Sales Return", label: r.number, sub: r.total ?? "", href: `/sales/returns/${r.id}`, tone: "red" });
  }
  for (const r of prRows) {
    hits.push({ type: "Purchase Return", label: r.number, sub: r.total ?? "", href: `/purchasing/returns/${r.id}`, tone: "red" });
  }

  return hits;
}

export async function quickProductSearch(term: string) {
  const pattern = like(term.trim());
  const rows = await db
    .select({
      id: products.id,
      code: products.code,
      name: products.name,
      sellingPrice: products.sellingPrice,
      stock: sql<string>`coalesce((select sum(quantity) from inventory_transactions where product_id = ${products.id}), 0)`,
    })
    .from(products)
    .where(or(ilike(products.name, pattern), ilike(products.code, pattern)))
    .limit(8);
  return rows;
}
