"use server";

import { db } from "@/db";
import {
  products,
  categories,
  brands,
  units,
  unitConversions,
  warehouses,
  warehouseZones,
  racks,
  bins,
  auditLogs,
} from "@/db/schema";
import { adjustStock, getProductStock, postInventoryTransaction } from "@/lib/services/inventory";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseCsv } from "@/lib/csv";

export type FormState = { error?: string; success?: string };

const str = (fd: FormData, key: string) => (fd.get(key)?.toString() ?? "").trim();
const numOrNull = (fd: FormData, key: string) => {
  const v = str(fd, key);
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const decOrNull = (fd: FormData, key: string) => {
  const n = numOrNull(fd, key);
  return n === null ? null : n.toString();
};

/* ------------------------------- PRODUCTS ------------------------------- */

export async function saveProduct(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = numOrNull(fd, "id");
  const code = str(fd, "code");
  const name = str(fd, "name");

  if (!code) return { error: "Product code / SKU is required." };
  if (!name) return { error: "Product name is required." };

  const purchasePrice = Number(str(fd, "purchasePrice") || 0);
  const sellingPrice = Number(str(fd, "sellingPrice") || 0);
  if (purchasePrice < 0 || sellingPrice < 0) return { error: "Prices cannot be negative." };

  const length = numOrNull(fd, "length");
  const width = numOrNull(fd, "width");
  const area = length && width ? (length * width).toFixed(2) : decOrNull(fd, "area");

  const values = {
    code,
    name,
    barcode: str(fd, "barcode") || null,
    categoryId: numOrNull(fd, "categoryId"),
    brandId: numOrNull(fd, "brandId"),
    description: str(fd, "description") || null,
    purchasePrice: purchasePrice.toFixed(2),
    sellingPrice: sellingPrice.toFixed(2),
    minStockLevel: (numOrNull(fd, "minStockLevel") ?? 0).toString(),
    reorderLevel: (numOrNull(fd, "reorderLevel") ?? 0).toString(),
    taxRate: (numOrNull(fd, "taxRate") ?? 0).toString(),
    unitId: numOrNull(fd, "unitId"),
    isActive: str(fd, "isActive") !== "false",
    thickness: str(fd, "thickness") || null,
    length: decOrNull(fd, "length"),
    width: decOrNull(fd, "width"),
    area,
    grade: str(fd, "grade") || null,
    finish: str(fd, "finish") || null,
    updatedAt: new Date(),
  };

  try {
    if (id) {
      const [before] = await db.select().from(products).where(eq(products.id, id)).limit(1);
      await db.update(products).set(values).where(eq(products.id, id));
      if (before && before.sellingPrice !== values.sellingPrice) {
        await db.insert(auditLogs).values({
          action: "PRICE_CHANGE",
          tableName: "products",
          recordId: id,
          previousValue: `Selling price: ${before.sellingPrice}`,
          newValue: `Selling price: ${values.sellingPrice}`,
        });
      }
    } else {
      const [created] = await db.insert(products).values(values).returning();
      const opening = numOrNull(fd, "openingStock") ?? 0;
      if (opening > 0) {
        await db.transaction(async (tx) => {
          await postInventoryTransaction(tx, {
            productId: created.id,
            warehouseId: numOrNull(fd, "warehouseId"),
            binId: numOrNull(fd, "binId"),
            quantity: opening,
            unitId: created.unitId,
            transactionType: "ADJUSTMENT",
            referenceDocument: "OPENING-STOCK",
            notes: "Opening stock entered when creating the product",
          });
        });
      }
      await db.insert(auditLogs).values({
        action: "PRODUCT_CREATED",
        tableName: "products",
        recordId: created.id,
        newValue: `${created.code} - ${created.name}`,
      });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message.includes("duplicate key")) {
      return { error: `The product code "${code}" is already used by another product.` };
    }
    return { error: "Unable to save the product. Please check the values and try again." };
  }

  revalidatePath("/inventory/products");
  revalidatePath("/inventory/stock");
  redirect("/inventory/products?saved=1");
}

export async function toggleProductActive(fd: FormData) {
  const id = Number(fd.get("id"));
  const [p] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!p) return;
  await db.update(products).set({ isActive: !p.isActive }).where(eq(products.id, id));
  await db.insert(auditLogs).values({
    action: p.isActive ? "PRODUCT_DEACTIVATED" : "PRODUCT_ACTIVATED",
    tableName: "products",
    recordId: id,
    previousValue: String(p.isActive),
    newValue: String(!p.isActive),
  });
  revalidatePath("/inventory/products");
}

