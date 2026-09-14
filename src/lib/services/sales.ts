import { db } from "@/db";
import {
  customers,
  customerTransactions,
  quotations,
  quotationItems,
  salesOrders,
  salesOrderItems,
  deliveryNotes,
  deliveryNoteItems,
  invoices,
  invoiceItems,
  salesReturns,
  salesReturnItems,
  payments,
  paymentAllocations,
  products,
  units,
  warehouses,
  bins,
  auditLogs,
  settings,
} from "@/db/schema";
import { and, asc, desc, eq, gte, inArray, lte, lt, sql, type InferSelectModel } from "drizzle-orm";
import { getProductStock, postInventoryTransaction } from "./inventory";
import { ACC, accountCodeForMethod, nextDocNumber, postJournal, recordBankMovement, type Db } from "./accounting";
import { calcLine, calcTotals, round2 } from "@/lib/calc";
import { num } from "@/lib/format";

export type LineInput = {
  productId: number;
  quantity: number;
  unitId: number | null;
  unitPrice: number;
  discount: number;
  taxRate: number;
  transport?: number; // transportation charge added to the line total
};

export type InvoiceInput = {
  customerId: number;
  date: Date;
  dueDate: Date | null;
  soId?: number | null;
  quoteId?: number | null;
  items: LineInput[];
  paymentMethod: string | null;
  amountPaid: number;
  notes: string | null;
};

export type ReturnLineInput = { productId: number; quantity: number; unitPrice: number; taxRate: number };

export type CustomerPaymentInput = {
  customerId: number;
  date: Date;
  amount: number;
  method: string;
  reference: string | null;
  notes: string | null;
  isAdvance?: boolean;
  chequeDate?: Date | null;
};

export type CustomerReturnInput = {
  customerId: number;
  invoiceId: number | null;
  date: Date;
  reason: string;
  condition: "RESELLABLE" | "DAMAGED" | "SCRAP";
  notes: string | null;
  items: ReturnLineInput[];
};

/* ------------------------------------------------------------------ */
/* Customer ledger                                                     */
/* ------------------------------------------------------------------ */

