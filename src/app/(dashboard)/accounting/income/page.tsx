import React from "react";
import { Plus } from "lucide-react";
import { LinkButton, PageHeader, StatTile } from "@/components/ui";
import { DataTable, type Cell } from "@/components/ui/DataTable";
import { Flash } from "@/components/ui/Flash";
import { getIncome, INCOME_CATEGORIES } from "@/lib/services/finance";
import { ensureSeed } from "@/lib/seed";
import { dateShort, money, num } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function IncomePage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await ensureSeed();
  const sp = await searchParams;
  const rows = await getIncome();

  const data: Cell[][] = rows.map((i) => [
    { text: dateShort(i.date), sort: i.date ? new Date(i.date).getTime() : 0 },
    { text: i.category, sort: i.category },
    { text: i.description ?? "-", muted: true },
    { text: i.paymentMethod ?? "-", tone: i.paymentMethod === "Cash" ? "green" : "blue" },
    { text: money(i.amount), sort: num(i.amount), bold: true },
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Other Income"
        subtitle="Money received that is not from sales — commissions, scrap sales, services."
        actions={
          <LinkButton href="/accounting/income/new">
            <Plus size={16} /> New Income
          </LinkButton>
        }
      />
      <Flash saved={sp.saved} error={sp.error} />

      <div className="grid grid-cols-2 gap-4 max-w-xl">
        <StatTile label="Total Other Income" value={money(rows.reduce((s, r) => s + num(r.amount), 0))} tone="green" />
        <StatTile label="Entries" value={String(rows.length)} />
      </div>

      <DataTable
        title="Income List"
        exportName="other-income"
        columns={[{ label: "Date" }, { label: "Category" }, { label: "Description" }, { label: "Method" }, { label: "Amount", align: "right", total: true }]}
        rows={data}
        emptyMessage="No other income recorded yet."
      />
    </div>
  );
}
