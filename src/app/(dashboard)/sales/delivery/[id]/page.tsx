import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentView } from "@/components/documents/DocumentView";
import { getDeliveryNote } from "@/lib/services/sales";
import { dateShort, qty } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DeliveryNoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dnId = Number(id);
  if (!Number.isFinite(dnId)) notFound();
  const dn = await getDeliveryNote(dnId);
  if (!dn) notFound();

  const rows = dn.items.map((i, idx) => [String(idx + 1), `${i.name ?? ""} (${i.code ?? ""})`, `${qty(i.quantity)} ${i.unit ?? ""}`]);

  return (
    <DocumentView
      title="Delivery Note"
      number={dn.dnNumber}
      date={dateShort(dn.date)}
      status={{ label: "Delivered", tone: "green" }}
      party={{ heading: "Delivered To", name: dn.customer?.name ?? "Unknown customer", lines: [dn.customer?.companyName, dn.customer?.address, dn.customer?.phone] }}
      meta={[
        ["Sales Order", dn.soNumber ?? "Adhoc"],
        ["Delivery Address", dn.address ?? "-"],
      ]}
      columns={[{ label: "#" }, { label: "Product" }, { label: "Quantity", align: "right" }]}
      rows={rows}
      totals={[{ label: "Total Lines", value: String(dn.items.length), strong: true }]}
      notes={dn.notes}
      footer="Received the above goods in good condition."
      actions={
        <Link href="/sales/delivery" className="text-sm text-slate-500 hover:underline mr-2">
          ← All delivery notes
        </Link>
      }
    />
  );
}
