import { db } from "@/db";
import {
  expenses,
  income,
  bankAccounts,
  bankTransactions,
  journalEntries,
  journalEntryLines,
  accounts,
  auditLogs,
  invoices,
  customers,
  suppliers,
  goodsReceipts,
} from "@/db/schema";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { nextDocNumber, postJournal, recordBankMovement, ACC } from "./accounting";
import { round2 } from "@/lib/calc";
import { num } from "@/lib/format";
import type { Db } from "./accounting";

export const EXPENSE_CATEGORIES = [
  "Rent",
  "Electricity",
  "Salary",
  "Transportation",
  "Warehouse",
  "Maintenance",
  "Internet",
  "Office Expenses",
  "Miscellaneous",
];

export const INCOME_CATEGORIES = ["Commission", "Transport Recovery", "Cutting Service", "Interest", "Scrap Sale", "Other"];

/* ------------------------------------------------------------------ */
/* Expenses                                                            */
/* ------------------------------------------------------------------ */

export async function getExpenses(limit = 500) {
  return db.select().from(expenses).orderBy(desc(expenses.date), desc(expenses.id)).limit(limit);
}

export async function createExpense(input: {
  date: Date;
  category: string;
  amount: number;
  method: string;
  description: string | null;
  bankAccountId?: number | null;
}) {
  if (!(input.amount > 0)) throw new Error("Expense amount must be greater than zero.");
  if (!input.category) throw new Error("Please choose an expense category.");

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(expenses)
      .values({
        date: input.date,
        category: input.category,
        amount: input.amount.toFixed(2),
        paymentMethod: input.method,
        bankAccountId: input.bankAccountId ?? null,
        description: input.description,
      })
      .returning();

    const bankAccountId = await recordBankMovement(tx, {
      method: input.method,
      amount: input.amount,
      direction: "OUT",
      date: input.date,
      type: "EXPENSE",
      reference: `EXP-${row.id}`,
      description: `${input.category}: ${input.description ?? ""}`.trim(),
    });
    if (bankAccountId) await tx.update(expenses).set({ bankAccountId }).where(eq(expenses.id, row.id));

    await postJournal(tx, {
      date: input.date,
      reference: `EXP-${row.id}`,
      description: `${input.category} expense`,
      lines: [
        { account: ACC.OPEX, debit: input.amount },
        { account: input.method === "Cash" ? ACC.CASH : ACC.BANK, credit: input.amount },
      ],
    });

    await tx.insert(auditLogs).values({
      action: "EXPENSE_RECORDED",
      tableName: "expenses",
      recordId: row.id,
      newValue: `${input.category} • ${input.amount.toFixed(2)} via ${input.method}`,
    });

    return row;
  });
}

export async function voidExpense(id: number) {
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(expenses).where(eq(expenses.id, id)).limit(1);
    if (!row) throw new Error("Expense not found.");
    if (row.description?.includes("[VOID]")) return row;

    await postJournal(tx, {
      date: new Date(),
      reference: `EXP-VOID-${row.id}`,
      description: `Reverse ${row.category} expense`,
      lines: [
        { account: row.paymentMethod === "Cash" ? ACC.CASH : ACC.BANK, debit: num(row.amount) },
        { account: ACC.OPEX, credit: num(row.amount) },
      ],
    });
    await recordBankMovement(tx, {
      method: row.paymentMethod,
      amount: num(row.amount),
      direction: "IN",
      date: new Date(),
      type: "EXPENSE_REFUND",
      reference: `EXP-VOID-${row.id}`,
      description: `Reverse ${row.category} expense`,
    });
    await tx.update(expenses).set({ description: `${row.description ?? ""} [VOID]`.trim() }).where(eq(expenses.id, id));
    await tx.insert(auditLogs).values({ action: "EXPENSE_VOIDED", tableName: "expenses", recordId: id, newValue: row.category });
    return row;
  });
}

/* ------------------------------------------------------------------ */
/* Other income                                                        */
/* ------------------------------------------------------------------ */

