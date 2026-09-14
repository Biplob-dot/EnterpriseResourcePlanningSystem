import { db, pool } from "@/db";
import { settings, auditLogs } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Tables cleared by a data reset, in child-before-parent order so foreign keys
 * are satisfied at every step. Business settings and the chart of accounts are
 * intentionally NOT cleared — they are configuration, not demo/business data.
 */
const RESET_TABLES = [
  // line items / children
  "invoice_items",
  "sales_return_items",
  "delivery_note_items",
  "sales_order_items",
  "quotation_items",
  "goods_receipt_items",
  "purchase_return_items",
  "purchase_order_items",
  "journal_entry_lines",
  "payment_allocations",
  "stock_adjustments",
  "inventory_transactions",
  "batches",
  "bank_transactions",
  "customer_transactions",
  "supplier_transactions",
  // documents
  "sales_returns",
  "delivery_notes",
  "invoices",
  "sales_orders",
  "quotations",
  "purchase_returns",
  "goods_receipts",
  "purchase_orders",
  "payments",
  "journal_entries",
  "expenses",
  "income",
  // master data
  "products",
  "customers",
  "suppliers",
];

export type ResetScope = "demo" | "transactions";

/**
 * "demo"         -> remove ALL products, customers, suppliers and every
 *                    transaction (a clean slate to enter your own data).
 * "transactions" -> keep products/customers/suppliers but remove all sales,
 *                    purchases, payments, stock movements and accounting.
 */
export async function resetBusinessData(scope: ResetScope): Promise<{ cleared: string[] }> {
  const tables = scope === "demo" ? RESET_TABLES : RESET_TABLES.filter((t) => !["products", "customers", "suppliers"].includes(t));

  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("set session_replication_role = replica");
    await client.query(`truncate table ${tables.map((t) => `"${t}"`).join(", ")} restart identity cascade`);

    if (scope === "transactions") {
      // Keep the parties but zero their running balances and stock is already gone.
      await client.query(`update customers set outstanding_balance = '0.00'`);
      await client.query(`update suppliers set outstanding_balance = '0.00'`);
    }

    // Reset cash/bank balances back to their opening balances.
    await client.query(`update bank_accounts set current_balance = opening_balance`);

    await client.query("set session_replication_role = default");
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }

  // Mark demo data as cleared so it is never re-seeded on the next page load.
  if (scope === "demo") {
    const [cfg] = await db.select({ id: settings.id }).from(settings).limit(1);
    if (cfg) await db.update(settings).set({ demoDataCleared: true }).where(eq(settings.id, cfg.id));
  }

  await db.insert(auditLogs).values({
    action: scope === "demo" ? "DEMO_DATA_CLEARED" : "TRANSACTIONS_CLEARED",
    tableName: "settings",
    newValue: scope === "demo" ? "All products, parties and transactions removed" : "All transactions removed; products and parties kept",
  });

  return { cleared: tables };
}
