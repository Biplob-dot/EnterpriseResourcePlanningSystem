"use server";

import { db } from "@/db";
import { customers, auditLogs } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseDateInput } from "@/lib/calc";
import { parseCsv } from "@/lib/csv";
import { postCustomerLedger } from "@/lib/services/sales";
import {
  cancelInvoice,
  convertQuotation,
  createDeliveryNote,
  createInvoice,
  createQuotation,
  createSalesOrder,
  createSalesReturn,
  recordCustomerPayment,
  setQuoteStatus,
  setSoStatus,
  voidCustomerPayment,
  toggleChequeCleared,
  type LineInput,
  type ReturnLineInput,
} from "@/lib/services/sales";

export type FormState = { error?: string; success?: string };

const str = (fd: FormData, key: string) => (fd.get(key)?.toString() ?? "").trim();
const numOrNull = (fd: FormData, key: string) => {
  const v = str(fd, key);
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const n = (v: unknown, fallback = 0) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
};

function parseJson<T>(raw: string): T[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}
function friendly(e: unknown, fallback: string): string {
  const msg = e instanceof Error ? e.message : "";
  if (!msg || msg.includes("violates") || msg.includes("syntax")) return fallback;
  return msg;
}
function parseLines(raw: string): LineInput[] {
  return parseJson<Record<string, unknown>>(raw)
    .map((l) => ({
      productId: n(l.productId),
      quantity: n(l.quantity),
      unitId: l.unitId ? n(l.unitId) : null,
      unitPrice: n(l.unitPrice),
      discount: n(l.discount),
      taxRate: n(l.taxRate),
      transport: n(l.transport),
    }))
    .filter((l) => l.productId > 0);
}

/* ------------------------------ Customers ------------------------------ */

export async function saveCustomer(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = numOrNull(fd, "id");
  const name = str(fd, "name");
  if (!name) return { error: "Customer name is required." };

  const values = {
    name,
    companyName: str(fd, "companyName") || null,
    contactPerson: str(fd, "contactPerson") || null,
    phone: str(fd, "phone") || null,
    email: str(fd, "email") || null,
    address: str(fd, "address") || null,
    panVatNumber: str(fd, "panVatNumber") || null,
    notes: str(fd, "notes") || null,
    isActive: str(fd, "isActive") !== "false",
  };

  let savedId = id;
  try {
    if (id) {
      await db.update(customers).set(values).where(eq(customers.id, id));
    } else {
      const opening = numOrNull(fd, "openingBalance") ?? 0;
      const [created] = await db
        .insert(customers)
        .values({ ...values, outstandingBalance: opening.toFixed(2) })
        .returning();
      savedId = created.id;
      if (opening > 0) {
        await db.insert(auditLogs).values({
          action: "CUSTOMER_CREATED",
          tableName: "customers",
          recordId: created.id,
          newValue: `${created.name} • opening ${opening.toFixed(2)}`,
        });
      }
    }
  } catch (e) {
    return { error: friendly(e, "Unable to save the customer. Please check the details and try again.") };
  }
  revalidatePath("/sales/customers");
  redirect(`/sales/customers/${savedId}?saved=Customer+saved`);
}

export async function toggleCustomerActive(fd: FormData) {
  const id = Number(fd.get("id"));
  const [c] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  if (!c) return;
  await db.update(customers).set({ isActive: !c.isActive }).where(eq(customers.id, id));
  revalidatePath("/sales/customers");
  redirect(`/sales/customers/${id}?saved=${c.isActive ? "Customer+deactivated" : "Customer+activated"}`);
}

