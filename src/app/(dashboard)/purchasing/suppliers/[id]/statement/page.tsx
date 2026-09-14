import React from "react";
import { notFound } from "next/navigation";
import { Printer, Filter } from "lucide-react";
import { Field, PageHeader, StatTile, inputClass } from "@/components/ui";
import { DataTable, type Cell } from "@/components/ui/DataTable";
import { PrintButton } from "@/components/documents/PrintButton";
import { getBusinessProfile } from "@/components/documents/DocumentView";
import { getSupplierStatement } from "@/lib/services/purchasing";
import { parseDateInput, toDateInput } from "@/lib/calc";
import { dateShort, money, num } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SupplierStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supplierId = Number(id);
  if (!Number.isFinite(supplierId)) notFound();

  const from = parseDateInput(sp.from, null);
  const to = parseDateInput(sp.to, null);
  const [data, biz] = await Promise.all([getSupplierStatement(supplierId, from, to), getBusinessProfile()]);
  if (!data) notFound();
  const { supplier, opening, rows } = data;

  let running = opening;
  const tableRows: Cell[][] = [];
  if (from) {
    tableRows.push([
      { text: dateShort(from), sort: from.getTime() },
      { text: "Opening balance", bold: true },
      { text: "" },
      { text: "" },
      { text: "" },
      { text: money(opening), sort: opening, bold: true },
    ]);
  }
  for (const r of rows) {
    running = Math.round((running + num(r.credit) - num(r.debit)) * 100) / 100;
    tableRows.push([
      { text: dateShort(r.date), sort: new Date(r.date).getTime() },
      { text: r.reference ?? "-", muted: true },
      { text: `${r.type}${r.notes ? ` — ${r.notes}` : ""}` },
      { text: num(r.credit) > 0 ? money(r.credit) : "", sort: num(r.credit) },
      { text: num(r.debit) > 0 ? money(r.debit) : "", sort: num(r.debit) },
      { text: money(running), sort: running, bold: true },
    ]);
  }

  const purchases = rows.reduce((s, r) => s + num(r.credit), 0);
  const paid = rows.reduce((s, r) => s + num(r.debit), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier Statement"
        subtitle={supplier.name}
        actions={
          <PrintButton>
            <Printer size={16} /> Print / Save PDF
          </PrintButton>
        }
      />

      <form className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-end gap-3 print:hidden">
        <Field label="From">
          <input type="date" name="from" defaultValue={sp.from ?? ""} className={inputClass} />
        </Field>
        <Field label="To">
          <input type="date" name="to" defaultValue={sp.to ?? ""} className={inputClass} />
        </Field>
        <button className="inline-flex h-[38px] items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700">
          <Filter size={15} /> Apply
        </button>
        <a href={`/purchasing/suppliers/${supplier.id}/statement`} className="text-sm text-slate-500 hover:underline pb-2.5">
          Clear
        </a>
      </form>

      <div className="hidden print:block border-b border-slate-300 pb-4 mb-4">
        <div className="flex justify-between">
          <div>
            <h1 className="text-xl font-bold">{biz?.businessName}</h1>
            <p className="text-sm text-slate-600">{biz?.address}</p>
            <p className="text-sm text-slate-600">{[biz?.phone, biz?.panVatNumber && `PAN/VAT ${biz.panVatNumber}`].filter(Boolean).join(" • ")}</p>
          </div>
          <div className="text-right">
            <h2 className="text-lg font-bold uppercase">Supplier Statement</h2>
            <p className="text-sm">{supplier.name}</p>
            <p className="text-sm text-slate-600">
              {from ? dateShort(from) : "Beginning"} to {to ? dateShort(to) : dateShort(new Date())}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Opening Balance" value={money(opening)} />
        <StatTile label="Purchases in Period" value={money(purchases)} tone="amber" />
        <StatTile label="Paid / Returned in Period" value={money(paid)} tone="green" />
        <StatTile label="Closing Balance" value={money(running)} tone={running > 0 ? "red" : "green"} />
      </div>

      <DataTable
        title="Statement"
        exportName={`statement-${supplier.name.replace(/\s+/g, "-").toLowerCase()}`}
        pageSize={50}
        columns={[
          { label: "Date" },
          { label: "Reference" },
          { label: "Details" },
          { label: "Purchases (+)", align: "right", total: true },
          { label: "Paid / Returned (−)", align: "right", total: true },
          { label: "Balance", align: "right" },
        ]}
        rows={tableRows}
        emptyMessage="No transactions in this period."
      />
      <p className="text-xs text-slate-500 print:hidden">
        Showing {toDateInput(from ?? undefined) || "all history"} {to ? `to ${toDateInput(to)}` : ""}. A positive balance means you owe the supplier.
      </p>
    </div>
  );
}