export async function postCustomerLedger(
  tx: Db,
  input: {
    customerId: number;
    date: Date;
    type: "OPENING" | "INVOICE" | "PAYMENT" | "RETURN" | "ADJUSTMENT";
    reference: string;
    referenceId?: number | null;
    debit?: number;
    credit?: number;
    notes?: string | null;
  }
) {
  const [c] = await tx.select({ balance: customers.outstandingBalance }).from(customers).where(eq(customers.id, input.customerId)).limit(1);
  if (!c) throw new Error("Customer not found.");

  const debit = round2(input.debit ?? 0); // reduces what they owe (payment)
  const credit = round2(input.credit ?? 0); // increases what they owe (sale)
  const newBalance = round2(num(c.balance) + credit - debit);

  await tx.update(customers).set({ outstandingBalance: newBalance.toFixed(2) }).where(eq(customers.id, input.customerId));
  await tx.insert(customerTransactions).values({
    customerId: input.customerId,
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
/* Customers                                                           */
/* ------------------------------------------------------------------ */

export async function getCustomers() {
  return db
    .select({
      id: customers.id,
      name: customers.name,
      companyName: customers.companyName,
      contactPerson: customers.contactPerson,
      phone: customers.phone,
      email: customers.email,
      address: customers.address,
      outstandingBalance: customers.outstandingBalance,
      isActive: customers.isActive,
      invoiceCount: sql<string>`(select count(*) from invoices i where i.customer_id = ${customers.id} and i.is_cancelled = false)`,
      revenue: sql<string>`coalesce((select sum(total_amount) from invoices i where i.customer_id = ${customers.id} and i.is_cancelled = false), 0)`,
    })
    .from(customers)
    .orderBy(customers.name);
}

export async function getCustomerOptions() {
  return db
    .select({ id: customers.id, name: customers.name, companyName: customers.companyName, outstandingBalance: customers.outstandingBalance })
    .from(customers)
    .where(eq(customers.isActive, true))
    .orderBy(customers.name);
}

export async function getCustomerDetail(id: number) {
  const [customer] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  if (!customer) return null;

  const [invRows, returns, pays, ledger, agg] = await Promise.all([
    db.select().from(invoices).where(eq(invoices.customerId, id)).orderBy(desc(invoices.id)),
    db.select().from(salesReturns).where(eq(salesReturns.customerId, id)).orderBy(desc(salesReturns.id)),
    db.select().from(payments).where(eq(payments.customerId, id)).orderBy(desc(payments.id)),
    db.select().from(customerTransactions).where(eq(customerTransactions.customerId, id)).orderBy(desc(customerTransactions.date), desc(customerTransactions.id)).limit(50),
    db
      .select({
        invoiced: sql<string>`coalesce((select sum(total_amount) from invoices where customer_id = ${id} and is_cancelled = false), 0)`,
        paid: sql<string>`coalesce((select sum(amount) from payments where customer_id = ${id} and status = 'COMPLETED'), 0)`,
        returned: sql<string>`coalesce((select sum(total_amount) from sales_returns where customer_id = ${id}), 0)`,
      })
      .from(customers)
      .where(eq(customers.id, id)),
  ]);

  const overdue = invRows.filter((i) => !i.isCancelled && (i.status === "UNPAID" || i.status === "PARTIALLY_PAID") && i.dueDate && new Date(i.dueDate) < new Date());

  return { customer, invoices: invRows, returns, payments: pays, ledger, agg: agg[0], overdue };
}

export async function getCustomerStatement(id: number, from: Date | null, to: Date | null) {
  const [customer] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  if (!customer) return null;

  let opening = 0;
  if (from) {
    const [o] = await db
      .select({
        debit: sql<string>`coalesce(sum(${customerTransactions.debit}), 0)`,
        credit: sql<string>`coalesce(sum(${customerTransactions.credit}), 0)`,
      })
      .from(customerTransactions)
      .where(and(eq(customerTransactions.customerId, id), lt(customerTransactions.date, from)));
    opening = round2(num(o?.credit) - num(o?.debit));
  }

  const conditions = [eq(customerTransactions.customerId, id)];
  if (from) conditions.push(gte(customerTransactions.date, from));
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    conditions.push(lte(customerTransactions.date, end));
  }
  const rows = await db.select().from(customerTransactions).where(and(...conditions)).orderBy(asc(customerTransactions.date), asc(customerTransactions.id));
  return { customer, opening, rows };
}

/* ------------------------------------------------------------------ */
/* Quotations                                                          */
/* ------------------------------------------------------------------ */

function validateLines(items: { quantity: number; unitPrice: number; discount?: number; taxRate?: number; transport?: number }[]) {
  if (!items.length) throw new Error("Add at least one product.");
  for (const i of items) {
    if (!(i.quantity > 0)) throw new Error("Every line needs a quantity greater than zero.");
    if (i.unitPrice < 0) throw new Error("Unit price cannot be negative.");
    if ((i.discount ?? 0) < 0) throw new Error("Discount cannot be negative.");
    if ((i.taxRate ?? 0) < 0) throw new Error("Tax rate cannot be negative.");
    if ((i.transport ?? 0) < 0) throw new Error("Transportation charge cannot be negative.");
  }
}

export async function getQuotations() {
  return db
    .select({
      id: quotations.id,
      quoteNumber: quotations.quoteNumber,
      date: quotations.date,
      validUntil: quotations.validUntil,
      status: quotations.status,
      totalAmount: quotations.totalAmount,
      customer: customers.name,
      itemCount: sql<string>`(select count(*) from quotation_items qi where qi.quote_id = ${quotations.id})`,
    })
    .from(quotations)
    .leftJoin(customers, eq(quotations.customerId, customers.id))
    .orderBy(desc(quotations.id));
}

export async function getQuotation(id: number) {
  const [q] = await db.select({ quote: quotations, customer: customers }).from(quotations).leftJoin(customers, eq(quotations.customerId, customers.id)).where(eq(quotations.id, id)).limit(1);
  if (!q) return null;
  const items = await db
    .select({
      id: quotationItems.id,
      productId: quotationItems.productId,
      code: products.code,
      name: products.name,
      quantity: quotationItems.quantity,
      unitId: quotationItems.unitId,
      unit: units.symbol,
      unitPrice: quotationItems.unitPrice,
      discount: quotationItems.discount,
      taxRate: quotationItems.taxRate,
      total: quotationItems.total,
    })
    .from(quotationItems)
    .leftJoin(products, eq(quotationItems.productId, products.id))
    .leftJoin(units, eq(quotationItems.unitId, units.id))
    .where(eq(quotationItems.quoteId, id))
    .orderBy(quotationItems.id);
  return { ...q.quote, customer: q.customer, items };
}

export async function getOpenQuotations() {
  return db
    .select({
      id: quotations.id,
      quoteNumber: quotations.quoteNumber,
      customerId: quotations.customerId,
      customerName: customers.name,
      date: quotations.date,
      status: quotations.status,
      totalAmount: quotations.totalAmount,
    })
    .from(quotations)
    .leftJoin(customers, eq(quotations.customerId, customers.id))
    .where(inArray(quotations.status, ["DRAFT", "SENT"]))
    .orderBy(desc(quotations.id));
}

export async function createQuotation(input: {
  customerId: number;
  date: Date;
  validUntil: Date | null;
  status: "DRAFT" | "SENT";
  notes: string | null;
  items: LineInput[];
}) {
  validateLines(input.items);
  return db.transaction(async (tx) => {
    const quoteNumber = await nextDocNumber(tx, quotations, quotations.id, quotations.quoteNumber, "QTN-");
    const totals = calcTotals(input.items);
    const [quote] = await tx
      .insert(quotations)
      .values({
        quoteNumber,
        customerId: input.customerId,
        date: input.date,
        validUntil: input.validUntil,
        status: input.status,
        subtotal: totals.subtotal.toFixed(2),
        discountAmount: totals.discount.toFixed(2),
        taxAmount: totals.tax.toFixed(2),
        totalAmount: totals.total.toFixed(2),
        notes: input.notes,
      })
      .returning();
    await tx.insert(quotationItems).values(
      input.items.map((i) => ({
        quoteId: quote.id,
        productId: i.productId,
        quantity: i.quantity.toFixed(4),
        unitId: i.unitId,
        unitPrice: i.unitPrice.toFixed(2),
        discount: i.discount.toFixed(2),
        taxRate: i.taxRate.toFixed(2),
        total: calcLine(i).total.toFixed(2),
      }))
    );
    return quote;
  });
}

export async function convertQuotation(id: number, target: "SALES_ORDER" | "INVOICE") {
  const q = await getQuotation(id);
  if (!q) throw new Error("Quotation not found.");
  if (q.status === "ACCEPTED" || q.status === "REJECTED" || q.status === "EXPIRED") throw new Error(`Quotation is ${q.status?.toLowerCase()} and cannot be converted.`);
  if (!q.customer) throw new Error("Quotation has no customer.");

  return db.transaction(async (tx) => {
    const items: LineInput[] = q.items.map((i) => ({
      productId: i.productId!,
      quantity: num(i.quantity),
      unitId: i.unitId,
      unitPrice: num(i.unitPrice),
      discount: num(i.discount),
      taxRate: num(i.taxRate),
    }));
    let targetId = id;
    if (target === "SALES_ORDER") {
      const soNumber = await nextDocNumber(tx, salesOrders, salesOrders.id, salesOrders.soNumber, "SO-");
      const totals = calcTotals(items);
      const [so] = await tx
        .insert(salesOrders)
        .values({
          soNumber,
          customerId: q.customerId!,
          quoteId: id,
          date: new Date(),
          status: "CONFIRMED",
          subtotal: totals.subtotal.toFixed(2),
          discountAmount: totals.discount.toFixed(2),
          taxAmount: totals.tax.toFixed(2),
          totalAmount: totals.total.toFixed(2),
          notes: q.notes,
        })
        .returning();
      await tx.insert(salesOrderItems).values(
        items.map((i) => ({
          soId: so.id,
          productId: i.productId,
          quantity: i.quantity.toFixed(4),
          unitId: i.unitId,
          unitPrice: i.unitPrice.toFixed(2),
          discount: i.discount.toFixed(2),
          taxRate: i.taxRate.toFixed(2),
          total: calcLine(i).total.toFixed(2),
        }))
      );
      targetId = so.id;
    } else {
      const inv = await createInvoiceInternal(tx, {
        customerId: q.customerId!,
        date: new Date(),
        dueDate: null,
        soId: null,
        quoteId: id,
        items,
        paymentMethod: null,
        amountPaid: 0,
        notes: q.notes,
      });
      targetId = inv.id;
    }
    await tx.update(quotations).set({ status: "ACCEPTED" }).where(eq(quotations.id, id));
    return { targetId, target };
  });
}

export async function setQuoteStatus(id: number, status: "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED") {
  await db.update(quotations).set({ status }).where(eq(quotations.id, id));
}

/* ------------------------------------------------------------------ */
/* Sales orders                                                        */
/* ------------------------------------------------------------------ */

export async function getSalesOrders() {
  return db
    .select({
      id: salesOrders.id,
      soNumber: salesOrders.soNumber,
      date: salesOrders.date,
      deliveryDate: salesOrders.deliveryDate,
      status: salesOrders.status,
      totalAmount: salesOrders.totalAmount,
      customer: customers.name,
      itemCount: sql<string>`(select count(*) from sales_order_items si where si.so_id = ${salesOrders.id})`,
    })
    .from(salesOrders)
    .leftJoin(customers, eq(salesOrders.customerId, customers.id))
    .orderBy(desc(salesOrders.id));
}

export async function getSalesOrder(id: number) {
  const [so] = await db.select({ so: salesOrders, customer: customers, quoteNumber: quotations.quoteNumber }).from(salesOrders).leftJoin(customers, eq(salesOrders.customerId, customers.id)).leftJoin(quotations, eq(salesOrders.quoteId, quotations.id)).where(eq(salesOrders.id, id)).limit(1);
  if (!so) return null;
  const items = await db
    .select({
      id: salesOrderItems.id,
      productId: salesOrderItems.productId,
      code: products.code,
      name: products.name,
      quantity: salesOrderItems.quantity,
      deliveredQuantity: salesOrderItems.deliveredQuantity,
      unitId: salesOrderItems.unitId,
      unit: units.symbol,
      unitPrice: salesOrderItems.unitPrice,
      discount: salesOrderItems.discount,
      taxRate: salesOrderItems.taxRate,
      total: salesOrderItems.total,
    })
    .from(salesOrderItems)
    .leftJoin(products, eq(salesOrderItems.productId, products.id))
    .leftJoin(units, eq(salesOrderItems.unitId, units.id))
    .where(eq(salesOrderItems.soId, id))
    .orderBy(salesOrderItems.id);
  const deliveries = await db.select().from(deliveryNotes).where(eq(deliveryNotes.soId, id)).orderBy(desc(deliveryNotes.id));
  return { ...so.so, customer: so.customer, quoteNumber: so.quoteNumber, items, deliveries };
}

export async function getOpenSalesOrders() {
  const sos = await db
    .select({
      id: salesOrders.id,
      soNumber: salesOrders.soNumber,
      customerId: salesOrders.customerId,
      customerName: customers.name,
      date: salesOrders.date,
      status: salesOrders.status,
    })
    .from(salesOrders)
    .leftJoin(customers, eq(salesOrders.customerId, customers.id))
    .where(inArray(salesOrders.status, ["CONFIRMED", "PARTIALLY_DELIVERED"]))
    .orderBy(desc(salesOrders.id));
  if (sos.length === 0) return [];
  const items = await db
    .select({
      soItemId: salesOrderItems.id,
      soId: salesOrderItems.soId,
      productId: salesOrderItems.productId,
      code: products.code,
      name: products.name,
      unitId: salesOrderItems.unitId,
      unit: units.symbol,
      quantity: salesOrderItems.quantity,
      deliveredQuantity: salesOrderItems.deliveredQuantity,
      unitPrice: salesOrderItems.unitPrice,
      discount: salesOrderItems.discount,
      taxRate: salesOrderItems.taxRate,
    })
    .from(salesOrderItems)
    .leftJoin(products, eq(salesOrderItems.productId, products.id))
    .leftJoin(units, eq(salesOrderItems.unitId, units.id))
    .where(inArray(salesOrderItems.soId, sos.map((s) => s.id)));
  return sos.map((so) => ({
    ...so,
    items: items
      .filter((i) => i.soId === so.id)
      .map((i) => {
        const ordered = num(i.quantity);
        const delivered = num(i.deliveredQuantity);
        return {
          soItemId: i.soItemId,
          productId: i.productId!,
          code: i.code ?? "",
          name: i.name ?? "",
          unitId: i.unitId,
          unit: i.unit,
          ordered,
          delivered,
          remaining: Math.max(0, round2(ordered - delivered)),
          unitPrice: num(i.unitPrice),
          discountPerUnit: ordered > 0 ? num(i.discount) / ordered : 0,
          taxRate: num(i.taxRate),
        };
      }),
  }));
}

export async function createSalesOrder(input: {
  customerId: number;
  quoteId?: number | null;
  date: Date;
  deliveryDate: Date | null;
  status: "DRAFT" | "CONFIRMED";
  notes: string | null;
  items: LineInput[];
}) {
  validateLines(input.items);
  return db.transaction(async (tx) => {
    const soNumber = await nextDocNumber(tx, salesOrders, salesOrders.id, salesOrders.soNumber, "SO-");
    const totals = calcTotals(input.items);
    const [so] = await tx
      .insert(salesOrders)
      .values({
        soNumber,
        customerId: input.customerId,
        quoteId: input.quoteId ?? null,
        date: input.date,
        deliveryDate: input.deliveryDate,
        status: input.status,
        subtotal: totals.subtotal.toFixed(2),
        discountAmount: totals.discount.toFixed(2),
        taxAmount: totals.tax.toFixed(2),
        totalAmount: totals.total.toFixed(2),
        notes: input.notes,
      })
      .returning();
    await tx.insert(salesOrderItems).values(
      input.items.map((i) => ({
        soId: so.id,
        productId: i.productId,
        quantity: i.quantity.toFixed(4),
        unitId: i.unitId,
        unitPrice: i.unitPrice.toFixed(2),
        discount: i.discount.toFixed(2),
        taxRate: i.taxRate.toFixed(2),
        total: calcLine(i).total.toFixed(2),
      }))
    );
    return so;
  });
}

export async function setSoStatus(id: number, status: "CONFIRMED" | "CANCELLED" | "COMPLETED") {
  return db.transaction(async (tx) => {
    const [so] = await tx.select().from(salesOrders).where(eq(salesOrders.id, id)).limit(1);
    if (!so) throw new Error("Sales order not found.");
    if (status === "CONFIRMED" && !(so.status === "DRAFT")) throw new Error("Only a draft order can be confirmed.");
    if (status === "CANCELLED") {
      if (so.status === "DELIVERED" || so.status === "COMPLETED") throw new Error("This order has already been delivered.");
    }
    if (status === "COMPLETED" && !(so.status === "CONFIRMED" || so.status === "PARTIALLY_DELIVERED" || so.status === "DELIVERED")) {
      throw new Error("Only open orders can be marked complete.");
    }
    await tx.update(salesOrders).set({ status }).where(eq(salesOrders.id, id));
  });
}

/* ------------------------------------------------------------------ */
/* Delivery notes                                                      */
/* ------------------------------------------------------------------ */

export async function getDeliveryNotes() {
  return db
    .select({
      id: deliveryNotes.id,
      dnNumber: deliveryNotes.dnNumber,
      date: deliveryNotes.date,
      customer: customers.name,
      soNumber: salesOrders.soNumber,
      invoiceId: deliveryNotes.invoiceId,
      itemCount: sql<string>`(select count(*) from delivery_note_items di where di.dn_id = ${deliveryNotes.id})`,
    })
    .from(deliveryNotes)
    .leftJoin(customers, eq(deliveryNotes.customerId, customers.id))
    .leftJoin(salesOrders, eq(deliveryNotes.soId, salesOrders.id))
    .orderBy(desc(deliveryNotes.id));
}

export async function getDeliveryNote(id: number) {
  const [dn] = await db.select({ dn: deliveryNotes, customer: customers, soNumber: salesOrders.soNumber }).from(deliveryNotes).leftJoin(customers, eq(deliveryNotes.customerId, customers.id)).leftJoin(salesOrders, eq(deliveryNotes.soId, salesOrders.id)).where(eq(deliveryNotes.id, id)).limit(1);
  if (!dn) return null;
  const items = await db
    .select({
      id: deliveryNoteItems.id,
      productId: deliveryNoteItems.productId,
      code: products.code,
      name: products.name,
      quantity: deliveryNoteItems.quantity,
      unitId: deliveryNoteItems.unitId,
      unit: units.symbol,
    })
    .from(deliveryNoteItems)
    .leftJoin(products, eq(deliveryNoteItems.productId, products.id))
    .leftJoin(units, eq(deliveryNoteItems.unitId, units.id))
    .where(eq(deliveryNoteItems.dnId, id))
    .orderBy(deliveryNoteItems.id);
  return { ...dn.dn, customer: dn.customer, soNumber: dn.soNumber, items };
}

export async function createDeliveryNote(input: {
  customerId: number;
  soId?: number | null;
  invoiceId?: number | null;
  date: Date;
  address: string | null;
  notes: string | null;
  items: { soItemId: number | null; productId: number; quantity: number; unitId: number | null }[];
}) {
  if (!input.items.length) throw new Error("Add at least one product to deliver.");
  for (const i of input.items) {
    if (!(i.quantity > 0)) throw new Error("Delivery quantity must be greater than zero on every line.");
  }
  return db.transaction(async (tx) => {
    if (input.soId) {
      const [so] = await tx.select().from(salesOrders).where(eq(salesOrders.id, input.soId)).limit(1);
      if (!so) throw new Error("Sales order not found.");
      const soItems = await tx.select().from(salesOrderItems).where(eq(salesOrderItems.soId, input.soId));
      for (const i of input.items) {
        if (i.soItemId) {
          const pi = soItems.find((p) => p.id === i.soItemId);
          if (!pi) continue;
          const remaining = round2(num(pi.quantity) - num(pi.deliveredQuantity));
          if (i.quantity > remaining + 0.0001) {
            const prod = await tx.select({ name: products.name }).from(products).where(eq(products.id, i.productId)).limit(1);
            throw new Error(`Cannot deliver ${i.quantity} of ${prod[0]?.name ?? "product"}: only ${remaining} remaining on the order.`);
          }
          await tx.update(salesOrderItems).set({ deliveredQuantity: round2(num(pi.deliveredQuantity) + i.quantity).toFixed(4) }).where(eq(salesOrderItems.id, pi.id));
        }
      }
      const allDone = soItems.every((p) => num(p.deliveredQuantity) + 0.0001 >= num(p.quantity));
      const anyDone = soItems.some((p) => num(p.deliveredQuantity) > 0);
      const newStatus = allDone ? "DELIVERED" : anyDone ? "PARTIALLY_DELIVERED" : so.status;
      if (newStatus !== so.status) await tx.update(salesOrders).set({ status: newStatus }).where(eq(salesOrders.id, so.id));
    }

    const dnNumber = await nextDocNumber(tx, deliveryNotes, deliveryNotes.id, deliveryNotes.dnNumber, "DN-");
    const [dn] = await tx
      .insert(deliveryNotes)
      .values({
        dnNumber,
        customerId: input.customerId,
        soId: input.soId ?? null,
        invoiceId: input.invoiceId ?? null,
        date: input.date,
        address: input.address,
        notes: input.notes,
      })
      .returning();
    await tx.insert(deliveryNoteItems).values(
      input.items.map((i) => ({
        dnId: dn.id,
        soItemId: i.soItemId,
        productId: i.productId,
        quantity: i.quantity.toFixed(4),
        unitId: i.unitId,
      }))
    );
    return dn;
  });
}

/* ------------------------------------------------------------------ */
/* Invoices (the fast sale)                                            */
/* ------------------------------------------------------------------ */

async function createInvoiceInternal(
  tx: Db,
  input: InvoiceInput
): Promise<InferSelectModel<typeof invoices>> {
  validateLines(input.items);

  const [customer] = await tx.select().from(customers).where(eq(customers.id, input.customerId)).limit(1);
  if (!customer) throw new Error("Please choose a customer.");

  const productIds = [...new Set(input.items.map((i) => i.productId))];
  const prodRows = await tx.select().from(products).where(inArray(products.id, productIds));
  const prodById = new Map(prodRows.map((p) => [p.id, p]));

  for (const i of input.items) {
    const product = prodById.get(i.productId);
    if (!product) throw new Error("One of the products no longer exists.");
    const stock = await getProductStock(i.productId, null, tx);
    if (stock + 0.0001 < i.quantity) {
      throw new Error(`Not enough stock for ${product.name}: ${stock} available but ${i.quantity} on the invoice.`);
    }
  }

  const totals = calcTotals(input.items);
  const amountPaid = Math.min(Math.max(round2(input.amountPaid), 0), totals.total);

  const outstanding = num(customer.outstandingBalance);

  const [config] = await tx.select().from(settings).limit(1);
  const prefix = config?.invoicePrefix ?? "INV-";
  const [lastInv] = await tx.select({ n: sql<string>`coalesce(max(${invoices.id}), 0)` }).from(invoices);
  const invoiceNumber = await nextDocNumber(tx, invoices, invoices.id, invoices.invoiceNumber, prefix);

  const costOfGoods = round2(
    input.items.reduce((s, i) => s + num(prodById.get(i.productId)?.purchasePrice) * i.quantity, 0)
  );

  const [inv] = await tx
    .insert(invoices)
    .values({
      invoiceNumber,
      customerId: input.customerId,
      soId: input.soId ?? null,
      quoteId: input.quoteId ?? null,
      date: input.date,
      dueDate: input.dueDate,
      status: amountPaid >= totals.total ? "PAID" : amountPaid > 0 ? "PARTIALLY_PAID" : "UNPAID",
      subtotal: totals.subtotal.toFixed(2),
      discountAmount: totals.discount.toFixed(2),
      taxAmount: totals.tax.toFixed(2),
      transportAmount: totals.transport.toFixed(2),
      totalAmount: totals.total.toFixed(2),
      amountPaid: amountPaid.toFixed(2),
      amountDue: round2(totals.total - amountPaid).toFixed(2),
      costOfGoods: costOfGoods.toFixed(2),
      paymentMethod: input.paymentMethod,
      notes: input.notes,
    })
    .returning();

  for (const i of input.items) {
    const product = prodById.get(i.productId)!;
    await tx.insert(invoiceItems).values({
      invoiceId: inv.id,
      productId: i.productId,
      quantity: i.quantity.toFixed(4),
      unitId: i.unitId,
      unitPrice: i.unitPrice.toFixed(2),
      unitCost: num(product.purchasePrice).toFixed(2),
      discount: i.discount.toFixed(2),
      taxRate: i.taxRate.toFixed(2),
      transport: (i.transport ?? 0).toFixed(2),
      total: calcLine(i).total.toFixed(2),
    });
    const stock = await getProductStock(i.productId, null, tx);
    if (stock + 0.0001 < i.quantity) {
      throw new Error(`Not enough stock for ${product.name} at posting time.`);
    }
    await postInventoryTransaction(tx, {
      productId: i.productId,
      quantity: -i.quantity,
      unitId: product.unitId,
      transactionType: "SALE",
      referenceDocument: invoiceNumber,
      notes: `Sold to ${customer.name}`,
    });
  }

  if (totals.total > 0) {
    await postCustomerLedger(tx, {
      customerId: input.customerId,
      date: input.date,
      type: "INVOICE",
      reference: invoiceNumber,
      referenceId: inv.id,
      credit: totals.total,
      notes: input.paymentMethod ? `${input.paymentMethod}${amountPaid > 0 ? ` • ${amountPaid.toFixed(2)} received` : ""}` : "Credit sale",
    });

    const isCash = input.paymentMethod === "Cash";
    const bankCode = accountCodeForMethod(input.paymentMethod);
    await postJournal(tx, {
      date: input.date,
      reference: invoiceNumber,
      description: `Sale to ${customer.name}`,
      lines: [
        ...(amountPaid > 0
          ? [{ account: bankCode, debit: amountPaid }]
          : []),
        ...(amountPaid < totals.total
          ? [{ account: ACC.AR, debit: round2(totals.total - amountPaid) }]
          : []),
        { account: ACC.SALES, credit: round2(totals.subtotal - totals.discount + totals.transport) },
        { account: ACC.VAT, credit: totals.tax },
        { account: ACC.COGS, debit: costOfGoods },
        { account: ACC.INVENTORY, credit: costOfGoods },
      ],
    });

    if (amountPaid > 0) {
      await recordBankMovement(tx, {
        method: input.paymentMethod,
        amount: amountPaid,
        direction: "IN",
        date: input.date,
        type: "PAYMENT_IN",
        reference: invoiceNumber,
        description: `Payment received from ${customer.name}`,
      });
    }
  }

  return inv;
}

export async function createInvoice(input: InvoiceInput) {
  return db.transaction(async (tx) => createInvoiceInternal(tx, input));
}

export async function cancelInvoice(id: number) {
  return db.transaction(async (tx) => {
    const [inv] = await tx.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    if (!inv) throw new Error("Invoice not found.");
    if (inv.isCancelled) return inv;

    const items = await tx.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id));
    for (const i of items) {
      const stock = await getProductStock(num(i.productId), null, tx);
      await postInventoryTransaction(tx, {
        productId: num(i.productId),
        quantity: num(i.quantity),
        unitId: i.unitId,
        transactionType: "RETURN_SALE",
        referenceDocument: `CANCEL-${inv.invoiceNumber}`,
        notes: "Invoice cancelled — stock returned",
      });
    }
    await postCustomerLedger(tx, {
      customerId: inv.customerId!,
      date: new Date(),
      type: "ADJUSTMENT",
      reference: `CANCEL-${inv.invoiceNumber}`,
      referenceId: id,
      debit: num(inv.totalAmount) - num(inv.amountPaid),
      notes: "Invoice cancelled",
    });
    // reverse the original journal (simple contra entry)
    await postJournal(tx, {
      date: new Date(),
      reference: `CANCEL-${inv.invoiceNumber}`,
      description: `Cancel sale ${inv.invoiceNumber}`,
      lines: [
        { account: ACC.SALES, debit: round2(num(inv.subtotal) - num(inv.discountAmount) + num(inv.transportAmount)) },
        { account: ACC.VAT, debit: num(inv.taxAmount) },
        { account: ACC.COGS, credit: num(inv.costOfGoods) },
        { account: ACC.INVENTORY, debit: num(inv.costOfGoods) },
        { account: ACC.AR, credit: round2(num(inv.totalAmount) - num(inv.amountPaid)) },
      ],
    });
    await tx.update(invoices).set({ isCancelled: true, status: "UNPAID", amountDue: "0.00" }).where(eq(invoices.id, id));
    await tx.insert(auditLogs).values({ action: "INVOICE_CANCELLED", tableName: "invoices", recordId: id, newValue: inv.invoiceNumber });
    return inv;
  });
}

