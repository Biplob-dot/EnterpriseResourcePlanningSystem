"use server";

import { db } from "@/db";
import { suppliers, auditLogs } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseDateInput } from "@/lib/calc";
import { parseCsv } from "@/lib/csv";
import {
  confirmGoodsReceipt,
  createPurchaseOrder,
  createPurchaseReturn,
  postSupplierLedger,
  recordSupplierPayment,
  setPurchaseOrderStatus,
  updatePurchaseOrder,
  type GrnLineInput,
  type LineInput,
  type ReturnLineInput,
} from "@/lib/services/purchasing";

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

/* ------------------------------ Suppliers ------------------------------ */

export async function saveSupplier(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = numOrNull(fd, "id");
  const name = str(fd, "name");
  if (!name) return { error: "Supplier name is required." };

  const values = {
    name,
    companyName: str(fd, "companyName") || null,
    contactPerson: str(fd, "contactPerson") || null,
    phone: str(fd, "phone") || null,
    email: str(fd, "email") || null,
    address: str(fd, "address") || null,
    panVatNumber: str(fd, "panVatNumber") || null,
    paymentTerms: str(fd, "paymentTerms") || null,
    creditPeriod: numOrNull(fd, "creditPeriod"),
    notes: str(fd, "notes") || null,
    isActive: str(fd, "isActive") !== "false",
  };

  let savedId = id;
  try {
    if (id) {
      await db.update(suppliers).set(values).where(eq(suppliers.id, id));
    } else {
      const opening = numOrNull(fd, "openingBalance") ?? 0;
      savedId = await db.transaction(async (tx) => {
        const [created] = await tx.insert(suppliers).values(values).returning();
        if (opening > 0) {
          await postSupplierLedger(tx, {
            supplierId: created.id,
            date: new Date(),
            type: "OPENING",
            reference: "OPENING",
            credit: opening,
            notes: "Opening balance when the supplier was added",
          });
        }
        await tx.insert(auditLogs).values({
          action: "SUPPLIER_CREATED",
          tableName: "suppliers",
          recordId: created.id,
          newValue: created.name,
        });
        return created.id;
      });
    }
  } catch (e) {
    return { error: friendly(e, "Unable to save the supplier. Please check the details and try again.") };
  }

  revalidatePath("/purchasing/suppliers");
  redirect(`/purchasing/suppliers/${savedId}?saved=Supplier+saved`);
}

export async function toggleSupplierActive(fd: FormData) {
  const id = Number(fd.get("id"));
  const [s] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
  if (!s) return;
  await db.update(suppliers).set({ isActive: !s.isActive }).where(eq(suppliers.id, id));
  revalidatePath("/purchasing/suppliers");
  redirect(`/purchasing/suppliers/${id}?saved=${s.isActive ? "Supplier+deactivated" : "Supplier+activated"}`);
}

/** Whether a supplier has any activity that must be preserved. */
async function supplierHasHistory(id: number): Promise<boolean> {
  const result: any = await db.execute(sql`
    select (
      exists(select 1 from purchase_orders where supplier_id = ${id})
      or exists(select 1 from goods_receipts where supplier_id = ${id})
      or exists(select 1 from purchase_returns where supplier_id = ${id})
      or exists(select 1 from payments where supplier_id = ${id})
      or exists(select 1 from supplier_transactions where supplier_id = ${id})
    ) as has_history
  `);
  const rows = Array.isArray(result) ? result : result?.rows ?? [];
  return rows[0]?.has_history === true;
}

export async function deleteSupplier(fd: FormData) {
  const id = Number(fd.get("id"));
  const [s] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
  if (!s) redirect("/purchasing/suppliers?error=Supplier+not+found");

  // Protect purchasing history: deactivate instead of deleting when a supplier
  // has orders, receipts, returns or payments.
  if (await supplierHasHistory(id)) {
    await db.update(suppliers).set({ isActive: false }).where(eq(suppliers.id, id));
    await db.insert(auditLogs).values({
      action: "SUPPLIER_DEACTIVATED",
      tableName: "suppliers",
      recordId: id,
      newValue: `${s.name} deactivated (has history, cannot delete)`,
    });
    revalidatePath("/purchasing/suppliers");
    redirect("/purchasing/suppliers?saved=" + encodeURIComponent(`"${s.name}" has transactions, so it was deactivated instead of deleted.`));
  }

  await db.delete(suppliers).where(eq(suppliers.id, id));
  await db.insert(auditLogs).values({
    action: "SUPPLIER_DELETED",
    tableName: "suppliers",
    recordId: id,
    previousValue: s.name,
  });
  revalidatePath("/purchasing/suppliers");
  redirect("/purchasing/suppliers?saved=" + encodeURIComponent(`"${s.name}" was deleted.`));
}

