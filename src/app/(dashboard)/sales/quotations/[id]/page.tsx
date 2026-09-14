import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Send } from "lucide-react";
import { DocumentView } from "@/components/documents/DocumentView";
import { ConfirmForm } from "@/components/documents/PrintButton";
import { Flash } from "@/components/ui/Flash";
import { getQuotation } from "@/lib/services/sales";
import { changeQuoteStatus, convertQuote } from "../../actions";
import { dateShort, money, num, qty } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function QuotationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const qId = Number(id);
  if (!Number.isFinite(qId)) notFound();
  const q = await getQuotation(qId);
  if (!q) notFound();

  const status = q.status ?? "DRAFT";
  const canConvert = status === "DRAFT" || status === "SENT";

  const rows = q.items.map((i, idx) => {
    const qtyVal = num(i.quantity);
    return [
      String(idx + 1),
      `${i.name ?? ""}\n${i.code ?? ""}`,
      qty(qtyVal),
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
        title="Quotation"
        number={q.quoteNumber}
        date={dateShort(q.date)}
        status={{ label: (status ?? "DRAFT").replace(/_/g, " "), tone: status === "ACCEPTED" ? "green" : status === "SENT" ? "blue" : status === "REJECTED" || status === "EXPIRED" ? "red" : "slate" }}
        party={{ heading: "Customer", name: q.customer?.name ?? "Unknown customer", lines: [q.customer?.companyName, q.customer?.address, q.customer?.phone, q.customer?.panVatNumber ? `PAN/VAT: ${q.customer.panVatNumber}` : null] }}
        meta={[["Quote Date", dateShort(q.date)], ["Valid Until", q.validUntil ? dateShort(q.validUntil) : "-"], ["Lines", String(q.items.length)]]}
        columns={[{ label: "#" }, { label: "Product" }, { label: "Quantity", align: "right" }, { label: "Unit Price", align: "right" }, { label: "Discount", align: "right" }, { label: "Tax", align: "right" }, { label: "Total", align: "right" }]}
        rows={rows}
        totals={[
          { label: "Subtotal", value: money(q.subtotal) },
          { label: "Discount", value: `- ${money(q.discountAmount)}` },
          { label: "Tax", value: money(q.taxAmount) },
          { label: "Grand Total", value: money(q.totalAmount), strong: true },
        ]}
        notes={q.notes}
        footer="This is a quotation and is not a tax invoice. Prices are valid until the date shown above."
        actions={
          <>
            <Link href="/sales/quotations" className="text-sm text-slate-500 hover:underline mr-2">
              ← All quotations
            </Link>
            {canConvert && (
              <>
                <ConfirmForm action={convertQuote} message="Convert this quotation into a sales order?">
                  <input type="hidden" name="id" value={q.id} />
                  <input type="hidden" name="target" value="SALES_ORDER" />
                  <button className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    <ArrowRight size={16} /> To Sales Order
                  </button>
                </ConfirmForm>
                <ConfirmForm action={convertQuote} message="Convert this quotation directly into an invoice? Stock will be reduced now.">
                  <input type="hidden" name="id" value={q.id} />
                  <input type="hidden" name="target" value="INVOICE" />
                  <button className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                    <ArrowRight size={16} /> To Invoice
                  </button>
                </ConfirmForm>
              </>
            )}
            {(status === "DRAFT") && (
              <ConfirmForm action={changeQuoteStatus} message="Mark this quotation as sent to the customer?">
                <input type="hidden" name="id" value={q.id} />
                <input type="hidden" name="status" value="SENT" />
                <button className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <Send size={16} /> Mark Sent
                </button>
              </ConfirmForm>
            )}
          </>
        }
      />
    </div>
  );
}
