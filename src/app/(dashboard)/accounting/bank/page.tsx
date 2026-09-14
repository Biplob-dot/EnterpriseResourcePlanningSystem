import React from "react";
import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { Badge, Card, PageHeader, StatTile } from "@/components/ui";
import { DataTable, type Cell } from "@/components/ui/DataTable";
import { Flash } from "@/components/ui/Flash";
import { reconcileAction } from "../actions";
import { getBankAccounts } from "@/lib/services/finance";
import { db } from "@/db";
import { bankTransactions } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { ensureSeed } from "@/lib/seed";
import { dateShort, money, num } from "@/lib/format";
import { NewAccountForm, TransferForm } from "./BankForms";

export const dynamic = "force-dynamic";

const typeTone = (t: string): Cell["tone"] =>
  t === "PAYMENT_IN" || t === "TRANSFER_IN" || t === "INCOME" || t === "EXPENSE_REFUND" ? "green" : "red";

export default async function BankPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string; account?: string }> }) {
  await ensureSeed();
  const sp = await searchParams;
  const accounts = await getBankAccounts();
  const selectedId = sp.account ? Number(sp.account) : accounts[0]?.id;
  const selected = accounts.find((a) => a.id === selectedId) ?? null;

  const txns = selectedId
    ? await db.select().from(bankTransactions).where(eq(bankTransactions.bankAccountId, selectedId)).orderBy(desc(bankTransactions.date), desc(bankTransactions.id)).limit(300)
    : [];

  const cash = accounts.filter((a) => a.type === "CASH").reduce((s, a) => s + num(a.currentBalance), 0);
  const bank = accounts.filter((a) => a.type === "BANK").reduce((s, a) => s + num(a.currentBalance), 0);

  const rows: Cell[][] = txns.map((t) => {
    const amt = num(t.amount);
    return [
      { text: dateShort(t.date), sort: t.date ? new Date(t.date).getTime() : 0 },
      { text: t.type.replace(/_/g, " "), tone: typeTone(t.type) },
      { text: t.description ?? "-", muted: true },
      { text: t.reference ?? "-", muted: true },
      { text: `${amt >= 0 ? "+" : ""}${money(amt)}`, sort: amt, bold: true, tone: amt >= 0 ? "green" : "red" },
      {
        node: (
          <form action={reconcileAction}>
            <input type="hidden" name="id" value={t.id} />
            <input type="hidden" name="value" value={t.isReconciled ? "false" : "true"} />
            <button className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-blue-600">
              {t.isReconciled ? <CheckCircle2 size={14} className="text-emerald-600" /> : <Circle size={14} />}
              {t.isReconciled ? "Reconciled" : "Mark matched"}
            </button>
          </form>
        ),
        text: "",
      },
    ];
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Bank & Cash" subtitle="Your cash drawer and bank accounts, with every deposit, withdrawal and transfer." />
      <Flash saved={sp.saved} error={sp.error} />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatTile label="Cash on Hand" value={money(cash)} tone="green" />
        <StatTile label="Bank Balance" value={money(bank)} tone="blue" />
        <StatTile label="Total Funds" value={money(cash + bank)} tone="indigo" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className="space-y-3">
          {accounts.map((a) => (
            <Link
              key={a.id}
              href={`/accounting/bank?account=${a.id}`}
              className={`block rounded-xl border p-4 transition-colors ${
                selectedId === a.id ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-800">{a.name}</p>
                  <p className="text-xs text-slate-500">
                    {a.type === "CASH" ? "Cash account" : [a.bankName, a.accountNumber].filter(Boolean).join(" • ") || "Bank account"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900">{money(a.currentBalance)}</p>
                  <Badge tone={num(a.currentBalance) >= 0 ? "green" : "red"}>{a.type === "CASH" ? "Cash" : "Bank"}</Badge>
                </div>
              </div>
            </Link>
          ))}
        </div>
        <div>
          <TransferForm accounts={accounts} />
        </div>
        <NewAccountForm />
      </div>

      <DataTable
        title={selected ? `Transactions — ${selected.name}` : "Transactions"}
        exportName="bank-transactions"
        columns={[{ label: "Date" }, { label: "Type" }, { label: "Description" }, { label: "Reference" }, { label: "Amount", align: "right", total: true }, { label: "Reconciliation" }]}
        rows={rows}
        emptyMessage="No transactions in this account yet."
      />
      <p className="text-xs text-slate-500 print:hidden">
        Reconciliation: tick a row once you have confirmed it against your bank statement or passbook. Matched rows stay marked for future reference.
      </p>
    </div>
  );
}