/** Whether a product has any transaction history that must be preserved. */
async function productHasHistory(id: number): Promise<boolean> {
  const result: any = await db.execute(sql`
    select (
      exists(select 1 from inventory_transactions where product_id = ${id})
      or exists(select 1 from invoice_items where product_id = ${id})
      or exists(select 1 from purchase_order_items where product_id = ${id})
      or exists(select 1 from goods_receipt_items where product_id = ${id})
      or exists(select 1 from sales_order_items where product_id = ${id})
      or exists(select 1 from quotation_items where product_id = ${id})
      or exists(select 1 from purchase_return_items where product_id = ${id})
      or exists(select 1 from sales_return_items where product_id = ${id})
      or exists(select 1 from delivery_note_items where product_id = ${id})
      or exists(select 1 from stock_adjustments where product_id = ${id})
      or exists(select 1 from batches where product_id = ${id})
    ) as has_history
  `);
  const rows = Array.isArray(result) ? result : result?.rows ?? [];
  return rows[0]?.has_history === true;
}

export async function deleteProduct(fd: FormData) {
  const id = Number(fd.get("id"));
  const [p] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!p) redirect("/inventory/products?error=Product+not+found");

  // Protect financial and stock history: never hard-delete a product that has
  // been bought, sold, adjusted or received. Deactivate it instead.
  if (await productHasHistory(id)) {
    await db.update(products).set({ isActive: false }).where(eq(products.id, id));
    await db.insert(auditLogs).values({
      action: "PRODUCT_DEACTIVATED",
      tableName: "products",
      recordId: id,
      newValue: `${p.code} deactivated (has history, cannot delete)`,
    });
    revalidatePath("/inventory/products");
    redirect("/inventory/products?saved=" + encodeURIComponent(`"${p.name}" has transactions, so it was deactivated instead of deleted.`));
  }

  await db.delete(products).where(eq(products.id, id));
  await db.insert(auditLogs).values({
    action: "PRODUCT_DELETED",
    tableName: "products",
    recordId: id,
    previousValue: `${p.code} - ${p.name}`,
  });
  revalidatePath("/inventory/products");
  redirect("/inventory/products?saved=" + encodeURIComponent(`"${p.name}" was deleted.`));
}

/* ------------------------------ CSV IMPORT ------------------------------ */