export async function getInvoices() {
  return db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      date: invoices.date,
      dueDate: invoices.dueDate,
      status: invoices.status,
      totalAmount: invoices.totalAmount,
      amountPaid: invoices.amountPaid,
      amountDue: invoices.amountDue,
      isCancelled: invoices.isCancelled,
      customer: customers.name,
      itemCount: sql<string>`(select count(*) from invoice_items ii where ii.invoice_id = ${invoices.id})`,
    })
    .from(invoices)
    .leftJoin(customers, eq(invoices.customerId, customers.id))
    .orderBy(desc(invoices.id));
}

export async function getInvoice(id: number) {
  const [inv] = await db.select({ inv: invoices, customer: customers }).from(invoices).leftJoin(customers, eq(invoices.customerId, customers.id)).where(eq(invoices.id, id)).limit(1);
  if (!inv) return null;
  const items = await db
    .select({
      id: invoiceItems.id,
      productId: invoiceItems.productId,
      code: products.code,
      name: products.name,
      quantity: invoiceItems.quantity,
      unitId: invoiceItems.unitId,
      unit: units.symbol,
      unitPrice: invoiceItems.unitPrice,
      discount: invoiceItems.discount,
      taxRate: invoiceItems.taxRate,
      transport: invoiceItems.transport,
      unitCost: invoiceItems.unitCost,
      total: invoiceItems.total,
    })
    .from(invoiceItems)
    .leftJoin(products, eq(invoiceItems.productId, products.id))
    .leftJoin(units, eq(invoiceItems.unitId, units.id))
    .where(eq(invoiceItems.invoiceId, id))
    .orderBy(invoiceItems.id);
  return { ...inv.inv, customer: inv.customer, items };
}