export async function getIncome(limit = 500) {
  return db.select().from(income).orderBy(desc(income.date), desc(income.id)).limit(limit);
}

export async function createIncome(input: { date: Date; category: string; amount: number; method: string; description: string | null }) {
  if (!(input.amount > 0)) throw new Error("Income amount must be greater than zero.");
  if (!input.category) throw new Error("Please choose an income category.");

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(income)
      .values({
        date: input.date,
        category: input.category,
        amount: input.amount.toFixed(2),
        paymentMethod: input.method,
        description: input.description,
      })
      .returning();

    const bankAccountId = await recordBankMovement(tx, {
      method: input.method,
      amount: input.amount,
      direction: "IN",
      date: input.date,
      type: "INCOME",
      reference: `INC-${row.id}`,
      description: `${input.category}: ${input.description ?? ""}`.trim(),
    });
    if (bankAccountId) await tx.update(income).set({ bankAccountId }).where(eq(income.id, row.id));

    await postJournal(tx, {
      date: input.date,
      reference: `INC-${row.id}`,
      description: `${input.category} income`,
      lines: [
        { account: input.method === "Cash" ? ACC.CASH : ACC.BANK, debit: input.amount },
        { account: ACC.OTHER_INCOME, credit: input.amount },
      ],
    });

    return row;
  });
}

/* ------------------------------------------------------------------ */
/* Bank accounts                                                       */
/* ------------------------------------------------------------------ */

export async function getBankAccounts() {
  return db.select().from(bankAccounts).orderBy(bankAccounts.type, bankAccounts.name);
}

export async function getBankAccountWithTransactions(id: number) {
  const [account] = await db.select().from(bankAccounts).where(eq(bankAccounts.id, id)).limit(1);
  if (!account) return null;
  const txns = await db.select().from(bankTransactions).where(eq(bankTransactions.bankAccountId, id)).orderBy(desc(bankTransactions.date), desc(bankTransactions.id)).limit(300);
  return { account, txns };
}

export async function createBankAccount(input: { name: string; type: "CASH" | "BANK"; bankName: string | null; accountNumber: string | null; openingBalance: number }) {
  if (!input.name) throw new Error("Account name is required.");
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(bankAccounts)
      .values({
        name: input.name,
        type: input.type,
        bankName: input.bankName,
        accountNumber: input.accountNumber,
        openingBalance: input.openingBalance.toFixed(2),
        currentBalance: input.openingBalance.toFixed(2),
      })
      .returning();
    if (input.openingBalance > 0) {
      await tx.insert(bankTransactions).values({
        bankAccountId: row.id,
        date: new Date(),
        type: "OPENING",
        amount: input.openingBalance.toFixed(2),
        description: "Opening balance",
      });
    }
    return row;
  });
}

export async function bankTransfer(input: { fromAccountId: number; toAccountId: number; amount: number; date: Date; reference: string | null }) {
  if (!(input.amount > 0)) throw new Error("Transfer amount must be greater than zero.");
  if (input.fromAccountId === input.toAccountId) throw new Error("Choose two different accounts.");

  return db.transaction(async (tx) => {
    const [from] = await tx.select().from(bankAccounts).where(eq(bankAccounts.id, input.fromAccountId)).limit(1);
    const [to] = await tx.select().from(bankAccounts).where(eq(bankAccounts.id, input.toAccountId)).limit(1);
    if (!from || !to) throw new Error("One of the accounts could not be found.");
    if (num(from.currentBalance) < input.amount) throw new Error(`${from.name} does not have ${input.amount.toFixed(2)} available.`);

    const fromNew = round2(num(from.currentBalance) - input.amount);
    const toNew = round2(num(to.currentBalance) + input.amount);
    await tx.update(bankAccounts).set({ currentBalance: fromNew.toFixed(2) }).where(eq(bankAccounts.id, from.id));
    await tx.update(bankAccounts).set({ currentBalance: toNew.toFixed(2) }).where(eq(bankAccounts.id, to.id));

    await tx.insert(bankTransactions).values([
      {
        bankAccountId: from.id,
        date: input.date,
        type: "TRANSFER_OUT",
        amount: (-input.amount).toFixed(2),
        reference: input.reference,
        description: `Transfer to ${to.name}`,
      },
      {
        bankAccountId: to.id,
        date: input.date,
        type: "TRANSFER_IN",
        amount: input.amount.toFixed(2),
        reference: input.reference,
        description: `Transfer from ${from.name}`,
      },
    ]);
    return { from, to };
  });
}

