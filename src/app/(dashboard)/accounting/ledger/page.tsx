import React from "react";
import { Filter, Printer } from "lucide-react";
import { Badge, Card, Field, PageHeader, StatTile, inputClass } from "@/components/ui";
import { DataTable, type Cell } from "@/components/ui/DataTable";
import { PrintButton } from "@/components/documents/PrintButton";
import { getJournalEntries, getTrialBalance, getProfitSnapshot } from "@/lib/services/finance";
import { parseDateInput, toDateInput } from "@/lib/calc";
import { dateShort, money, num } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function LedgerPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const from = parseDateInput(sp.from, null);
  const to = parseDateInput(sp.to, null);

  const [trial, entries, profit] = await Promise.all([getTrialBalance(from, to), getJournalEntries(60), getProfitSnapshot(from, to)]);

  const totalDr = trial.reduce((s, r) => s + r.debit, 0);
  const totalCr = trial.reduce((s, r) => s + r.credit, 0);
  const balanced = Math.abs(totalDr - totalCr) < 0.02;

  const trialRows: Cell[][] = trial.map((r) => [
    { text: r.code, muted: true },
    { text: r.name, sort: r.name },
    { text: r.type, muted: true },
    { text: money(r.debit), sort: r.debit },
    { text: money(r.credit), sort: r.credit },
    { text: money(r.balance), sort: r.balance, bold: true },
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounting Ledger"
        subtitle="Every sale, purchase, payment, return and expense creates a balanced double entry here."
        actions={<PrintButton><Printer size={16} /> Print / Save PDF</PrintButton>}
      />

      <form className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-end gap-3 print:hidden">
        <Field label="From">
          <input type="date" name="from" defaultValue={sp.from ?? ""} className={inputClass} />
        </Field>
        <Field label="To">
          <input type="date" name="to" defaultValue={sp.to ?? ""} className={inputClass} />
        </Field>
        <button className="inline-flex h-[38px] items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700">
          <Filter size={15} /> Apply
        </button>
        <a href="/accounting/ledger" className="text-sm text-slate-500 hover:underline pb-2.5">Clear</a>
        <span className="text-xs text-slate-500 pb-2.5">
          Showing {toDateInput(from ?? undefined) || "beginning"} to {toDateInput(to) || "today"}
        </span>
      </form>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatTile label="Revenue (excl. tax)" value={money(profit.revenue)} tone="blue" />
        <StatTile label="Cost of Goods Sold" value={money(profit.cogs)} tone="amber" />
        <StatTile label="Gross Profit" value={money(profit.grossProfit)} tone={profit.grossProfit >= 0 ? "green" : "red"} />
        <StatTile label="Operating Expenses" value={money(profit.expenses)} tone="red" />
        <StatTile label="Net Profit" value={money(profit.netProfit)} tone={profit.netProfit >= 0 ? "green" : "red"} />
      </div>

      <Card
        title="Trial Balance"
        action={
          <Badge tone={balanced ? "green" : "red"}>{balanced ? "Balanced" : "Out of balance"}</Badge>
        }
      >
        <DataTable
          exportName="trial-balance"
          pageSize={40}
          columns={[{ label: "Code" }, { label: "Account" }, { label: "Type" }, { label: "Debits", align: "right", total: true }, { label: "Credits", align: "right", total: true }, { label: "Balance", align: "right" }]}
          rows={trialRows}
          emptyMessage="No accounting entries in this period yet."
        />
      </Card>

      <Card title="Journal Entries (latest 60)">
        <div className="divide-y divide-slate-100">
          {entries.length === 0 && <p className="p-6 text-sm text-slate-500 text-center">No journal entries yet.</p>}
          {entries.map((e) => (
            <details key={e.id} className="group">
              <summary className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 cursor-pointer hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-500">#{e.id}</span>
                  <span className="text-sm font-medium text-slate-800">{e.description}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-xs text-slate-500">{e.reference}</span>
                  <span className="text-xs text-slate-500">{dateShort(e.date)}</span>
                  <span className="font-semibold text-slate-800">{money(e.lines.reduce((s, l) => s + num(l.debit), 0))}</span>
                </div>
              </summary>
              <table className="w-full text-sm bg-slate-50/60">
                <thead>
                  <tr className="text-xs uppercase text-slate-500">
                    <th className="px-5 py-1.5 text-left font-semibold">Account</th>
                    <th className="px-5 py-1.5 text-left font-semibold">Code</th>
                    <th className="px-5 py-1.5 text-right font-semibold">Debit</th>
                    <th className="px-5 py-1.5 text-right font-semibold">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {e.lines.map((l, i) => (
                    <tr key={i} className="border-t border-slate-200">
                      <td className="px-5 py-1.5 text-slate-800">{l.name}</td>
                      <td className="px-5 py-1.5 text-slate-500">{l.code}</td>
                      <td className="px-5 py-1.5 text-right">{num(l.debit) > 0 ? money(l.debit) : ""}</td>
                      <td className="px-5 py-1.5 text-right">{num(l.credit) > 0 ? money(l.credit) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          ))}
        </div>
      </Card>

      <Card title="How profit is calculated">
        <div className="p-5 text-sm text-slate-600 space-y-1.5">
          <p><strong className="text-slate-800">Gross Profit = Sales (excluding tax) − Cost of Goods Sold.</strong> Sales exclude VAT because VAT is collected on behalf of the government, not earned income.</p>
          <p><strong className="text-slate-800">Net Profit = Gross Profit + Other Income − Operating Expenses.</strong> Operating expenses come from the Expenses module; purchases of stock are not expenses — they only become cost when the goods are sold.</p>
        </div>
      </Card>
    </div>
  );
}
