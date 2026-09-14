import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Truck } from "lucide-react";
import { DocumentView } from "@/components/documents/DocumentView";
import { ConfirmForm } from "@/components/documents/PrintButton";
import { Flash } from "@/components/ui/Flash";
import { getSalesOrder } from "@/lib/services/sales";
import { changeSoStatus } from "../../actions";
import { dateShort, money, num, qty } from "@/lib/format";
import { SO_ACTIONS, label, soTone } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function SalesOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const soId = Number(id);
  if (!Number.isFinite(soId)) notFound();
  const so = await getSalesOrder(soId);
  if (!so) notFound();

  const status = so.status ?? "DRAFT";
  const actions = SO_ACTIONS[status] ?? [];

  const rows = so.items.map((i, idx) => {
    const ordered = num(i.quantity);
    const delivered = num(i.deliveredQuantity);
    return [
      String(idx + 1),
      `${i.name ?? ""}\n${i.code ?? ""}`,
      qty(ordered),
      `${qty(delivered)} / ${qty(Math.max(0, ordered - delivered))}`,
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
        title="Sales Order"
        number={so.soNumber}
        date={dateShort(so.date)}
        status={{ label: label(status), tone: soTone(status) }}
        party={{ heading: "Customer", name: so.customer?.name ?? "Unknown customer", lines: [so.customer?.companyName, so.customer?.address, so.customer?.phone, so.customer?.panVatNumber ? `PAN/VAT: ${so.customer.panVatNumber}` : null] }}
        meta={[["Order Date", dateShort(so.date)], ["Delivery Date", so.deliveryDate ? dateShort(so.deliveryDate) : "-"], ["Quotation", so.quoteNumber ?? "-"], ["Lines", String(so.items.length)]]}
        columns={[{ label: "#" }, { label: "Product" }, { label: "Ordered", align: "right" }, { label: "Delivered / Pending", align: "right" }, { label: "Unit Price", align: "right" }, { label: "Discount", align: "right" }, { label: "Tax", align: "right" }, { label: "Total", align: "right" }]}
        rows={rows}
        totals={[
          { label: "Subtotal", value: money(so.subtotal) },
          { label: "Discount", value: `- ${money(so.discountAmount)}` },
          { label: "Tax", value: money(so.taxAmount) },
          { label: "Grand Total", value: money(so.totalAmount), strong: true },
        ]}
        notes={so.notes}
        footer="Confirmed order. Create a delivery note to record goods leaving the warehouse."
        actions={
          <>
            <Link href="/sales/orders" className="text-sm text-slate-500 hover:underline mr-2">
              ← All orders
            </Link>
            {(status === "CONFIRMED" || status === "PARTIALLY_DELIVERED") && (
              <Link href={`/sales/delivery/new?soId=${so.id}`} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
                <Truck size={16} /> Record Delivery
              </Link>
            )}
            {actions.map((a) => (
              <ConfirmForm key={a.status} action={changeSoStatus} message={a.confirm}>
                <input type="hidden" name="id" value={so.id} />
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

      {so.deliveries.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm max-w-4xl mx-auto print:hidden">
          <h3 className="px-5 py-3 border-b border-slate-200 font-semibold text-sm text-slate-800">Delivery Notes</h3>
          <ul className="divide-y divide-slate-100 text-sm">
            {so.deliveries.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-5 py-2.5">
                <Link href={`/sales/delivery/${d.id}`} className="font-medium text-blue-600 hover:underline">
                  {d.dnNumber}
                </Link>
                <span className="text-slate-500">{dateShort(d.date)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