export async function importCustomersCsv(_prev: FormState, fd: FormData): Promise<FormState> {
  const raw = str(fd, "csv");
  if (!raw) return { error: "Paste CSV text or choose a .csv file to import." };

  let rows: Record<string, string>[];
  try {
    rows = parseCsv(raw);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not read the CSV." };
  }
  if (rows.length === 0) return { error: "The file has no data rows." };

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const get = (...keys: string[]) => {
      for (const k of keys) {
        const found = Object.keys(r).find((c) => c.toLowerCase().replace(/[\s_]/g, "") === k.toLowerCase().replace(/[\s_]/g, ""));
        if (found && r[found] !== undefined && r[found] !== "") return r[found].trim();
      }
      return "";
    };
    const name = get("name", "customername");
    if (!name) {
      errors.push(`Row ${i + 2}: missing customer name — skipped.`);
      continue;
    }
    const numOr = (v: string, d: number | null) => {
      if (v === "") return d;
      const x = Number(v);
      return Number.isFinite(x) ? x : d;
    };

    const values = {
      name,
      companyName: get("company", "companyname") || null,
      contactPerson: get("contact", "contactperson") || null,
      phone: get("phone", "mobile") || null,
      email: get("email") || null,
      // Accepts address / address1 / street / full address / delivery address,
      // and joins a second line if the file provides one.
      address: [get("address", "address1", "street", "streetaddress", "fulladdress", "deliveryaddress", "billingaddress"), get("address2")].filter(Boolean).join(", ") || null,
      panVatNumber: get("pan", "vat", "panvat", "panvatnumber") || null,
      notes: get("notes") || null,
      isActive: true,
    };

    try {
      // Match by name (case-insensitive) so re-imports update rather than duplicate.
      const [existing] = await db
        .select({ id: customers.id })
        .from(customers)
        .where(sql`lower(${customers.name}) = ${name.toLowerCase()}`)
        .limit(1);
      if (existing) {
        await db.update(customers).set(values).where(eq(customers.id, existing.id));
        updated++;
      } else {
        const opening = numOr(get("openingbalance", "opening", "balance"), 0) ?? 0;
        await db.transaction(async (tx) => {
          const [createdCustomer] = await tx.insert(customers).values(values).returning();
          if (opening > 0) {
            // postCustomerLedger updates the running balance for us.
            await postCustomerLedger(tx, {
              customerId: createdCustomer.id,
              date: new Date(),
              type: "OPENING",
              reference: "CSV-IMPORT",
              credit: opening, // amount the customer already owes us
              notes: "Opening balance from CSV import",
            });
          }
        });
        created++;
      }
    } catch {
      errors.push(`Row ${i + 2} (${name}): could not save.`);
    }
  }

  await db.insert(auditLogs).values({
    action: "CUSTOMERS_IMPORTED",
    tableName: "customers",
    newValue: `Imported CSV: ${created} added, ${updated} updated, ${errors.length} skipped`,
  });

  revalidatePath("/sales/customers");
  const summary = `${created} added, ${updated} updated${errors.length ? `, ${errors.length} skipped` : ""}.`;
  if (errors.length > 0 && created === 0 && updated === 0) {
    return { error: `Nothing imported. ${errors.slice(0, 5).join(" ")}` };
  }
  return { success: `Import complete: ${summary}${errors.length ? " " + errors.slice(0, 3).join(" ") : ""}` };
}

/* ------------------------------ Quotations ----------------------------- */

export async function saveQuotation(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = numOrNull(fd, "id");
  const customerId = numOrNull(fd, "customerId");
  if (!customerId) return { error: "Please choose a customer." };
  const intent = str(fd, "intent") === "sent" ? "SENT" : "DRAFT";
  const items = parseLines(str(fd, "payload"));
  let savedId = id;
  try {
    if (id) {
      return { error: "Editing is not available for quotations — create a new one instead." };
    }
    const q = await createQuotation({
      customerId,
      date: parseDateInput(str(fd, "date"))!,
      validUntil: parseDateInput(str(fd, "validUntil"), null),
      status: intent as "DRAFT" | "SENT",
      notes: str(fd, "notes") || null,
      items,
    });
    savedId = q.id;
  } catch (e) {
    return { error: friendly(e, "Unable to save the quotation.") };
  }
  revalidatePath("/sales/quotations");
  redirect(`/sales/quotations/${savedId}?saved=${intent === "SENT" ? "Quotation+saved+and+marked+as+sent" : "Draft+saved"}`);
}

export async function changeQuoteStatus(fd: FormData) {
  const id = Number(fd.get("id"));
  const status = str(fd, "status") as "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED";
  try {
    await setQuoteStatus(id, status);
  } catch (e) {
    redirect(`/sales/quotations/${id}?error=${encodeURIComponent(friendly(e, "Unable to change the status."))}`);
  }
  revalidatePath("/sales/quotations");
  redirect(`/sales/quotations/${id}?saved=Quotation+marked+${status.toLowerCase()}`);
}

