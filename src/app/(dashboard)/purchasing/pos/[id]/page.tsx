import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PackageCheck, Pencil } from "lucide-react";
import { DocumentView } from "@/components/documents/DocumentView";
import { ConfirmForm } from "@/components/documents/PrintButton";
import { Flash } from "@/components/ui/Flash";
import { Card, Badge } from "@/components/ui";
import { getPurchaseOrder } from "@/lib/services/purchasing";
import { changePoStatus } from "../../actions";
import { dateShort, money, num, qty } from "@/lib/format";
import { PO_ACTIONS, label, poTone } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function PurchaseOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const poId = Number(id);
  if (!Number.isFinite(poId)) notFound();
  const po = await getPurchaseOrder(poId);
  if (!po) notFound();

  const status = po.status ?? "DRAFT";
  const canReceive = status === "ORDERED" || status === "PARTIALLY_RECEIVED";
  const actions = PO_ACTIONS[status] ?? [];

  const rows = po.items.map((i, idx) => {
    const ordered = num(i.quantity);
    const received = num(i.receivedQuantity);
    return [
      String(idx + 1),
      `${i.name ?? ""}\n${i.code ?? ""}`,
      `${qty(ordered)} ${i.unit ?? ""}`,
      `${qty(received)} / ${qty(Math.max(0, ordered - received))}`,
      money(i.unitPrice),
      num(i.discount) > 0 ? money(i.discount) : "-",
      `${num(i.taxRate)}%`,
      money(i.total),
    ];
  });

  return (
    <div className="space-y-6">
      <Flash saved={sp.saved} error={sp.error} />

      <DocumentView
        title="Purchase Order"
        number={po.poNumber}
        date={dateShort(po.date)}
        status={{ label: label(status), tone: poTone(status) }}
        party={{
          heading: "Supplier",
          name: po.supplier?.name ?? "Unknown supplier",
          lines: [po.supplier?.companyName, po.supplier?.address, po.supplier?.phone, po.supplier?.panVatNumber ? `PAN/VAT: ${po.supplier.panVatNumber}` : null],
        }}
        meta={[
          ["Order Date", dateShort(po.date)],
          ["Expected Delivery", po.expectedDeliveryDate ? dateShort(po.expectedDeliveryDate) : "-"],
          ["Lines", String(po.items.length)],
        ]}
        columns={[
          { label: "#" },
          { label: "Product" },
          { label: "Ordered", align: "right" },
          { label: "Received / Pending", align: "right" },
          { label: "Unit Price", align: "right" },
          { label: "Discount", align: "right" },
          { label: "Tax", align: "right" },
          { label: "Total", align: "right" },
        ]}
        rows={rows}
        totals={[
          { label: "Subtotal", value: money(po.subtotal) },
          { label: "Discount", value: `- ${money(po.discountAmount)}` },
          { label: "Tax", value: money(po.taxAmount) },
          { label: "Grand Total", value: money(po.totalAmount), strong: true },
        ]}
        notes={po.notes}
        actions={
          <>
            <Link href="/purchasing/pos" className="text-sm text-slate-500 hover:underline mr-2">
              ← All orders
            </Link>
            {status === "DRAFT" && (
              <Link
                href={`/purchasing/pos/${po.id}/edit`}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Pencil size={16} /> Edit
              </Link>
            )}
            {canReceive && (
              <Link
                href={`/purchasing/grn/new?poId=${po.id}`}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                <PackageCheck size={16} /> Receive Goods
              </Link>
            )}
            {actions.map((a) => (
              <ConfirmForm key={a.status} action={changePoStatus} message={a.confirm}>
                <input type="hidden" name="id" value={po.id} />
                <input type="hidden" name="status" value={a.status} />
                <button
                  className={
                    a.style === "primary"
                      ? "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                      : a.style === "danger"
                      ? "rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                      : "rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  }
                >
                  {a.label}
                </button>
              </ConfirmForm>
            ))}
          </>
        }
      />

      {po.grns.length > 0 && (
        <Card title="Goods Received Against This Order" className="max-w-4xl mx-auto print:hidden">
          <ul className="divide-y divide-slate-100 text-sm">
            {po.grns.map((g) => (
              <li key={g.id} className="flex items-center justify-between px-5 py-2.5">
                <Link href={`/purchasing/grn/${g.id}`} className="font-medium text-blue-600 hover:underline">
                  {g.grnNumber}
                </Link>
                <span className="text-slate-500">{dateShort(g.date)}</span>
                <span className="font-semibold">{money(g.totalAmount)}</span>
                <Badge tone="green">Received</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
