import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentView } from "@/components/documents/DocumentView";
import { Flash } from "@/components/ui/Flash";
import { getPurchaseReturn } from "@/lib/services/purchasing";
import { dateShort, money, num, qty } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PurchaseReturnDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const retId = Number(id);
  if (!Number.isFinite(retId)) notFound();
  const ret = await getPurchaseReturn(retId);
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
    <div className="space-y-6">
      <Flash saved={sp.saved} error={sp.error} />
      <DocumentView
        title="Purchase Return"
        number={ret.returnNumber}
        date={dateShort(ret.date)}
        status={{ label: "Returned", tone: "blue" }}
        party={{
          heading: "Returned To",
          name: ret.supplier?.name ?? "Unknown supplier",
          lines: [ret.supplier?.companyName, ret.supplier?.address, ret.supplier?.phone],
        }}
        meta={[
          ["Original Receipt", ret.grnNumber ?? "-"],
          ["Reason", ret.reason ?? "-"],
        ]}
        columns={[
          { label: "#" },
          { label: "Product" },
          { label: "Quantity", align: "right" },
          { label: "Unit Price", align: "right" },
          { label: "Tax", align: "right" },
          { label: "Total", align: "right" },
        ]}
        rows={rows}
        totals={[
          { label: "Subtotal", value: money(ret.subtotal) },
          { label: "Tax", value: money(ret.taxAmount) },
          { label: "Credit Amount", value: money(ret.totalAmount), strong: true },
        ]}
        footer="The returned quantities have been removed from stock and deducted from the supplier balance."
        actions={
          <>
            <Link href="/purchasing/returns" className="text-sm text-slate-500 hover:underline mr-2">
              ← All returns
            </Link>
            {ret.supplier && (
              <Link href={`/purchasing/suppliers/${ret.supplier.id}`} className="text-sm text-blue-600 hover:underline">
                Supplier account
              </Link>
            )}
          </>
        }
      />
    </div>
  );
}