export async function convertQuote(fd: FormData) {
  const id = Number(fd.get("id"));
  const target = str(fd, "target") as "SALES_ORDER" | "INVOICE";
  try {
    const res = await convertQuotation(id, target);
    revalidatePath("/sales/quotations");
    revalidatePath("/sales/invoices");
    revalidatePath("/sales/orders");
    redirect(`/${target === "INVOICE" ? "sales/invoices" : "sales/orders"}/${res.targetId}?saved=Quotation+converted+to+${target === "INVOICE" ? "invoice" : "sales+order"}`);
  } catch (e) {
    redirect(`/sales/quotations/${id}?error=${encodeURIComponent(friendly(e, "Unable to convert the quotation."))}`);
  }
}

/* ------------------------------ Sales orders --------------------------- */

export async function saveSalesOrder(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = numOrNull(fd, "id");
  const customerId = numOrNull(fd, "customerId");
  if (!customerId) return { error: "Please choose a customer." };
  const items = parseLines(str(fd, "payload"));
  const intent = str(fd, "intent") === "confirmed" ? "CONFIRMED" : "DRAFT";
  let savedId = id;
  try {
    const so = await createSalesOrder({
      customerId,
      quoteId: numOrNull(fd, "quoteId"),
      date: parseDateInput(str(fd, "date"))!,
      deliveryDate: parseDateInput(str(fd, "deliveryDate"), null),
      status: intent as "DRAFT" | "CONFIRMED",
      notes: str(fd, "notes") || null,
      items,
    });
    savedId = so.id;
  } catch (e) {
    return { error: friendly(e, "Unable to save the sales order.") };
  }
  revalidatePath("/sales/orders");
  redirect(`/sales/orders/${savedId}?saved=${intent === "CONFIRMED" ? "Sales+order+confirmed" : "Draft+saved"}`);
}

export async function changeSoStatus(fd: FormData) {
  const id = Number(fd.get("id"));
  const status = str(fd, "status") as "CONFIRMED" | "CANCELLED" | "COMPLETED";
  try {
    await setSoStatus(id, status);
  } catch (e) {
    redirect(`/sales/orders/${id}?error=${encodeURIComponent(friendly(e, "Unable to change the status."))}`);
  }
  revalidatePath("/sales/orders");
  redirect(`/sales/orders/${id}?saved=Order+marked+${status.toLowerCase()}`);
}

/* ------------------------------ Delivery notes ------------------------- */

export async function submitDeliveryNote(_prev: FormState, fd: FormData): Promise<FormState> {
  const customerId = numOrNull(fd, "customerId");
  if (!customerId) return { error: "Please choose a customer." };
  const items = parseJson<Record<string, unknown>>(str(fd, "payload"))
    .map((l) => ({
      soItemId: l.soItemId ? n(l.soItemId) : null,
      productId: n(l.productId),
      quantity: n(l.quantity),
      unitId: l.unitId ? n(l.unitId) : null,
    }))
    .filter((l) => l.productId > 0);
  try {
    await createDeliveryNote({
      customerId,
      soId: numOrNull(fd, "soId"),
      invoiceId: numOrNull(fd, "invoiceId"),
      date: parseDateInput(str(fd, "date"))!,
      address: str(fd, "address") || null,
      notes: str(fd, "notes") || null,
      items,
    });
  } catch (e) {
    return { error: friendly(e, "Unable to record the delivery. Nothing was saved.") };
  }
  revalidatePath("/sales/delivery");
  revalidatePath("/sales/orders");
  redirect("/sales/delivery?saved=Delivery+note+created");
}

/* ------------------------------ Invoices ------------------------------ */

export async function submitInvoice(_prev: FormState, fd: FormData): Promise<FormState> {
  const customerId = numOrNull(fd, "customerId");
  if (!customerId) return { error: "Please choose a customer." };
  const items = parseLines(str(fd, "payload"));
  if (items.length === 0) return { error: "Add at least one product to the invoice." };

  const method = str(fd, "paymentMethod") || null;
  const amountPaid = numOrNull(fd, "amountPaid") ?? 0;

  try {
    const inv = await createInvoice({
      customerId,
      date: parseDateInput(str(fd, "date"))!,
      dueDate: parseDateInput(str(fd, "dueDate"), null),
      soId: numOrNull(fd, "soId"),
      quoteId: numOrNull(fd, "quoteId"),
      items,
      paymentMethod: method,
      amountPaid,
      notes: str(fd, "notes") || null,
    });
    revalidatePath("/sales/invoices");
    revalidatePath("/inventory/stock");
    revalidatePath("/sales/customers");
    redirect(`/sales/invoices/${inv.id}?saved=Invoice+created`);
  } catch (e) {
    return { error: friendly(e, "Unable to create the invoice. Nothing was saved.") };
  }
}