export async function getOutstandingInvoices(customerId: number) {
  return db
    .select()
    .from(invoices)
    .where(and(eq(invoices.customerId, customerId), eq(invoices.isCancelled, false), eq(invoices.status, "UNPAID")))
    .orderBy(invoices.date);
}

/* ------------------------------------------------------------------ */
/* Sales returns                                                       */
/* ------------------------------------------------------------------ */

export async function getSalesReturns() {
  return db
    .select({
      id: salesReturns.id,
      returnNumber: salesReturns.returnNumber,
      date: salesReturns.date,
      totalAmount: salesReturns.totalAmount,
      condition: salesReturns.condition,
      reason: salesReturns.reason,
      customer: customers.name,
      invoiceNumber: invoices.invoiceNumber,
    })
    .from(salesReturns)
    .leftJoin(customers, eq(salesReturns.customerId, customers.id))
    .leftJoin(invoices, eq(salesReturns.originalInvoiceId, invoices.id))
    .orderBy(desc(salesReturns.id));
}

export async function getSalesReturn(id: number) {
  const [ret] = await db.select({ ret: salesReturns, customer: customers, invoiceNumber: invoices.invoiceNumber }).from(salesReturns).leftJoin(customers, eq(salesReturns.customerId, customers.id)).leftJoin(invoices, eq(salesReturns.originalInvoiceId, invoices.id)).where(eq(salesReturns.id, id)).limit(1);
  if (!ret) return null;
  const items = await db
    .select({
      id: salesReturnItems.id,
      code: products.code,
      name: products.name,
      unit: units.symbol,
      quantity: salesReturnItems.quantity,
      unitPrice: salesReturnItems.unitPrice,
      taxRate: salesReturnItems.taxRate,
      total: salesReturnItems.total,
    })
    .from(salesReturnItems)
    .leftJoin(products, eq(salesReturnItems.productId, products.id))
    .leftJoin(units, eq(products.unitId, units.id))
    .where(eq(salesReturnItems.returnId, id))
    .orderBy(salesReturnItems.id);
  return { ...ret.ret, customer: ret.customer, invoiceNumber: ret.invoiceNumber, items };
}

