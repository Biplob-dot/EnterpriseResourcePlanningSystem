import React from "react";
import { Plus } from "lucide-react";
import { LinkButton, PageHeader, StatTile } from "@/components/ui";
import { DataTable, type Cell } from "@/components/ui/DataTable";
import { Flash } from "@/components/ui/Flash";
import { getPurchaseOrders } from "@/lib/services/purchasing";
import { ensureSeed } from "@/lib/seed";
import { dateShort, money, num } from "@/lib/format";
import { poTone } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function PurchaseOrdersPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await ensureSeed();
  const sp = await searchParams;
  const rows = await getPurchaseOrders();

  const open = rows.filter((r) => r.status === "ORDERED" || r.status === "PARTIALLY_RECEIVED");
  const openValue = open.reduce((s, r) => s + num(r.totalAmount), 0);

  const data: Cell[][] = rows.map((p) => [
    { text: p.poNumber, href: `/purchasing/pos/${p.id}` },
    { text: dateShort(p.date), sort: p.date ? new Date(p.date).getTime() : 0 },
    { text: p.supplier ?? "-", sort: p.supplier ?? "" },
    { text: p.expectedDeliveryDate ? dateShort(p.expectedDeliveryDate) : "-", muted: true, sort: p.expectedDeliveryDate ? new Date(p.expectedDeliveryDate).getTime() : 0 },
    { text: String(num(p.itemCount)), sort: num(p.itemCount), muted: true },
    { text: money(p.totalAmount), sort: num(p.totalAmount) },
    { text: (p.status ?? "DRAFT").replace(/_/g, " "), tone: poTone(p.status) },
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Orders"
        subtitle="Orders placed with suppliers. Receive goods against them when stock arrives."
        actions={
          <LinkButton href="/purchasing/pos/new">
            <Plus size={16} /> New Purchase Order
          </LinkButton>
        }
      />
      <Flash saved={sp.saved} error={sp.error} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="All Orders" value={String(rows.length)} />
        <StatTile label="Awaiting Delivery" value={String(open.length)} tone="amber" />
        <StatTile label="Value Awaiting Delivery" value={money(openValue)} tone="blue" />
        <StatTile label="Drafts" value={String(rows.filter((r) => r.status === "DRAFT").length)} />
      </div>

      <DataTable
        title="Purchase Order List"
        exportName="purchase-orders"
        columns={[
          { label: "PO No." },
          { label: "Date" },
          { label: "Supplier" },
          { label: "Expected" },
          { label: "Lines", align: "right" },
          { label: "Total", align: "right", total: true },
          { label: "Status" },
        ]}
        rows={data}
        emptyMessage="No purchase orders yet."
      />
    </div>
  );
}
