import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { auditLogs } from "@/db/schema";

// Backup files are written at runtime, not bundled. The markers below stop the
// bundler from trying to statically trace this module's filesystem usage.
const runtimeCwd = () => /*turbopackIgnore: true*/ process.cwd();
const joinPath = (...parts: string[]) => /*turbopackIgnore: true*/ path.join(...parts);

const execFileAsync = promisify(execFile);

const DEFAULT_BACKUP_DIR = joinPath(runtimeCwd(), "data", "erp-backups");

export const BACKUP_DIR = process.env.ERP_BACKUP_DIR ?? DEFAULT_BACKUP_DIR;

export type BackupInfo = {
  fileName: string;
  filePath: string;
  sizeBytes: number;
  createdAt: Date;
  kind: "pg_dump" | "json";
};

function connectionParts() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured.");
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port || "5432",
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ""),
  };
}

async function ensureDir() {
  await mkdir(BACKUP_DIR, { recursive: true });
}

export function formatBytes(bytes: number) {
  if (bytes <= 0) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/* ------------------------------------------------------------------ */
/* JSON export (portable, always available)                            */
/* ------------------------------------------------------------------ */

/**
 * Truncate order: children first, then parents, so foreign keys are satisfied
 * at every step (TRUNCATE checks FKs immediately, unlike DML under
 * `set constraints deferred`).
 */
const TRUNCATE_ORDER = [
  // transaction lines / children
  "purchase_order_items",
  "goods_receipt_items",
  "purchase_return_items",
  "quotation_items",
  "sales_order_items",
  "delivery_note_items",
  "invoice_items",
  "sales_return_items",
  "journal_entry_lines",
  "payment_allocations",
  "stock_adjustments",
  "inventory_transactions",
  "batches",
  "customer_transactions",
  "supplier_transactions",
  "bank_transactions",
  // documents
  "purchase_orders",
  "goods_receipts",
  "purchase_returns",
  "quotations",
  "sales_orders",
  "delivery_notes",
  "invoices",
  "sales_returns",
  "payments",
  "expenses",
  "income",
  // masters
  "products",
  "categories",
  "brands",
  "unit_conversions",
  "units",
  "bins",
  "racks",
  "warehouse_zones",
  "warehouses",
  "customers",
  "suppliers",
  "bank_accounts",
  "accounts",
  "journal_entries",
  "audit_logs",
  "settings",
];

const EXPORT_TABLES = [
  "settings",
  "categories",
  "brands",
  "units",
  "unit_conversions",
  "products",
  "warehouses",
  "warehouse_zones",
  "racks",
  "bins",
  "inventory_transactions",
  "stock_adjustments",
  "batches",
  "suppliers",
  "supplier_transactions",
  "customers",
  "customer_transactions",
  "purchase_orders",
  "purchase_order_items",
  "goods_receipts",
  "goods_receipt_items",
  "purchase_returns",
  "purchase_return_items",
  "quotations",
  "quotation_items",
  "sales_orders",
  "sales_order_items",
  "delivery_notes",
  "delivery_note_items",
  "invoices",
  "invoice_items",
  "sales_returns",
  "sales_return_items",
  "payments",
  "payment_allocations",
  "bank_accounts",
  "bank_transactions",
  "accounts",
  "journal_entries",
  "journal_entry_lines",
  "expenses",
  "income",
  "audit_logs",
];

export async function exportJsonBackup(): Promise<BackupInfo> {
  await ensureDir();
  const dump: Record<string, unknown> = {};

  // Use the raw driver so the row shape is guaranteed: drizzle's execute()
  // wraps results differently across drivers, and an empty export for a parent
  // table would truncate it and break every referencing child row.
  const { pool } = await import("@/db");
  for (const table of EXPORT_TABLES) {
    const result = await pool.query(`select * from "${table}"`);
    if (!Array.isArray(result.rows)) {
      throw new Error(`Unable to read table ${table} while creating the backup.`);
    }
    dump[table] = result.rows;
  }

  const payload = {
    format: "plyerp-backup",
    version: 1,
    createdAt: new Date().toISOString(),
    data: dump,
  };

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `plyerp-json-${stamp}.json`;
  const filePath = path.join(BACKUP_DIR, fileName);
  await writeFile(filePath, JSON.stringify(payload, null, 1), "utf8");
  const info = await stat(filePath);
  return { fileName, filePath, sizeBytes: info.size, createdAt: info.mtime, kind: "json" };
}

/* ------------------------------------------------------------------ */
/* pg_dump backup (preferred when available)                           */
/* ------------------------------------------------------------------ */

export async function createSqlBackup(): Promise<BackupInfo> {
  await ensureDir();
  const { host, port, user, password, database } = connectionParts();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `plyerp-db-${stamp}.dump`;
  const filePath = path.join(BACKUP_DIR, fileName);

  await execFileAsync(
    "pg_dump",
    [
      "--host",
      host,
      "--port",
      port,
      "--username",
      user,
      "--format=custom",
      "--no-owner",
      "--file",
      filePath,
      database,
    ],
    { env: { ...process.env, PGPASSWORD: password }, maxBuffer: 1024 * 1024 * 200 }
  );

  const info = await stat(filePath);
  return { fileName, filePath, sizeBytes: info.size, createdAt: info.mtime, kind: "pg_dump" };
}

export async function createBackup(): Promise<BackupInfo> {
  try {
    return await createSqlBackup();
  } catch (e) {
    console.warn("pg_dump unavailable, using JSON export:", e instanceof Error ? e.message : e);
    return exportJsonBackup();
  }
}

export async function listBackups(): Promise<BackupInfo[]> {
  await ensureDir();
  const entries = await readdir(BACKUP_DIR);
  const files = entries.filter((f) => f.endsWith(".dump") || f.endsWith(".json"));
  const infos = await Promise.all(
    files.map(async (f) => {
      const filePath = path.join(BACKUP_DIR, f);
      const s = await stat(filePath);
      return {
        fileName: f,
        filePath,
        sizeBytes: s.size,
        createdAt: s.mtime,
        kind: f.endsWith(".dump") ? ("pg_dump" as const) : ("json" as const),
      };
    })
  );
  return infos.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function getBackup(fileName: string): Promise<BackupInfo | null> {
  const all = await listBackups();
  return all.find((b) => b.fileName === fileName) ?? null;
}

export async function deleteBackup(fileName: string): Promise<void> {
  const backup = await getBackup(fileName);
  if (!backup) throw new Error("Backup file not found.");
  await unlink(backup.filePath);
}

/**
 * Restores a previously created backup.
 * - .dump files are restored with pg_restore
 * - .json files are re-imported row by row inside one transaction
 */
export async function restoreBackup(fileName: string): Promise<{ restored: boolean; message: string }> {
  const backup = await getBackup(fileName);
  if (!backup) throw new Error("Backup file not found.");

  if (backup.kind === "pg_dump") {
    const { host, port, user, password, database } = connectionParts();
    await execFileAsync(
      "pg_restore",
      ["--host", host, "--port", port, "--username", user, "--dbname", database, "--clean", "--if-exists", "--no-owner", backup.filePath],
      { env: { ...process.env, PGPASSWORD: password }, maxBuffer: 1024 * 1024 * 200 }
    );
    return { restored: true, message: "Database restored from the SQL backup file." };
  }

  const raw = await readFile(backup.filePath, "utf8");
  const parsed = JSON.parse(raw) as { format?: string; data?: Record<string, Array<Record<string, unknown>>> };
  if (parsed.format !== "plyerp-backup" || !parsed.data) {
    throw new Error("This JSON file is not a valid PlyERP backup.");
  }

  const tableSet = new Set(EXPORT_TABLES);
  const tables = Object.keys(parsed.data).filter((t) => tableSet.has(t));
  if (tables.length === 0) {
    throw new Error("This backup file contains no recognisable ERP data.");
  }

  // Validate and flatten every row before touching the database. If the file is
  // damaged we abort instead of truncating business data and restoring nothing.
  const prepared: { table: string; columns: string[]; rows: unknown[][] }[] = [];
  for (const table of tables) {
    const rawRows = parsed.data[table] ?? [];
    if (!Array.isArray(rawRows)) throw new Error(`Backup table ${table} is not a list of rows.`);
    for (const row of rawRows) {
      const columns = Object.keys(row);
      if (columns.length === 0) continue;
      const values = columns.map((c) => {
        const v = row[c];
        return v !== null && typeof v === "object" ? JSON.stringify(v) : v;
      });
      const existing = prepared.find((p) => p.table === table && p.columns.length === columns.length && p.columns.every((c, i) => c === columns[i]));
      if (existing) existing.rows.push(values);
      else prepared.push({ table, columns, rows: [values] });
    }
  }

  const { pool } = await import("@/db");
  const client = await pool.connect();
  try {
    await client.query("begin");
    // Full-database restore: disable FK triggers so rows can be reinserted
    // without depending on insert order. The backup is a complete snapshot, so
    // referential integrity is intact once the restore finishes.
    await client.query("set session_replication_role = replica");

    // Truncate children before parents, and never CASCADE (cascading would
    // delete rows in tables outside this restore and they'd never come back).
    const truncateList = TRUNCATE_ORDER.filter((t) => tables.includes(t));
    await client.query(`truncate table ${truncateList.map((t) => `"${t}"`).join(", ")} restart identity`);

    // Parameter-bound inserts: values are never interpolated into SQL text.
    for (const entry of prepared) {
      const colList = entry.columns.map((c) => `"${c}"`).join(", ");
      for (const row of entry.rows) {
        const placeholders = row.map((_, i) => `$${i + 1}`).join(", ");
        await client.query(`insert into "${entry.table}" (${colList}) values (${placeholders})`, row);
      }
    }

    // Rows were reinserted with their original ids, so the id sequences were
    // never advanced. Without this, the next new record would collide with an
    // existing id ("duplicate key value violates unique constraint").
    for (const table of truncateList) {
      const seqResult = await client.query(`select pg_get_serial_sequence($1, 'id') as seq`, [table]);
      const seq = seqResult.rows[0]?.seq;
      if (!seq) continue;
      await client.query(`select setval($1, coalesce((select max("id") from "${table}"), 0) + 1, false)`, [seq]);
    }

    // Re-enable foreign key enforcement before committing so normal operation
    // resumes; a damaged backup fails earlier and the transaction rolls back.
    await client.query("set session_replication_role = default");
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }

  await db.insert(auditLogs).values({
    action: "DATABASE_RESTORED",
    tableName: "settings",
    newValue: `Restored from ${fileName}`,
  });

  return { restored: true, message: "Data restored from the JSON backup file." };
}
