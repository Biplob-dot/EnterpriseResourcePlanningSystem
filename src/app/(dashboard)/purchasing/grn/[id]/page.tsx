import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDownLeft } from "lucide-react";
import { DocumentView } from "@/components/documents/DocumentView";
import { Flash } from "@/components/ui/Flash";
import { getGoodsReceipt } from "@/lib/services/purchasing";
import { dateShort, money, num, qty } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function GrnDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const grnId = Number(id);
  if (!Number.isFinite(grnId)) notFound();
  const grn = await getGoodsReceipt(grnId);
  if (!grn) notFound();

  const rows = grn.items.map((i, idx) => {
    const received = num(i.quantityReceived);
    const damaged = num(i.quantityDamaged);
    return [
      String(idx + 1),
      `${i.name ?? ""} (${i.code ?? ""})`,
      `${qty(received)} ${i.unit ?? ""}`,
      damaged > 0 ? qty(damaged) : "-",
      qty(received - damaged),
      [i.warehouse, i.bin].filter(Boolean).join(" / ") || "-",
      i.batchNumber ?? "-",
      money(i.unitPrice),
      money(i.total),
    ];
  });

  return (
    <div className="space-y-6">
      <Flash saved={sp.saved} error={sp.error} />
      <DocumentView
        title="Goods Received Note"
        number={grn.grnNumber}
        date={dateShort(grn.date)}
        status={{ label: "Received", tone: "green" }}
        party={{
          heading: "Supplier",
          name: grn.supplier?.name ?? "Unknown supplier",
          lines: [grn.supplier?.companyName, grn.supplier?.address, grn.supplier?.phone, grn.supplier?.panVatNumber ? `PAN/VAT: ${grn.supplier.panVatNumber}` : null],
        }}
        meta={[
          ["Purchase Order", grn.poNumber ?? "Direct purchase"],
          ["Supplier Reference", grn.notes || "-"],
          ["Lines", String(grn.items.length)],
        ]}
        columns={[
          { label: "#" },
          { label: "Product" },
          { label: "Received", align: "right" },
          { label: "Damaged", align: "right" },
          { label: "Accepted", align: "right" },
          { label: "Location" },
          { label: "Batch" },
          { label: "Unit Price", align: "right" },
          { label: "Total", align: "right" },
        ]}
        rows={rows}
        totals={[
          { label: "Subtotal", value: money(grn.subtotal) },
          { label: "Discount", value: `- ${money(grn.discountAmount)}` },
          { label: "Tax", value: money(grn.taxAmount) },
          { label: "Total Payable", value: money(grn.totalAmount), strong: true },
        ]}
        footer="Accepted quantities have been added to stock. Damaged quantities were rejected and are not payable."
        actions={
          <>
            <Link href="/purchasing/grn" className="text-sm text-slate-500 hover:underline mr-2">
              ← All receipts
            </Link>
            {grn.supplier && (
              <Link href={`/purchasing/suppliers/${grn.supplier.id}`} className="text-sm text-blue-600 hover:underline mr-2">
                Supplier account
              </Link>
            )}
            <Link
              href={`/purchasing/returns/new?grnId=${grn.id}`}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <ArrowDownLeft size={16} /> Return Items
            </Link>
          </>
        }
      />
    </div>
  );
}
