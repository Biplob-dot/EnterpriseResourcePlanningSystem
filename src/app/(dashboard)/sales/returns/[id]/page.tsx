import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentView } from "@/components/documents/DocumentView";
import { getSalesReturn } from "@/lib/services/sales";
import { dateShort, money, num, qty } from "@/lib/format";

export const dynamic = "force-dynamic";

const condTone = (c: string | null) =>
  c === "RESELLABLE" ? "green" : c === "DAMAGED" ? "amber" : c === "SCRAP" ? "red" : "slate";

export default async function SalesReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rId = Number(id);
  if (!Number.isFinite(rId)) notFound();
  const ret = await getSalesReturn(rId);
  if (!ret) notFound();

  const rows = ret.items.map((i, idx) => [
    String(idx + 1),
    `${i.name ?? ""} (${i.code ?? ""})`,
    `${qty(i.quantity)} ${i.unit ?? ""}`,
    money(i.unitPrice),
    `${num(i.taxRate)}%`,
    money(i.total),
  ]);

  return (
    <DocumentView
      title="Sales Return"
      number={ret.returnNumber}
      date={dateShort(ret.date)}
      status={{ label: (ret.condition ?? "").replace(/_/g, " "), tone: condTone(ret.condition) }}
      party={{ heading: "Returned From", name: ret.customer?.name ?? "Unknown customer", lines: [ret.customer?.companyName, ret.customer?.address, ret.customer?.phone] }}
      meta={[["Original Invoice", ret.invoiceNumber ?? "-"], ["Reason", ret.reason ?? "-"]]}
      columns={[{ label: "#" }, { label: "Product" }, { label: "Quantity", align: "right" }, { label: "Unit Price", align: "right" }, { label: "Tax", align: "right" }, { label: "Total", align: "right" }]}
      rows={rows}
      totals={[
        { label: "Subtotal", value: money(ret.subtotal) },
        { label: "Tax", value: money(ret.taxAmount) },
        { label: "Credit Amount", value: money(ret.totalAmount), strong: true },
      ]}
      footer="The returned quantities have been credited to the customer and (if resellable) returned to stock."
      actions={
        <Link href="/sales/returns" className="text-sm text-slate-500 hover:underline mr-2">
          ← All returns
        </Link>
      }
    />
  );
}