export async function importProductsCsv(_prev: FormState, fd: FormData): Promise<FormState> {
  const raw = str(fd, "csv");
  if (!raw) return { error: "Paste CSV text or choose a .csv file to import." };

  let rows: Record<string, string>[];
  try {
    rows = parseCsv(raw);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not read the CSV." };
  }
  if (rows.length === 0) return { error: "The file has no data rows." };

  const [cats, brs, uns] = await Promise.all([
    db.select().from(categories),
    db.select().from(brands),
    db.select().from(units),
  ]);
  const findCat = (name: string) => cats.find((c) => c.name.toLowerCase() === name.toLowerCase());
  const findBrand = (name: string) => brs.find((b) => b.name.toLowerCase() === name.toLowerCase());
  const findUnit = (name: string) =>
    uns.find((u) => u.name.toLowerCase() === name.toLowerCase() || u.symbol.toLowerCase() === name.toLowerCase());

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
    const code = get("code", "sku", "productcode");
    const name = get("name", "productname");
    if (!code || !name) {
      errors.push(`Row ${i + 2}: missing product code or name — skipped.`);
      continue;
    }

    const catName = get("category");
    const brandName = get("brand");
    const unitName = get("unit", "uom");
    const numOr = (v: string, d: number) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : d;
    };

    const values = {
      code,
      name,
      barcode: get("barcode") || null,
      categoryId: catName ? findCat(catName)?.id ?? null : null,
      brandId: brandName ? findBrand(brandName)?.id ?? null : null,
      unitId: unitName ? findUnit(unitName)?.id ?? null : null,
      description: get("description") || null,
      purchasePrice: numOr(get("purchaseprice", "cost", "costprice"), 0).toFixed(2),
      sellingPrice: numOr(get("sellingprice", "price"), 0).toFixed(2),
      minStockLevel: numOr(get("minstocklevel", "minstock"), 0).toString(),
      reorderLevel: numOr(get("reorderlevel", "reorder"), 0).toString(),
      taxRate: numOr(get("taxrate", "tax", "vat"), 0).toString(),
      thickness: get("thickness") || null,
      length: get("length") ? numOr(get("length"), 0).toString() : null,
      width: get("width") ? numOr(get("width"), 0).toString() : null,
      grade: get("grade") || null,
      finish: get("finish") || null,
      isActive: true,
      updatedAt: new Date(),
    };
    const l = Number(values.length);
    const w = Number(values.width);
    const area = l > 0 && w > 0 ? (l * w).toFixed(2) : null;

    try {
      const [existing] = await db.select({ id: products.id }).from(products).where(eq(products.code, code)).limit(1);
      if (existing) {
        await db.update(products).set({ ...values, area }).where(eq(products.id, existing.id));
        updated++;
      } else {
        const [createdProduct] = await db.insert(products).values({ ...values, area }).returning();
        created++;
        const opening = numOr(get("openingstock", "stock", "quantity"), 0);
        if (opening > 0) {
          await db.transaction(async (tx) => {
            await postInventoryTransaction(tx, {
              productId: createdProduct.id,
              quantity: opening,
              unitId: createdProduct.unitId,
              transactionType: "ADJUSTMENT",
              referenceDocument: "CSV-IMPORT",
              notes: "Opening stock from CSV import",
            });
          });
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "error";
      errors.push(`Row ${i + 2} (${code}): ${msg.includes("duplicate") ? "duplicate code" : "could not save"}.`);
    }
  }

  await db.insert(auditLogs).values({
    action: "PRODUCTS_IMPORTED",
    tableName: "products",
    newValue: `Imported CSV: ${created} added, ${updated} updated, ${errors.length} skipped`,
  });

  revalidatePath("/inventory/products");
  const summary = `${created} added, ${updated} updated${errors.length ? `, ${errors.length} skipped` : ""}.`;
  if (errors.length > 0 && created === 0 && updated === 0) {
    return { error: `Nothing imported. ${errors.slice(0, 5).join(" ")}` };
  }
  return { success: `Import complete: ${summary}${errors.length ? " " + errors.slice(0, 3).join(" ") : ""}` };
}

/* ------------------------------ ADJUSTMENTS ----------------------------- */