export async function toggleReconciled(id: number, value: boolean) {
  await db.update(bankTransactions).set({ isReconciled: value }).where(eq(bankTransactions.id, id));
}

/* ------------------------------------------------------------------ */
/* Ledger / trial balance                                              */
/* ------------------------------------------------------------------ */

export async function getTrialBalance(from: Date | null, to: Date | null) {
  const conditions = [];
  if (from) conditions.push(gte(journalEntries.date, from));
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    conditions.push(lte(journalEntries.date, end));
  }

  const rows = await db
    .select({
      code: accounts.code,
      name: accounts.name,
      type: accounts.type,
      debit: sql<string>`coalesce(sum(${journalEntryLines.debit}), 0)`,
      credit: sql<string>`coalesce(sum(${journalEntryLines.credit}), 0)`,
    })
    .from(journalEntryLines)
    .innerJoin(accounts, eq(journalEntryLines.accountId, accounts.id))
    .innerJoin(journalEntries, eq(journalEntryLines.entryId, journalEntries.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(accounts.code, accounts.name, accounts.type)
    .orderBy(accounts.code);

  return rows.map((r) => {
    const dr = num(r.debit);
    const cr = num(r.credit);
    // Natural balance direction by account type
    const isDebitNature = ["Asset", "Expense"].includes(r.type);
    return {
      code: r.code,
      name: r.name,
      type: r.type,
      debit: dr,
      credit: cr,
      balance: isDebitNature ? round2(dr - cr) : round2(cr - dr),
    };
  });
}

export async function getJournalEntries(limit = 200) {
  const entries = await db.select().from(journalEntries).orderBy(desc(journalEntries.id)).limit(limit);
  if (entries.length === 0) return [];
  const lines = await db
    .select({
      entryId: journalEntryLines.entryId,
      code: accounts.code,
      name: accounts.name,
      debit: journalEntryLines.debit,
      credit: journalEntryLines.credit,
    })
    .from(journalEntryLines)
    .innerJoin(accounts, eq(journalEntryLines.accountId, accounts.id))
    .where(sql`${journalEntryLines.entryId} in ${sql.raw(`(${entries.map((e) => e.id).join(",")})`)}`)
    .orderBy(journalEntryLines.id);

  return entries.map((e) => ({ ...e, lines: lines.filter((l) => l.entryId === e.id) }));
}

/* ------------------------------------------------------------------ */
/* Accounts receivable / payable aging                                 */
/* ------------------------------------------------------------------ */

function bucket(days: number) {
  if (days <= 0) return "current" as const;
  if (days <= 30) return "d30" as const;
  if (days <= 60) return "d60" as const;
  if (days <= 90) return "d90" as const;
  return "d90p" as const;
}

export async function getReceivableAging() {
  const rows = await db
    .select({
      invoiceId: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      date: invoices.date,
      dueDate: invoices.dueDate,
      total: invoices.totalAmount,
      paid: invoices.amountPaid,
      due: invoices.amountDue,
      status: invoices.status,
      customerId: customers.id,
      customer: customers.name,
    })
    .from(invoices)
    .leftJoin(customers, eq(invoices.customerId, customers.id))
    .where(and(eq(invoices.isCancelled, false), sql`${invoices.status} <> 'PAID'`))
    .orderBy(asc(invoices.dueDate));

  const today = new Date();
  return rows.map((r) => {
    const days = r.dueDate ? Math.floor((today.getTime() - new Date(r.dueDate).getTime()) / 86400000) : 0;
    return { ...r, daysOverdue: Math.max(0, days), bucket: bucket(days) };
  });
}

export async function getPayableAging() {
  // Supplier payments are maintained as an account balance (not allocated to a
  // specific GRN), so aging is correctly shown once per supplier rather than
  // duplicating the full supplier balance against every receipt.
  const rows = await db
    .select({
      supplierId: suppliers.id,
      supplier: suppliers.name,
      creditPeriod: suppliers.creditPeriod,
      outstanding: suppliers.outstandingBalance,
      firstPurchase: sql<Date | null>`min(${goodsReceipts.date})`,
      lastPurchase: sql<Date | null>`max(${goodsReceipts.date})`,
      purchases: sql<string>`coalesce(sum(${goodsReceipts.totalAmount}), 0)`,
      receiptCount: sql<string>`count(${goodsReceipts.id})`,
    })
    .from(suppliers)
    .leftJoin(goodsReceipts, eq(goodsReceipts.supplierId, suppliers.id))
    .where(sql`${suppliers.outstandingBalance} > 0`)
    .groupBy(suppliers.id, suppliers.name, suppliers.creditPeriod, suppliers.outstandingBalance)
    .orderBy(desc(suppliers.outstandingBalance));

  const today = new Date();
  return rows.map((r) => {
    const period = r.creditPeriod ?? 30;
    const dueDate = r.firstPurchase ? new Date(new Date(r.firstPurchase).getTime() + period * 86400000) : null;
    const days = dueDate ? Math.floor((today.getTime() - dueDate.getTime()) / 86400000) : 0;
    return { ...r, dueDate, daysOverdue: Math.max(0, days), bucket: bucket(days) };
  });
}

/** Simple P&L inputs used by reports (Phase 6) and the accounting dashboard. */
export async function getProfitSnapshot(from: Date | null, to: Date | null) {
  const start = from ?? new Date(2000, 0, 1);
  const end = to ? new Date(new Date(to).setHours(23, 59, 59, 999)) : new Date();

  const [sales] = await db
    .select({
      revenue: sql<string>`coalesce(sum(${invoices.totalAmount} - ${invoices.taxAmount}), 0)`,
      tax: sql<string>`coalesce(sum(${invoices.taxAmount}), 0)`,
      cogs: sql<string>`coalesce(sum(${invoices.costOfGoods}), 0)`,
      count: sql<string>`count(*)`,
    })
    .from(invoices)
    .where(and(eq(invoices.isCancelled, false), gte(invoices.date, start), lte(invoices.date, end)));

  const [purchase] = await db
    .select({ total: sql<string>`coalesce(sum(${goodsReceipts.totalAmount}), 0)` })
    .from(goodsReceipts)
    .where(and(gte(goodsReceipts.date, start), lte(goodsReceipts.date, end)));

  const [exp] = await db
    .select({ total: sql<string>`coalesce(sum(${expenses.amount}), 0)` })
    .from(expenses)
    .where(and(gte(expenses.date, start), lte(expenses.date, end)));

  const [inc] = await db
    .select({ total: sql<string>`coalesce(sum(${income.amount}), 0)` })
    .from(income)
    .where(and(gte(income.date, start), lte(income.date, end)));

  const revenue = num(sales?.revenue);
  const cogs = num(sales?.cogs);
  const otherIncome = num(inc?.total);
  const expenseTotal = num(exp?.total);
  const grossProfit = round2(revenue - cogs);
  const netProfit = round2(grossProfit + otherIncome - expenseTotal);

  return {
    revenue,
    tax: num(sales?.tax),
    cogs,
    purchases: num(purchase?.total),
    expenses: expenseTotal,
    otherIncome,
    grossProfit,
    netProfit,
    invoiceCount: num(sales?.count),
  };
}
