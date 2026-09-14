import React from "react";
import { FileText } from "lucide-react";
import { LinkButton, PageHeader, StatTile } from "@/components/ui";
import { DataTable, type Cell } from "@/components/ui/DataTable";
import { Flash } from "@/components/ui/Flash";
import { getSalesOrders } from "@/lib/services/sales";
import { ensureSeed } from "@/lib/seed";
import { dateShort, money, num } from "@/lib/format";

export const dynamic = "force-dynamic";

const soTone = (s: string | null): Cell["tone"] =>
  s === "DELIVERED" || s === "COMPLETED" ? "green" : s === "PARTIALLY_DELIVERED" ? "blue" : s === "CONFIRMED" ? "amber" : s === "CANCELLED" ? "red" : "slate";

export default async function SalesOrdersPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await ensureSeed();
  const sp = await searchParams;
  const rows = await getSalesOrders();

  const open = rows.filter((r) => r.status === "CONFIRMED" || r.status === "PARTIALLY_DELIVERED");

  const data: Cell[][] = rows.map((o) => [
    { text: o.soNumber, href: `/sales/orders/${o.id}` },
    { text: dateShort(o.date), sort: o.date ? new Date(o.date).getTime() : 0 },
    { text: o.customer ?? "-", sort: o.customer ?? "" },
    { text: o.deliveryDate ? dateShort(o.deliveryDate) : "-", muted: true, sort: o.deliveryDate ? new Date(o.deliveryDate).getTime() : 0 },
    { text: String(num(o.itemCount)), sort: num(o.itemCount), muted: true },
    { text: money(o.totalAmount), sort: num(o.totalAmount) },
    { text: (o.status ?? "DRAFT").replace(/_/g, " "), tone: soTone(o.status) },
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Orders"
        subtitle="Confirmed orders waiting to be delivered."
        actions={
          <LinkButton href="/sales/orders/new">
            <FileText size={16} /> New Sales Order
          </LinkButton>
        }
      />
      <Flash saved={sp.saved} error={sp.error} />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatTile label="All Orders" value={String(rows.length)} />
        <StatTile label="Open (to deliver)" value={String(open.length)} tone="amber" />
        <StatTile label="Open Value" value={money(open.reduce((s, r) => s + num(r.totalAmount), 0))} tone="blue" />
      </div>

      <DataTable
        title="Sales Order List"
        exportName="sales-orders"
        columns={[
          { label: "SO No." },
          { label: "Date" },
          { label: "Customer" },
          { label: "Delivery" },
          { label: "Lines", align: "right" },
          { label: "Total", align: "right", total: true },
          { label: "Status" },
        ]}
        rows={data}
        emptyMessage="No sales orders yet."
      />
    </div>
  );
}