export async function createSalesReturn(input: CustomerReturnInput) {
  const items = input.items.filter((i) => i.quantity > 0);
  if (!items.length) throw new Error("Enter a return quantity for at least one product.");
  for (const i of items) {
    if (i.unitPrice < 0) throw new Error("Unit price cannot be negative.");
  }
  if (!input.reason) throw new Error("Please choose a reason for the return.");

  return db.transaction(async (tx) => {
    const [customer] = await tx.select().from(customers).where(eq(customers.id, input.customerId)).limit(1);
    if (!customer) throw new Error("Please choose a customer.");

    const productIds = [...new Set(items.map((i) => i.productId))];
    const prodRows = await tx.select().from(products).where(inArray(products.id, productIds));
    const prodById = new Map(prodRows.map((p) => [p.id, p]));

    const totals = calcTotals(items.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice, discount: 0, taxRate: i.taxRate })));
    const restock = input.condition === "RESELLABLE";
    const costOfReturn = round2(items.reduce((s, i) => s + num(prodById.get(i.productId)?.purchasePrice) * i.quantity, 0));
    const returnNumber = await nextDocNumber(tx, salesReturns, salesReturns.id, salesReturns.returnNumber, "SRET-");

    const [ret] = await tx
      .insert(salesReturns)
      .values({
        returnNumber,
        customerId: input.customerId,
        originalInvoiceId: input.invoiceId,
        date: input.date,
        subtotal: totals.subtotal.toFixed(2),
        taxAmount: totals.tax.toFixed(2),
        totalAmount: totals.total.toFixed(2),
        reason: `${input.reason}${input.notes ? ` - ${input.notes}` : ""}`,
        condition: input.condition,
      })
      .returning();

    for (const i of items) {
      const product = prodById.get(i.productId)!;
      const amounts = calcLine({ quantity: i.quantity, unitPrice: i.unitPrice, discount: 0, taxRate: i.taxRate });
      await tx.insert(salesReturnItems).values({
        returnId: ret.id,
        productId: i.productId,
        quantity: i.quantity.toFixed(4),
        unitPrice: i.unitPrice.toFixed(2),
        taxRate: i.taxRate.toFixed(2),
        total: amounts.total.toFixed(2),
      });
      if (restock) {
        await postInventoryTransaction(tx, {
          productId: i.productId,
          quantity: i.quantity,
          unitId: product.unitId,
          transactionType: "RETURN_SALE",
          referenceDocument: returnNumber,
          notes: `Returned by ${customer.name} (resellable)`,
        });
      }
    }

    await postCustomerLedger(tx, {
      customerId: input.customerId,
      date: input.date,
      type: "RETURN",
      reference: returnNumber,
      referenceId: ret.id,
      debit: totals.total,
      notes: `${input.reason} (${input.condition})`,
    });

    await postJournal(tx, {
      date: input.date,
      reference: returnNumber,
      description: `Sales return from ${customer.name}`,
      lines: [
        { account: ACC.AR, credit: totals.total },
        ...(restock ? [{ account: ACC.INVENTORY, debit: costOfReturn }] : []),
        { account: "4010", debit: round2(totals.total - (restock ? costOfReturn : 0)) },
      ],
    });

    return ret;
  });
}

