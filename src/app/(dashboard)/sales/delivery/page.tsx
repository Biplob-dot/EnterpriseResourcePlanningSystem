import React from "react";
import { Truck } from "lucide-react";
import { LinkButton, PageHeader, StatTile } from "@/components/ui";
import { DataTable, type Cell } from "@/components/ui/DataTable";
import { Flash } from "@/components/ui/Flash";
import { getDeliveryNotes } from "@/lib/services/sales";
import { ensureSeed } from "@/lib/seed";
import { dateShort, money, num } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DeliveryNotesPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await ensureSeed();
  const sp = await searchParams;
  const rows = await getDeliveryNotes();

  const data: Cell[][] = rows.map((d) => [
    { text: d.dnNumber, href: `/sales/delivery/${d.id}` },
    { text: dateShort(d.date), sort: d.date ? new Date(d.date).getTime() : 0 },
    { text: d.customer ?? "-", sort: d.customer ?? "" },
    { text: d.soNumber ?? "-", href: d.soNumber ? `/sales/orders/${d.soNumber}` : undefined, muted: !d.soNumber },
    { text: String(num(d.itemCount)), sort: num(d.itemCount), muted: true },
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Delivery Notes"
        subtitle="Record goods handed to the customer or transporter."
        actions={
          <LinkButton href="/sales/delivery/new">
            <Truck size={16} /> New Delivery
          </LinkButton>
        }
      />
      <Flash saved={sp.saved} error={sp.error} />

      <div className="grid grid-cols-2 gap-4 max-w-xl">
        <StatTile label="Delivery Notes" value={String(rows.length)} />
        <StatTile label="Total Lines Delivered" value={String(rows.reduce((s, r) => s + num(r.itemCount), 0))} tone="blue" />
      </div>

      <DataTable
        title="Delivery Note List"
        exportName="delivery-notes"
        columns={[
          { label: "DN No." },
          { label: "Date" },
          { label: "Customer" },
          { label: "Sales Order" },
          { label: "Lines", align: "right" },
        ]}
        rows={data}
        emptyMessage="No delivery notes yet. Record one when goods leave the warehouse."
      />
    </div>
  );
}
