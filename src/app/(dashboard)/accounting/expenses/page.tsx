import React from "react";
import { Plus } from "lucide-react";
import { LinkButton, PageHeader, StatTile } from "@/components/ui";
import { DataTable, type Cell } from "@/components/ui/DataTable";
import { Flash } from "@/components/ui/Flash";
import { ConfirmForm } from "@/components/documents/PrintButton";
import { getExpenses, EXPENSE_CATEGORIES } from "@/lib/services/finance";
import { voidExpenseAction } from "../actions";
import { ensureSeed } from "@/lib/seed";
import { dateShort, money, num } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await ensureSeed();
  const sp = await searchParams;
  const rows = await getExpenses();
  const active = rows.filter((r) => !r.description?.includes("[VOID]"));

  const now = new Date();
  const thisMonth = active
    .filter((r) => r.date && new Date(r.date).getMonth() === now.getMonth() && new Date(r.date).getFullYear() === now.getFullYear())
    .reduce((s, r) => s + num(r.amount), 0);

  const byCategory = EXPENSE_CATEGORIES.map((c) => ({
    category: c,
    total: active.filter((r) => r.category === c).reduce((s, r) => s + num(r.amount), 0),
  }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);

  const data: Cell[][] = rows.map((e) => {
    const isVoid = e.description?.includes("[VOID]");
    return [
      { text: dateShort(e.date), sort: e.date ? new Date(e.date).getTime() : 0 },
      { text: e.category, sort: e.category },
      { text: e.description ?? "-", muted: true },
      { text: e.paymentMethod ?? "-", tone: e.paymentMethod === "Cash" ? "green" : "blue" },
      { text: money(e.amount), sort: num(e.amount), bold: true },
      {
        node: isVoid ? (
          <span className="text-xs text-slate-400">Reversed</span>
        ) : (
          <ConfirmForm action={voidExpenseAction} message="Reverse this expense? Your cash/bank balance will be restored.">
            <input type="hidden" name="id" value={e.id} />
            <button className="text-xs font-medium text-red-600 hover:underline">Reverse</button>
          </ConfirmForm>
        ),
        text: "",
      },
    ];
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        subtitle="Day-to-day business costs that are not purchases of stock."
        actions={
          <LinkButton href="/accounting/expenses/new">
            <Plus size={16} /> New Expense
          </LinkButton>
        }
      />
      <Flash saved={sp.saved} error={sp.error} />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatTile label="Spent This Month" value={money(thisMonth)} tone="red" />
        <StatTile label="Total Expenses" value={money(active.reduce((s, r) => s + num(r.amount), 0))} tone="amber" />
        <StatTile label="Entries" value={String(active.length)} />
      </div>

      {byCategory.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {byCategory.slice(0, 5).map((c) => (
            <div key={c.category} className="bg-white rounded-xl border border-slate-200 p-3">
              <p className="text-xs text-slate-500">{c.category}</p>
              <p className="font-semibold text-slate-900">{money(c.total)}</p>
            </div>
          ))}
        </div>
      )}

      <DataTable
        title="Expense List"
        exportName="expenses"
        columns={[{ label: "Date" }, { label: "Category" }, { label: "Description" }, { label: "Method" }, { label: "Amount", align: "right", total: true }, { label: "" }]}
        rows={data}
        emptyMessage="No expenses recorded yet."
      />
    </div>
  );
}