/* ------------------------------------------------------------------ */
/* Customer payments                                                   */
/* ------------------------------------------------------------------ */

export async function getCustomerPayments() {
  return db
    .select({
      id: payments.id,
      paymentNumber: payments.paymentNumber,
      date: payments.date,
      amount: payments.amount,
      paymentMethod: payments.paymentMethod,
      reference: payments.reference,
      status: payments.status,
      chequeDate: payments.chequeDate,
      chequeCleared: payments.chequeCleared,
      notes: payments.notes,
      customer: customers.name,
      customerId: customers.id,
    })
    .from(payments)
    .innerJoin(customers, eq(payments.customerId, customers.id))
    .orderBy(desc(payments.id));
}

/** Marks a cheque payment as cashed in (cleared) or not. */
export async function toggleChequeCleared(id: number) {
  return db.transaction(async (tx) => {
    const [payment] = await tx.select().from(payments).where(eq(payments.id, id)).limit(1);
    if (!payment) throw new Error("Payment not found.");
    if (payment.paymentMethod !== "Cheque") throw new Error("Only cheque payments have a cleared status.");

    const next = !payment.chequeCleared;
    await tx.update(payments).set({ chequeCleared: next }).where(eq(payments.id, id));
    await tx.insert(auditLogs).values({
      action: "CHEQUE_STATUS_CHANGED",
      tableName: "payments",
      recordId: id,
      previousValue: payment.chequeCleared ? "Cleared" : "Not cleared",
      newValue: next ? "Cleared" : "Not cleared",
    });
    return next;
  });
}