export async function cancelInvoiceAction(fd: FormData) {
  const id = Number(fd.get("id"));
  try {
    await cancelInvoice(id);
  } catch (e) {
    redirect(`/sales/invoices/${id}?error=${encodeURIComponent(friendly(e, "Unable to cancel the invoice."))}`);
  }
  revalidatePath("/sales/invoices");
  revalidatePath("/sales/customers");
  redirect(`/sales/invoices/${id}?saved=Invoice+cancelled+and+stock+returned`);
}

/* ------------------------------ Sales returns -------------------------- */

export async function submitSalesReturn(_prev: FormState, fd: FormData): Promise<FormState> {
  const customerId = numOrNull(fd, "customerId");
  if (!customerId) return { error: "Please choose a customer." };
  const items: ReturnLineInput[] = parseJson<Record<string, unknown>>(str(fd, "payload"))
    .map((l) => ({ productId: n(l.productId), quantity: n(l.quantity), unitPrice: n(l.unitPrice), taxRate: n(l.taxRate) }))
    .filter((l) => l.productId > 0);
  try {
    const ret = await createSalesReturn({
      customerId,
      invoiceId: numOrNull(fd, "invoiceId"),
      date: parseDateInput(str(fd, "date"))!,
      reason: str(fd, "reason"),
      condition: (str(fd, "condition") as "RESELLABLE" | "DAMAGED" | "SCRAP") || "RESELLABLE",
      notes: str(fd, "notes") || null,
      items,
    });
    revalidatePath("/sales/returns");
    revalidatePath("/inventory/stock");
    revalidatePath("/sales/customers");
    redirect(`/sales/returns/${ret.id}?saved=Sales+return+recorded`);
  } catch (e) {
    return { error: friendly(e, "Unable to record the return. Nothing was saved.") };
  }
}

/* ------------------------------ Customer payments ---------------------- */

export async function submitCustomerPayment(_prev: FormState, fd: FormData): Promise<FormState> {
  const customerId = numOrNull(fd, "customerId");
  if (!customerId) return { error: "Please choose a customer." };
  const amount = numOrNull(fd, "amount");
  if (!amount || amount <= 0) return { error: "Enter an amount greater than zero." };
  try {
    const method = str(fd, "method") || "Cash";
    const chequeDateRaw = str(fd, "chequeDate");
    if (method === "Cheque" && !chequeDateRaw) {
      return { error: "A cheque payment needs a cheque date." };
    }
    await recordCustomerPayment({
      customerId,
      date: parseDateInput(str(fd, "date"))!,
      amount,
      method,
      reference: str(fd, "reference") || null,
      notes: str(fd, "notes") || null,
      isAdvance: str(fd, "isAdvance") === "on",
      chequeDate: method === "Cheque" ? parseDateInput(chequeDateRaw) : null,
    });
  } catch (e) {
    return { error: friendly(e, "Unable to record the payment. Nothing was saved.") };
  }
  revalidatePath("/sales/payments");
  revalidatePath("/sales/customers");
  redirect(`/sales/customers/${customerId}?saved=Payment+recorded`);
}

export async function voidPaymentAction(fd: FormData) {
  const id = Number(fd.get("id"));
  try {
    await voidCustomerPayment(id);
  } catch (e) {
    redirect(`/sales/payments?saved=${encodeURIComponent(friendly(e, "Unable to void the payment."))}`);
  }
  revalidatePath("/sales/payments");
  revalidatePath("/sales/customers");
  redirect("/sales/payments?saved=Payment+voided");
}

export async function toggleChequeStatusAction(fd: FormData) {
  const id = Number(fd.get("id"));
  let cleared = false;
  try {
    cleared = await toggleChequeCleared(id);
  } catch (e) {
    redirect(`/sales/payments?error=${encodeURIComponent(friendly(e, "Unable to update the cheque status."))}`);
  }
  // redirect() throws, so it must stay outside the try block above.
  revalidatePath("/sales/payments");
  revalidatePath("/sales/customers");
  redirect(`/sales/payments?saved=${cleared ? "Cheque+marked+as+cashed+in" : "Cheque+marked+as+not+cashed+in"}`);
}
