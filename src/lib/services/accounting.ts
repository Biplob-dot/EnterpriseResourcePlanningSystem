import { db } from "@/db";
import { accounts, journalEntries, journalEntryLines, bankAccounts, bankTransactions } from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { PgTable, PgColumn } from "drizzle-orm/pg-core";
import { round2 } from "@/lib/calc";
import { num } from "@/lib/format";
import type { DbTx } from "./inventory";

export type Db = DbTx | typeof db;

/** Standard account codes seeded in the chart of accounts. */
export const ACC = {
  CASH: "1000",
  BANK: "1010",
  AR: "1100",
  INVENTORY: "1200",
  AP: "2000",
  VAT: "2100",
  EQUITY: "3000",
  SALES: "4000",
  OTHER_INCOME: "4100",
  COGS: "5000",
  OPEX: "5100",
} as const;

export type JournalLine = { account: string; debit?: number; credit?: number };

/** Posts a balanced double-entry journal. Throws if debits != credits. */
export async function postJournal(
  tx: Db,
  input: { date: Date; reference: string; description: string; lines: JournalLine[] }
) {
  const lines = input.lines.filter((l) => round2(l.debit ?? 0) !== 0 || round2(l.credit ?? 0) !== 0);
  if (lines.length === 0) return null;

  const dr = round2(lines.reduce((s, l) => s + (l.debit ?? 0), 0));
  const cr = round2(lines.reduce((s, l) => s + (l.credit ?? 0), 0));
  if (Math.abs(dr - cr) > 0.011) {
    throw new Error(`Accounting entry is not balanced (debit ${dr} vs credit ${cr}).`);
  }

  const codes = [...new Set(lines.map((l) => l.account))];
  const rows = await tx.select({ id: accounts.id, code: accounts.code }).from(accounts).where(inArray(accounts.code, codes));
  const byCode = new Map(rows.map((r) => [r.code, r.id]));
  for (const c of codes) {
    if (!byCode.has(c)) throw new Error(`Account ${c} is missing from the chart of accounts.`);
  }

  const [entry] = await tx
    .insert(journalEntries)
    .values({ date: input.date, reference: input.reference, description: input.description })
    .returning();

  await tx.insert(journalEntryLines).values(
    lines.map((l) => ({
      entryId: entry.id,
      accountId: byCode.get(l.account)!,
      debit: round2(l.debit ?? 0).toFixed(2),
      credit: round2(l.credit ?? 0).toFixed(2),
    }))
  );
  return entry;
}

/** Cash payments hit the cash account; everything else hits the main bank account. */
export function accountCodeForMethod(method: string | null | undefined) {
  return method === "Cash" ? ACC.CASH : ACC.BANK;
}

/**
 * Records money moving in/out of a cash or bank account.
 * Returns the bank account id used (or null if no account is configured).
 */
export async function recordBankMovement(
  tx: Db,
  input: {
    method: string | null | undefined;
    amount: number; // positive
    direction: "IN" | "OUT";
    date: Date;
    type: string;
    reference: string;
    description: string;
  }
) {
  const wantedType = input.method === "Cash" ? "CASH" : "BANK";
  const [account] = await tx
    .select()
    .from(bankAccounts)
    .where(and(eq(bankAccounts.type, wantedType), eq(bankAccounts.isActive, true)))
    .orderBy(bankAccounts.id)
    .limit(1);
  if (!account) return null;

  const signed = input.direction === "IN" ? Math.abs(input.amount) : -Math.abs(input.amount);
  const newBalance = round2(num(account.currentBalance) + signed);

  await tx.insert(bankTransactions).values({
    bankAccountId: account.id,
    date: input.date,
    type: input.type,
    amount: signed.toFixed(2),
    reference: input.reference,
    description: input.description,
  });
  await tx.update(bankAccounts).set({ currentBalance: newBalance.toFixed(2) }).where(eq(bankAccounts.id, account.id));
  return account.id;
}

/** Generates the next sequential document number such as PO-0007, guaranteed unique in the table. */
export async function nextDocNumber(
  tx: Db,
  table: PgTable,
  idCol: PgColumn,
  numberCol: PgColumn,
  prefix: string,
  pad = 4
): Promise<string> {
  const [row] = await tx.select({ max: sql<string>`coalesce(max(${idCol}), 0)` }).from(table);
  let n = Number(row?.max ?? 0) + 1;
  for (let i = 0; i < 100; i++) {
    const candidate = `${prefix}${String(n).padStart(pad, "0")}`;
    const exists = await tx.select({ one: sql`1` }).from(table).where(eq(numberCol, candidate)).limit(1);
    if (exists.length === 0) return candidate;
    n++;
  }
  throw new Error("Could not generate a unique document number. Please try again.");
}