export async function submitAdjustment(_prev: FormState, fd: FormData): Promise<FormState> {
  const productId = numOrNull(fd, "productId");
  const newQuantity = numOrNull(fd, "newQuantity");
  const reason = str(fd, "reason");

  if (!productId) return { error: "Please choose a product." };
  if (newQuantity === null || newQuantity < 0) return { error: "New quantity must be zero or more." };
  if (!reason) return { error: "Please select a reason for this adjustment." };

  try {
    const result = await adjustStock({
      productId,
      warehouseId: numOrNull(fd, "warehouseId"),
      binId: numOrNull(fd, "binId"),
      newQuantity,
      reason,
      notes: str(fd, "notes") || undefined,
    });
    revalidatePath("/inventory/stock");
    revalidatePath("/inventory/movement");
    return {
      success: `Stock updated from ${result.previous} to ${result.next} (${
        result.delta > 0 ? "+" : ""
      }${result.delta}).`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unable to adjust the stock." };
  }
}

export async function lookupStock(productId: number) {
  return getProductStock(productId);
}

/* ------------------------- CATEGORIES / BRANDS -------------------------- */

export async function createCategory(fd: FormData) {
  const name = str(fd, "name");
  if (!name) redirect("/inventory/categories?error=Category+name+is+required");
  await db.insert(categories).values({ name, description: str(fd, "description") || null });
  revalidatePath("/inventory/categories");
  redirect("/inventory/categories?saved=Category+added");
}

export async function deleteCategory(fd: FormData) {
  const id = Number(fd.get("id"));
  const used = await db.select({ id: products.id }).from(products).where(eq(products.categoryId, id)).limit(1);
  if (used.length > 0) {
    await db.update(categories).set({ isActive: false }).where(eq(categories.id, id));
    revalidatePath("/inventory/categories");
    redirect("/inventory/categories?saved=Category+is+in+use%2C+so+it+was+deactivated+instead");
  }
  await db.delete(categories).where(eq(categories.id, id));
  revalidatePath("/inventory/categories");
  redirect("/inventory/categories?saved=Category+removed");
}

export async function createBrand(fd: FormData) {
  const name = str(fd, "name");
  if (!name) redirect("/inventory/categories?error=Brand+name+is+required");
  await db.insert(brands).values({ name });
  revalidatePath("/inventory/categories");
  redirect("/inventory/categories?saved=Brand+added");
}

export async function deleteBrand(fd: FormData) {
  const id = Number(fd.get("id"));
  const used = await db.select({ id: products.id }).from(products).where(eq(products.brandId, id)).limit(1);
  if (used.length > 0) {
    await db.update(brands).set({ isActive: false }).where(eq(brands.id, id));
    revalidatePath("/inventory/categories");
    redirect("/inventory/categories?saved=Brand+is+in+use%2C+so+it+was+deactivated+instead");
  }
  await db.delete(brands).where(eq(brands.id, id));
  revalidatePath("/inventory/categories");
  redirect("/inventory/categories?saved=Brand+removed");
}

/* ------------------------------- UNITS ---------------------------------- */

export async function createUnit(fd: FormData) {
  const name = str(fd, "name");
  const symbol = str(fd, "symbol");
  if (!name || !symbol) redirect("/inventory/units?error=Unit+name+and+symbol+are+required");
  await db.insert(units).values({ name, symbol });
  revalidatePath("/inventory/units");
  redirect("/inventory/units?saved=Unit+added");
}

export async function createConversion(fd: FormData) {
  const fromUnitId = numOrNull(fd, "fromUnitId");
  const toUnitId = numOrNull(fd, "toUnitId");
  const multiplier = numOrNull(fd, "multiplier");
  if (!fromUnitId || !toUnitId || !multiplier || multiplier <= 0) {
    redirect("/inventory/units?error=Please+fill+both+units+and+a+positive+multiplier");
  }
  if (fromUnitId === toUnitId) {
    redirect("/inventory/units?error=Choose+two+different+units");
  }
  await db.insert(unitConversions).values({
    fromUnitId,
    toUnitId,
    multiplier: multiplier.toFixed(4),
  });
  revalidatePath("/inventory/units");
  redirect("/inventory/units?saved=Conversion+rule+added");
}

export async function deleteConversion(fd: FormData) {
  await db.delete(unitConversions).where(eq(unitConversions.id, Number(fd.get("id"))));
  revalidatePath("/inventory/units");
  redirect("/inventory/units?saved=Conversion+removed");
}

/* ----------------------------- WAREHOUSES ------------------------------- */

export async function createWarehouse(fd: FormData) {
  const name = str(fd, "name");
  if (!name) redirect("/inventory/warehouses?error=Warehouse+name+is+required");
  await db.insert(warehouses).values({ name, location: str(fd, "location") || null });
  revalidatePath("/inventory/warehouses");
  redirect("/inventory/warehouses?saved=Warehouse+added");
}

export async function createZone(fd: FormData) {
  const name = str(fd, "name");
  const warehouseId = numOrNull(fd, "warehouseId");
  if (!name || !warehouseId) redirect("/inventory/warehouses?error=Zone+name+and+warehouse+are+required");
  await db.insert(warehouseZones).values({ name, warehouseId });
  revalidatePath("/inventory/warehouses");
  redirect("/inventory/warehouses?saved=Zone+added");
}

export async function createRack(fd: FormData) {
  const name = str(fd, "name");
  const zoneId = numOrNull(fd, "zoneId");
  if (!name || !zoneId) redirect("/inventory/warehouses?error=Rack+name+and+zone+are+required");
  await db.insert(racks).values({ name, zoneId });
  revalidatePath("/inventory/warehouses");
  redirect("/inventory/warehouses?saved=Rack+added");
}

export async function createBin(fd: FormData) {
  const name = str(fd, "name");
  const rackId = numOrNull(fd, "rackId");
  if (!name || !rackId) redirect("/inventory/warehouses?error=Shelf+name+and+rack+are+required");
  await db.insert(bins).values({ name, rackId });
  revalidatePath("/inventory/warehouses");
  redirect("/inventory/warehouses?saved=Shelf+added");
}
