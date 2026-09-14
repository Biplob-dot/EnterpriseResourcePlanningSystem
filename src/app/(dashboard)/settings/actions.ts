"use server";

import { db } from "@/db";
import { settings, auditLogs, units, warehouses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { resetBusinessData, type ResetScope } from "@/lib/services/reset";

export type SettingsState = { error?: string; success?: string };

const str = (fd: FormData, k: string) => (fd.get(k)?.toString() ?? "").trim();
const numOrNull = (fd: FormData, k: string) => {
  const v = str(fd, k);
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function friendly(e: unknown, fallback: string): string {
  const msg = e instanceof Error ? e.message : "";
  if (!msg || msg.includes("violates") || msg.includes("syntax")) return fallback;
  return msg;
}

export async function saveBusinessSettings(_prev: SettingsState, fd: FormData): Promise<SettingsState> {
  const businessName = str(fd, "businessName");
  if (!businessName) return { error: "Business name is required." };

  const values = {
    businessName,
    address: str(fd, "address") || null,
    phone: str(fd, "phone") || null,
    email: str(fd, "email") || null,
    panVatNumber: str(fd, "panVatNumber") || null,
    logoUrl: str(fd, "logoUrl") || null,
  };

  try {
    const [existing] = await db.select({ id: settings.id }).from(settings).limit(1);
    if (existing) {
      await db.update(settings).set(values).where(eq(settings.id, existing.id));
    } else {
      await db.insert(settings).values(values);
    }
  } catch (e) {
    return { error: friendly(e, "Unable to save business settings.") };
  }
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { success: "Business details saved. They now appear on your documents." };
}

export async function saveInvoiceSettings(_prev: SettingsState, fd: FormData): Promise<SettingsState> {
  const startingInvoiceNumber = numOrNull(fd, "startingInvoiceNumber");
  if (startingInvoiceNumber !== null && startingInvoiceNumber < 1) {
    return { error: "Starting invoice number must be 1 or more." };
  }

  const values = {
    invoicePrefix: str(fd, "invoicePrefix") || "INV-",
    startingInvoiceNumber: startingInvoiceNumber ?? 1,
    invoiceFooter: str(fd, "invoiceFooter") || null,
    termsAndConditions: str(fd, "termsAndConditions") || null,
  };

  try {
    const [existing] = await db.select({ id: settings.id }).from(settings).limit(1);
    if (existing) await db.update(settings).set(values).where(eq(settings.id, existing.id));
    else await db.insert(settings).values({ businessName: "My Business", ...values });
  } catch (e) {
    return { error: friendly(e, "Unable to save invoice settings.") };
  }
  revalidatePath("/settings");
  return { success: "Invoice settings saved." };
}

export async function saveInventorySettings(_prev: SettingsState, fd: FormData): Promise<SettingsState> {
  const lowStock = numOrNull(fd, "lowStockThreshold");
  if (lowStock !== null && lowStock < 0) return { error: "Low-stock threshold cannot be negative." };

  const values = {
    defaultUnitId: numOrNull(fd, "defaultUnitId"),
    defaultWarehouseId: numOrNull(fd, "defaultWarehouseId"),
    lowStockThreshold: lowStock ?? 10,
  };

  try {
    const [existing] = await db.select({ id: settings.id }).from(settings).limit(1);
    if (existing) await db.update(settings).set(values).where(eq(settings.id, existing.id));
    else await db.insert(settings).values({ businessName: "My Business", ...values });
  } catch (e) {
    return { error: friendly(e, "Unable to save inventory settings.") };
  }
  revalidatePath("/settings");
  return { success: "Inventory defaults saved." };
}

export async function saveTaxCurrencySettings(_prev: SettingsState, fd: FormData): Promise<SettingsState> {
  const taxRate = numOrNull(fd, "taxRate");
  if (taxRate !== null && (taxRate < 0 || taxRate > 100)) {
    return { error: "Tax rate must be between 0 and 100 percent." };
  }

  const values = {
    taxName: str(fd, "taxName") || "VAT",
    taxRate: (taxRate ?? 0).toString(),
    taxInclusive: str(fd, "taxInclusive") === "on",
    currencySymbol: str(fd, "currencySymbol") || "Rs.",
    currencyFormat: str(fd, "currencyFormat") || "en-US",
  };

  try {
    const [existing] = await db.select({ id: settings.id }).from(settings).limit(1);
    if (existing) await db.update(settings).set(values).where(eq(settings.id, existing.id));
    else await db.insert(settings).values({ businessName: "My Business", ...values });
  } catch (e) {
    return { error: friendly(e, "Unable to save tax and currency settings.") };
  }
  revalidatePath("/settings");
  return { success: "Tax and currency settings saved. New documents will use these values." };
}

export async function saveAllSettings(_prev: SettingsState, fd: FormData): Promise<SettingsState> {
  const business = await saveBusinessSettings(_prev, fd);
  if (business.error) return business;
  const inv = await saveInvoiceSettings({}, fd);
  if (inv.error) return inv;
  const invt = await saveInventorySettings({}, fd);
  if (invt.error) return invt;
  const tax = await saveTaxCurrencySettings({}, fd);
  if (tax.error) return tax;

  try {
    await db.insert(auditLogs).values({
      action: "SETTINGS_UPDATED",
      tableName: "settings",
      recordId: 1,
      newValue: "Business, invoice, inventory, tax and currency settings updated",
    });
  } catch {
    /* audit logging is best-effort */
  }

  return { success: "All settings saved successfully." };
}

export async function clearDataAction(_prev: SettingsState, fd: FormData): Promise<SettingsState> {
  const scope = (fd.get("scope")?.toString() as ResetScope) || "demo";
  const confirmText = (fd.get("confirmText")?.toString() ?? "").trim().toUpperCase();
  if (confirmText !== "DELETE") {
    return { error: 'Type DELETE in the box to confirm. Nothing was changed.' };
  }
  try {
    await resetBusinessData(scope);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    return { error: msg && !msg.includes("violates") ? msg : "Unable to clear data. Nothing was changed." };
  }
  revalidatePath("/", "layout");
  return {
    success:
      scope === "demo"
        ? "Demo data removed. All sample products, customers, suppliers and transactions are gone — start entering your own data."
        : "All transactions cleared. Your products, customers and suppliers were kept; balances and stock have been reset.",
  };
}
