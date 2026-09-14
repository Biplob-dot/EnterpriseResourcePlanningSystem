import React from "react";
import { ArrowDownLeft } from "lucide-react";
import { LinkButton, PageHeader, StatTile } from "@/components/ui";
import { DataTable, type Cell } from "@/components/ui/DataTable";
import { Flash } from "@/components/ui/Flash";
import { getPurchaseReturns } from "@/lib/services/purchasing";
import { ensureSeed } from "@/lib/seed";
import { dateShort, money, num } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PurchaseReturnsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await ensureSeed();
  const sp = await searchParams;
  const rows = await getPurchaseReturns();

  const data: Cell[][] = rows.map((r) => [
    { text: r.returnNumber, href: `/purchasing/returns/${r.id}` },
    { text: dateShort(r.date), sort: r.date ? new Date(r.date).getTime() : 0 },
    { text: r.supplier ?? "-", sort: r.supplier ?? "" },
    { text: r.grnNumber ?? "-", href: r.grnId ? `/purchasing/grn/${r.grnId}` : undefined, muted: !r.grnId },
    { text: r.reason ?? "-", muted: true },
    { text: money(r.totalAmount), sort: num(r.totalAmount), bold: true },
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Returns"
        subtitle="Goods sent back to suppliers."
        actions={
          <LinkButton href="/purchasing/returns/new">
            <ArrowDownLeft size={16} /> New Return
          </LinkButton>
        }
      />
      <Flash saved={sp.saved} error={sp.error} />

      <div className="grid grid-cols-2 gap-4 max-w-xl">
        <StatTile label="Returns Recorded" value={String(rows.length)} />
        <StatTile label="Total Credit Received" value={money(rows.reduce((s, r) => s + num(r.totalAmount), 0))} tone="blue" />
      </div>

      <DataTable
        title="Return List"
        exportName="purchase-returns"
        columns={[
          { label: "Return No." },
          { label: "Date" },
          { label: "Supplier" },
          { label: "Original Receipt" },
          { label: "Reason" },
          { label: "Amount", align: "right", total: true },
        ]}
        rows={data}
        emptyMessage="No purchase returns recorded."
      />
    </div>
  );
}
