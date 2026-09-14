import React from "react";
import { ArrowUpRight } from "lucide-react";
import { LinkButton, PageHeader, StatTile } from "@/components/ui";
import { DataTable, type Cell } from "@/components/ui/DataTable";
import { Flash } from "@/components/ui/Flash";
import { getSalesReturns } from "@/lib/services/sales";
import { ensureSeed } from "@/lib/seed";
import { dateShort, money, num } from "@/lib/format";

export const dynamic = "force-dynamic";

const condTone = (c: string | null): Cell["tone"] =>
  c === "RESELLABLE" ? "green" : c === "DAMAGED" ? "amber" : c === "SCRAP" ? "red" : "slate";

export default async function SalesReturnsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await ensureSeed();
  const sp = await searchParams;
  const rows = await getSalesReturns();

  const data: Cell[][] = rows.map((r) => [
    { text: r.returnNumber, href: `/sales/returns/${r.id}` },
    { text: dateShort(r.date), sort: r.date ? new Date(r.date).getTime() : 0 },
    { text: r.customer ?? "-", sort: r.customer ?? "" },
    { text: r.invoiceNumber ?? "-", muted: true },
    { text: r.reason ?? "-", muted: true },
    { text: (r.condition ?? "").replace(/_/g, " "), tone: condTone(r.condition) },
    { text: money(r.totalAmount), sort: num(r.totalAmount), bold: true },
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Sales Returns" subtitle="Goods returned by customers." actions={<LinkButton href="/sales/returns/new"><ArrowUpRight size={16} /> New Return</LinkButton>} />
      <Flash saved={sp.saved} error={sp.error} />

      <div className="grid grid-cols-2 gap-4 max-w-xl">
        <StatTile label="Returns Recorded" value={String(rows.length)} />
        <StatTile label="Total Credited" value={money(rows.reduce((s, r) => s + num(r.totalAmount), 0))} tone="blue" />
      </div>

      <DataTable
        title="Return List"
        exportName="sales-returns"
        columns={[
          { label: "Return No." },
          { label: "Date" },
          { label: "Customer" },
          { label: "Original Invoice" },
          { label: "Reason" },
          { label: "Condition" },
          { label: "Amount", align: "right", total: true },
        ]}
        rows={data}
        emptyMessage="No sales returns recorded."
      />
    </div>
  );
}
