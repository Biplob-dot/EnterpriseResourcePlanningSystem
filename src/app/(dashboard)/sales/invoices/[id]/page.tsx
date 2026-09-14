import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban } from "lucide-react";
import { DocumentView } from "@/components/documents/DocumentView";
import { ConfirmForm } from "@/components/documents/PrintButton";
import { Flash } from "@/components/ui/Flash";
import { getInvoice } from "@/lib/services/sales";
import { cancelInvoiceAction } from "../../actions";
import { dateShort, money, num, qty } from "@/lib/format";
import { invTone } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const invId = Number(id);
  if (!Number.isFinite(invId)) notFound();
  const inv = await getInvoice(invId);
  if (!inv) notFound();

  const rows = inv.items.map((i, idx) => {
    const q = num(i.quantity);
    return [
      String(idx + 1),
      `${i.name ?? ""} (${i.code ?? ""})`,
      `${qty(q)} ${i.unit ?? ""}`,
      money(i.unitPrice),
      num(i.discount) > 0 ? money(i.discount) : "-",
      `${num(i.taxRate)}%`,
      num(i.transport) > 0 ? money(i.transport) : "-",
      money(i.total),
    ];
  });

  return (
    <div className="space-y-6">
      <Flash saved={sp.saved} error={sp.error} />
      <DocumentView
        title="Tax Invoice"
        number={inv.invoiceNumber}
        date={dateShort(inv.date)}
        status={{ label: inv.isCancelled ? "Cancelled" : (inv.status ?? "UNPAID").replace(/_/g, " "), tone: invTone(inv.status, inv.isCancelled ?? false) }}
        party={{ heading: "Billed To", name: inv.customer?.name ?? "Unknown customer", lines: [inv.customer?.companyName, inv.customer?.address, inv.customer?.phone, inv.customer?.panVatNumber ? `PAN/VAT: ${inv.customer.panVatNumber}` : null] }}
        meta={[
          ["Invoice Date", dateShort(inv.date)],
          ["Due Date", inv.dueDate ? dateShort(inv.dueDate) : "On receipt"],
          ["Payment Method", inv.paymentMethod ?? "Credit"],
          ["Paid", money(inv.amountPaid)],
          ["Balance Due", inv.isCancelled ? "-" : money(inv.amountDue)],
        ]}
        columns={[{ label: "#" }, { label: "Product" }, { label: "Quantity", align: "right" }, { label: "Unit Price", align: "right" }, { label: "Discount", align: "right" }, { label: "Tax", align: "right" }, { label: "Transport", align: "right" }, { label: "Total", align: "right" }]}
        rows={rows}
        totals={[
          { label: "Subtotal", value: money(inv.subtotal) },
          { label: "Discount", value: `- ${money(inv.discountAmount)}` },
          { label: "Tax", value: money(inv.taxAmount) },
          { label: "Transportation", value: money(inv.transportAmount) },
          { label: "Grand Total", value: money(inv.totalAmount), strong: true },
        ]}
        footer="Thank you for your business. Goods once sold are only returnable within the agreed return period."
        actions={
          <>
            <Link href="/sales/invoices" className="text-sm text-slate-500 hover:underline mr-2">
              ← All invoices
            </Link>
            {!inv.isCancelled && (
              <ConfirmForm action={cancelInvoiceAction} message="Cancel this invoice? Stock will be returned to inventory and the customer balance adjusted.">
                <input type="hidden" name="id" value={inv.id} />
                <button className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                  <Ban size={16} /> Cancel Invoice
                </button>
              </ConfirmForm>
            )}
          </>
        }
      />
    </div>
  );
}