function pickInvoicesToAllocate(invoicesList: InferSelectModel<typeof invoices>[], amount: number) {
  // FIFO across oldest due first, then oldest date
  const open = invoicesList
    .filter((i) => !i.isCancelled && (i.status === "UNPAID" || i.status === "PARTIALLY_PAID"))
    .sort((a, b) => {
      const ad = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      const bd = b.dueDate ? new Date(b.dueDate).getTime() : 0;
      return ad - bd || (a.date ? new Date(a.date).getTime() : 0) - (b.date ? new Date(b.date).getTime() : 0);
    });
  const allocations: { invoiceId: number; amount: number }[] = [];
  let remaining = amount;
  for (const inv of open) {
    if (remaining <= 0.005) break;
    const due = round2(num(inv.amountDue));
    const apply = Math.min(due, remaining);
    if (apply > 0.005) {
      allocations.push({ invoiceId: inv.id, amount: round2(apply) });
      remaining = round2(remaining - apply);
    }
  }
  return { allocations, leftover: round2(remaining) };
}

export async function recordCustomerPayment(input: CustomerPaymentInput) {
  if (!(input.amount > 0)) throw new Error("Payment amount must be greater than zero.");
  if (input.method === "Cheque" && !input.chequeDate) {
    throw new Error("A cheque payment needs a cheque date.");
  }
  return db.transaction(async (tx) => {
    const [customer] = await tx.select().from(customers).where(eq(customers.id, input.customerId)).limit(1);
    if (!customer) throw new Error("Please choose a customer.");

    const outstanding = num(customer.outstandingBalance);
    const { allocations, leftover } = pickInvoicesToAllocate(
      await tx.select().from(invoices).where(eq(invoices.customerId, input.customerId)),
      input.amount
    );
    if (!input.isAdvance && input.amount > outstanding + 0.005 && allocations.length > 0) {
      throw new Error(
        `The payment (${input.amount.toFixed(2)}) is more than the outstanding balance (${outstanding.toFixed(2)}). Tick "Advance payment" if you are paying ahead.`
      );
    }

    const paymentNumber = await nextDocNumber(tx, payments, payments.id, payments.paymentNumber, "CPAY-");
    const bankAccountId = await recordBankMovement(tx, {
      method: input.method,
      amount: input.amount,
      direction: "IN",
      date: input.date,
      type: "PAYMENT_IN",
      reference: paymentNumber,
      description: `Payment from ${customer.name}`,
    });

    const isCheque = input.method === "Cheque";

    const [payment] = await tx
      .insert(payments)
      .values({
        paymentNumber,
        customerId: input.customerId,
        bankAccountId,
        date: input.date,
        amount: input.amount.toFixed(2),
        paymentMethod: input.method,
        reference: input.reference,
        notes: input.notes,
        chequeDate: isCheque ? input.chequeDate : null,
        chequeCleared: false, // a cheque starts uncleared until the bank cashes it in
      })
      .returning();

    for (const a of allocations) {
      const inv = await tx.select().from(invoices).where(eq(invoices.id, a.invoiceId)).limit(1);
      if (!inv[0]) continue;
      const newPaid = round2(num(inv[0].amountPaid) + a.amount);
      const newDue = round2(num(inv[0].amountDue) - a.amount);
      const status = newDue <= 0.005 ? "PAID" : newPaid > 0 ? "PARTIALLY_PAID" : "UNPAID";
      await tx.update(invoices).set({ amountPaid: newPaid.toFixed(2), amountDue: newDue.toFixed(2), status }).where(eq(invoices.id, a.invoiceId));
      await tx.insert(paymentAllocations).values({ paymentId: payment.id, invoiceId: a.invoiceId, amountAllocated: a.amount.toFixed(2) });
    }
    // leftover (advance) is simply applied as a debit on the ledger
    await postCustomerLedger(tx, {
      customerId: input.customerId,
      date: input.date,
      type: "PAYMENT",
      reference: paymentNumber,
      referenceId: payment.id,
      debit: input.amount,
      notes: `${input.method}${input.reference ? ` • ${input.reference}` : ""}${
        input.method === "Cheque" && input.chequeDate ? ` • cheque dated ${input.chequeDate.toISOString().slice(0, 10)}` : ""
      }${leftover > 0 ? " • advance" : ""}`,
    });

    await postJournal(tx, {
      date: input.date,
      reference: paymentNumber,
      description: `Payment from ${customer.name} (${input.method})`,
      lines: [
        { account: accountCodeForMethod(input.method), debit: input.amount },
        { account: ACC.AR, credit: input.amount },
      ],
    });

    return payment;
  });
}

