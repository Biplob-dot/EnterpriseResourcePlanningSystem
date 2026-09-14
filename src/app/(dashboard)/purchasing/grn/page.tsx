import React from "react";
import { PackageCheck } from "lucide-react";
import { LinkButton, PageHeader, StatTile } from "@/components/ui";
import { DataTable, type Cell } from "@/components/ui/DataTable";
import { Flash } from "@/components/ui/Flash";
import { getGoodsReceipts } from "@/lib/services/purchasing";
import { ensureSeed } from "@/lib/seed";
import { dateShort, money, num } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function GrnListPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await ensureSeed();
  const sp = await searchParams;
  const rows = await getGoodsReceipts();

  const now = new Date();
  const thisMonth = rows.filter((r) => r.date && new Date(r.date).getMonth() === now.getMonth() && new Date(r.date).getFullYear() === now.getFullYear());

  const data: Cell[][] = rows.map((g) => [
    { text: g.grnNumber, href: `/purchasing/grn/${g.id}` },
    { text: dateShort(g.date), sort: g.date ? new Date(g.date).getTime() : 0 },
    { text: g.supplier ?? "-", sort: g.supplier ?? "" },
    { text: g.poNumber ?? "Direct", href: g.poId ? `/purchasing/pos/${g.poId}` : undefined, muted: !g.poId },
    { text: String(num(g.itemCount)), sort: num(g.itemCount), muted: true },
    { text: money(g.totalAmount), sort: num(g.totalAmount), bold: true },
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Goods Received"
        subtitle="Every delivery that has been checked in to the warehouse."
        actions={
          <LinkButton href="/purchasing/grn/new">
            <PackageCheck size={16} /> Receive Goods
          </LinkButton>
        }
      />
      <Flash saved={sp.saved} error={sp.error} />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatTile label="Total Receipts" value={String(rows.length)} />
        <StatTile label="Received This Month" value={money(thisMonth.reduce((s, r) => s + num(r.totalAmount), 0))} tone="blue" />
        <StatTile label="All-time Purchases" value={money(rows.reduce((s, r) => s + num(r.totalAmount), 0))} tone="indigo" />
      </div>

      <DataTable
        title="Goods Received Notes"
        exportName="goods-received"
        columns={[
          { label: "GRN No." },
          { label: "Date" },
          { label: "Supplier" },
          { label: "Purchase Order" },
          { label: "Lines", align: "right" },
          { label: "Amount", align: "right", total: true },
        ]}
        rows={data}
        emptyMessage="No goods received yet. Click 'Receive Goods' when a delivery arrives."
      />
    </div>
  );
}