export async function importSuppliersCsv(_prev: FormState, fd: FormData): Promise<FormState> {
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
    const name = get("name", "suppliername");
    if (!name) {
      errors.push(`Row ${i + 2}: missing supplier name — skipped.`);
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
      address: get("address") || null,
      panVatNumber: get("pan", "vat", "panvat", "panvatnumber") || null,
      paymentTerms: get("paymentterms", "terms") || null,
      creditPeriod: numOr(get("creditperiod", "credit"), 30),
      notes: get("notes") || null,
      isActive: true,
    };

    try {
      // Match by name (case-insensitive) so re-imports update rather than duplicate.
      const [existing] = await db
        .select({ id: suppliers.id })
        .from(suppliers)
        .where(sql`lower(${suppliers.name}) = ${name.toLowerCase()}`)
        .limit(1);
      if (existing) {
        await db.update(suppliers).set(values).where(eq(suppliers.id, existing.id));
        updated++;
      } else {
        const opening = numOr(get("openingbalance", "opening", "balance"), 0) ?? 0;
        await db.transaction(async (tx) => {
          const [createdSupplier] = await tx.insert(suppliers).values(values).returning();
          if (opening > 0) {
            // postSupplierLedger updates the running balance for us.
            await postSupplierLedger(tx, {
              supplierId: createdSupplier.id,
              date: new Date(),
              type: "OPENING",
              reference: "CSV-IMPORT",
              credit: opening,
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
    action: "SUPPLIERS_IMPORTED",
    tableName: "suppliers",
    newValue: `Imported CSV: ${created} added, ${updated} updated, ${errors.length} skipped`,
  });

  revalidatePath("/purchasing/suppliers");
  const summary = `${created} added, ${updated} updated${errors.length ? `, ${errors.length} skipped` : ""}.`;
  if (errors.length > 0 && created === 0 && updated === 0) {
    return { error: `Nothing imported. ${errors.slice(0, 5).join(" ")}` };
  }
  return { success: `Import complete: ${summary}${errors.length ? " " + errors.slice(0, 3).join(" ") : ""}` };
}

/* --------------------------- Purchase orders --------------------------- */

function parseLines(raw: string): LineInput[] {
  return parseJson<Record<string, unknown>>(raw)
    .map((l) => ({
      productId: n(l.productId),
      quantity: n(l.quantity),
      unitId: l.unitId ? n(l.unitId) : null,
      unitPrice: n(l.unitPrice),
      discount: n(l.discount),
      taxRate: n(l.taxRate),
    }))
    .filter((l) => l.productId > 0);
}

export async function savePurchaseOrder(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = numOrNull(fd, "id");
  const supplierId = numOrNull(fd, "supplierId");
  if (!supplierId) return { error: "Please choose a supplier." };

  const items = parseLines(str(fd, "payload"));
  const intent = str(fd, "intent") === "ordered" ? "ORDERED" : "DRAFT";

  const input = {
    supplierId,
    date: parseDateInput(str(fd, "date"))!,
    expectedDeliveryDate: parseDateInput(str(fd, "expectedDeliveryDate"), null),
    notes: str(fd, "notes") || null,
    status: intent as "DRAFT" | "ORDERED",
    items,
  };

  let savedId = id;
  try {
    if (id) {
      await updatePurchaseOrder(id, input);
    } else {
      const po = await createPurchaseOrder(input);
      savedId = po.id;
    }
  } catch (e) {
    return { error: friendly(e, "Unable to save the purchase order.") };
  }

  revalidatePath("/purchasing/pos");
  redirect(`/purchasing/pos/${savedId}?saved=${intent === "ORDERED" ? "Purchase+order+saved+and+marked+as+ordered" : "Draft+saved"}`);
}

export async function changePoStatus(fd: FormData) {
  const id = Number(fd.get("id"));
  const status = str(fd, "status") as "ORDERED" | "CANCELLED" | "RECEIVED";
  try {
    await setPurchaseOrderStatus(id, status);
  } catch (e) {
    redirect(`/purchasing/pos/${id}?error=${encodeURIComponent(friendly(e, "Unable to change the status."))}`);
  }
  revalidatePath("/purchasing/pos");
  const label = status === "ORDERED" ? "Order+sent+to+supplier" : status === "CANCELLED" ? "Order+cancelled" : "Order+marked+as+complete";
  redirect(`/purchasing/pos/${id}?saved=${label}`);
}

/* --------------------------- Goods receipts ---------------------------- */

export async function submitGrn(_prev: FormState, fd: FormData): Promise<FormState> {
  const supplierId = numOrNull(fd, "supplierId");
  if (!supplierId) return { error: "Please choose a supplier." };

  const items: GrnLineInput[] = parseJson<Record<string, unknown>>(str(fd, "payload"))
    .map((l) => ({
      productId: n(l.productId),
      poItemId: l.poItemId ? n(l.poItemId) : null,
      quantityReceived: n(l.quantityReceived),
      quantityDamaged: n(l.quantityDamaged),
      unitPrice: n(l.unitPrice),
      discount: n(l.discount),
      taxRate: n(l.taxRate),
      warehouseId: l.warehouseId ? n(l.warehouseId) : null,
      binId: l.binId ? n(l.binId) : null,
      batchNumber: typeof l.batchNumber === "string" && l.batchNumber.trim() ? l.batchNumber.trim() : null,
    }))
    .filter((l) => l.productId > 0);

  let grnId: number;
  try {
    const grn = await confirmGoodsReceipt({
      supplierId,
      poId: numOrNull(fd, "poId"),
      date: parseDateInput(str(fd, "date"))!,
      notes: str(fd, "notes") || null,
      updateCost: str(fd, "updateCost") === "on",
      items,
    });
    grnId = grn.id;
  } catch (e) {
    return { error: friendly(e, "Unable to confirm the goods receipt. Nothing was saved.") };
  }

  revalidatePath("/purchasing/grn");
  revalidatePath("/purchasing/pos");
  revalidatePath("/inventory/stock");
  redirect(`/purchasing/grn/${grnId}?saved=Goods+received+and+stock+updated`);
}

/* --------------------------- Purchase returns -------------------------- */

export async function submitPurchaseReturn(_prev: FormState, fd: FormData): Promise<FormState> {
  const supplierId = numOrNull(fd, "supplierId");
  if (!supplierId) return { error: "Please choose a supplier." };

  const items: ReturnLineInput[] = parseJson<Record<string, unknown>>(str(fd, "payload"))
    .map((l) => ({
      productId: n(l.productId),
      quantity: n(l.quantity),
      unitPrice: n(l.unitPrice),
      taxRate: n(l.taxRate),
    }))
    .filter((l) => l.productId > 0);

  let retId: number;
  try {
    const ret = await createPurchaseReturn({
      supplierId,
      grnId: numOrNull(fd, "grnId"),
      date: parseDateInput(str(fd, "date"))!,
      reason: str(fd, "reason"),
      notes: str(fd, "notes") || null,
      items,
    });
    retId = ret.id;
  } catch (e) {
    return { error: friendly(e, "Unable to record the return. Nothing was saved.") };
  }

  revalidatePath("/purchasing/returns");
  revalidatePath("/inventory/stock");
  redirect(`/purchasing/returns/${retId}?saved=Return+recorded+and+stock+updated`);
}

/* --------------------------- Supplier payments ------------------------- */

export async function submitSupplierPayment(_prev: FormState, fd: FormData): Promise<FormState> {
  const supplierId = numOrNull(fd, "supplierId");
  if (!supplierId) return { error: "Please choose a supplier." };
  const amount = numOrNull(fd, "amount");
  if (!amount || amount <= 0) return { error: "Enter an amount greater than zero." };

  try {
    await recordSupplierPayment({
      supplierId,
      date: parseDateInput(str(fd, "date"))!,
      amount,
      method: str(fd, "method") || "Cash",
      reference: str(fd, "reference") || null,
      notes: str(fd, "notes") || null,
      isAdvance: str(fd, "isAdvance") === "on",
    });
  } catch (e) {
    return { error: friendly(e, "Unable to record the payment. Nothing was saved.") };
  }

  revalidatePath("/purchasing/suppliers");
  revalidatePath("/purchasing/payments");
  redirect(`/purchasing/suppliers/${supplierId}?saved=Payment+recorded`);
}