export async function voidCustomerPayment(id: number) {
  return db.transaction(async (tx) => {
    const [payment] = await tx.select().from(payments).where(eq(payments.id, id)).limit(1);
    if (!payment) throw new Error("Payment not found.");
    if (payment.status === "VOID") return payment;

    const allocations = await tx.select().from(paymentAllocations).where(eq(paymentAllocations.paymentId, id));
    for (const a of allocations) {
      const [inv] = await tx.select().from(invoices).where(eq(invoices.id, a.invoiceId!)).limit(1);
      if (!inv) continue;
      const newPaid = round2(num(inv.amountPaid) - num(a.amountAllocated));
      const newDue = round2(num(inv.amountDue) + num(a.amountAllocated));
      const status = newDue <= 0.005 ? "PAID" : newPaid > 0 ? "PARTIALLY_PAID" : "UNPAID";
      await tx.update(invoices).set({ amountPaid: newPaid.toFixed(2), amountDue: newDue.toFixed(2), status }).where(eq(invoices.id, a.invoiceId!));
    }

    const [cust] = await tx.select().from(customers).where(eq(customers.id, payment.customerId!)).limit(1);
    if (cust) {
      await tx.update(customers).set({ outstandingBalance: round2(num(cust.outstandingBalance) + num(payment.amount)).toFixed(2) }).where(eq(customers.id, cust.id));
    }
    await tx.update(payments).set({ status: "VOID" }).where(eq(payments.id, id));
    await tx.insert(auditLogs).values({ action: "PAYMENT_VOID", tableName: "payments", recordId: id, newValue: payment.paymentNumber });
    return payment;
  });
}
