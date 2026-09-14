import React from "react";
import { notFound } from "next/navigation";
import { CreditCard, FileText, Pencil, Power, ScrollText } from "lucide-react";
import { Badge, Card, LinkButton, PageHeader, StatTile } from "@/components/ui";
import { DataTable, type Cell } from "@/components/ui/DataTable";
import { Flash } from "@/components/ui/Flash";
import { ConfirmForm } from "@/components/documents/PrintButton";
import { DeleteButton } from "@/components/forms/DeleteButton";
import { getSupplierDetail } from "@/lib/services/purchasing";
import { deleteSupplier, toggleSupplierActive } from "../../actions";
import { dateShort, money, num } from "@/lib/format";

export const dynamic = "force-dynamic";

const poTone = (s: string | null): Cell["tone"] =>
  s === "RECEIVED" ? "green" : s === "PARTIALLY_RECEIVED" ? "blue" : s === "ORDERED" ? "amber" : s === "CANCELLED" ? "red" : "slate";

export default async function SupplierDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supplierId = Number(id);
  if (!Number.isFinite(supplierId)) notFound();
  const detail = await getSupplierDetail(supplierId);
  if (!detail) notFound();
  const { supplier, pos, grns, returns, payments, ledger, agg } = detail;
  const balance = num(supplier.outstandingBalance);

  const ledgerRows: Cell[][] = ledger.map((l) => [
    { text: dateShort(l.date), sort: new Date(l.date).getTime() },
    { text: l.reference ?? "-", muted: true },
    { text: l.type, tone: l.type === "PURCHASE" || l.type === "OPENING" ? "amber" : l.type === "PAYMENT" ? "green" : "blue" },
    { text: l.notes ?? "-", muted: true },
    { text: num(l.credit) > 0 ? money(l.credit) : "", sort: num(l.credit) },
    { text: num(l.debit) > 0 ? money(l.debit) : "", sort: num(l.debit) },
    { text: money(l.balanceAfter), sort: num(l.balanceAfter), bold: true },
  ]);

  const poRows: Cell[][] = pos.map((p) => [
    { text: p.poNumber, href: `/purchasing/pos/${p.id}` },
    { text: dateShort(p.date), sort: p.date ? new Date(p.date).getTime() : 0 },
    { text: (p.status ?? "DRAFT").replace(/_/g, " "), tone: poTone(p.status) },
    { text: money(p.totalAmount), sort: num(p.totalAmount) },
  ]);

  const grnRows: Cell[][] = grns.map((g) => [
    { text: g.grnNumber, href: `/purchasing/grn/${g.id}` },
    { text: dateShort(g.date), sort: g.date ? new Date(g.date).getTime() : 0 },
    { text: money(g.totalAmount), sort: num(g.totalAmount) },
  ]);

  const payRows: Cell[][] = payments.map((p) => [
    { text: p.paymentNumber, muted: true },
    { text: dateShort(p.date), sort: p.date ? new Date(p.date).getTime() : 0 },
    { text: p.paymentMethod ?? "-", muted: true },
    { text: p.reference ?? "-", muted: true },
    { text: money(p.amount), sort: num(p.amount) },
  ]);

  const retRows: Cell[][] = returns.map((r) => [
    { text: r.returnNumber, href: `/purchasing/returns/${r.id}` },
    { text: dateShort(r.date), sort: r.date ? new Date(r.date).getTime() : 0 },
    { text: r.reason ?? "-", muted: true },
    { text: money(r.totalAmount), sort: num(r.totalAmount) },
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={supplier.name}
        subtitle={[supplier.companyName, supplier.phone, supplier.email].filter(Boolean).join(" • ") || "Supplier"}
        actions={
          <>
            <ConfirmForm
              action={toggleSupplierActive}
              message={supplier.isActive ? "Deactivate this supplier? Their history will be kept." : "Activate this supplier again?"}
            >
              <input type="hidden" name="id" value={supplier.id} />
              <button className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <Power size={16} /> {supplier.isActive ? "Deactivate" : "Activate"}
              </button>
            </ConfirmForm>
            <LinkButton href={`/purchasing/suppliers/${supplier.id}/statement`} variant="secondary">
              <ScrollText size={16} /> Statement
            </LinkButton>
            <LinkButton href={`/purchasing/suppliers/${supplier.id}/edit`} variant="secondary">
              <Pencil size={16} /> Edit
            </LinkButton>
            <LinkButton href={`/purchasing/pos/new?supplierId=${supplier.id}`} variant="secondary">
              <FileText size={16} /> New Order
            </LinkButton>
            <LinkButton href={`/purchasing/payments/new?supplierId=${supplier.id}`}>
              <CreditCard size={16} /> Record Payment
            </LinkButton>
            <DeleteButton
              action={deleteSupplier}
              id={supplier.id}
              label="Delete"
              message={`Delete "${supplier.name}"?\n\nIf this supplier has any purchase orders, receipts, returns or payments it will be safely deactivated instead of deleted (so your records stay intact).`}
            />
          </>
        }
      />
      <Flash saved={sp.saved} error={sp.error} />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatTile label={balance < 0 ? "Advance Paid" : "We Owe"} value={money(Math.abs(balance))} tone={balance > 0 ? "red" : balance < 0 ? "blue" : "green"} />
        <StatTile label="Total Purchased" value={money(agg?.purchased)} tone="blue" />
        <StatTile label="Total Paid" value={money(agg?.paid)} tone="green" />
        <StatTile label="Total Returned" value={money(agg?.returned)} tone="amber" />
        <StatTile label="Credit Period" value={supplier.creditPeriod != null ? `${supplier.creditPeriod} days` : "-"} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <Card title="Supplier Information">
          <dl className="p-5 space-y-2.5 text-sm">
            {(
              [
                ["Company", supplier.companyName],
                ["Contact Person", supplier.contactPerson],
                ["Phone", supplier.phone],
                ["Email", supplier.email],
                ["PAN / VAT", supplier.panVatNumber],
                ["Payment Terms", supplier.paymentTerms],
                ["Address", supplier.address],
              ] as [string, string | null][]
            ).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-dashed border-slate-100 pb-2 last:border-0">
                <dt className="text-slate-500 shrink-0">{k}</dt>
                <dd className="font-medium text-slate-800 text-right">{v || "-"}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 pt-1">
              <dt className="text-slate-500">Status</dt>
              <dd>
                <Badge tone={supplier.isActive ? "green" : "slate"}>{supplier.isActive ? "Active" : "Inactive"}</Badge>
              </dd>
            </div>
            {supplier.notes && <p className="text-slate-600 pt-2">{supplier.notes}</p>}
          </dl>
        </Card>

        <div className="xl:col-span-2">
          <DataTable
            title="Account Activity"
            exportName={`supplier-${supplier.id}-activity`}
            pageSize={10}
            columns={[
              { label: "Date" },
              { label: "Reference" },
              { label: "Type" },
              { label: "Details" },
              { label: "Purchases (+)", align: "right" },
              { label: "Paid / Returned (−)", align: "right" },
              { label: "Balance", align: "right" },
            ]}
            rows={ledgerRows}
            emptyMessage="No activity with this supplier yet."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <DataTable
          title="Purchase Orders"
          exportName={`supplier-${supplier.id}-orders`}
          pageSize={8}
          columns={[{ label: "PO No." }, { label: "Date" }, { label: "Status" }, { label: "Total", align: "right" }]}
          rows={poRows}
          emptyMessage="No purchase orders yet."
        />
        <DataTable
          title="Goods Received"
          exportName={`supplier-${supplier.id}-receipts`}
          pageSize={8}
          columns={[{ label: "GRN No." }, { label: "Date" }, { label: "Amount", align: "right", total: true }]}
          rows={grnRows}
          emptyMessage="No goods received yet."
        />
        <DataTable
          title="Payments Made"
          exportName={`supplier-${supplier.id}-payments`}
          pageSize={8}
          columns={[{ label: "Payment No." }, { label: "Date" }, { label: "Method" }, { label: "Reference" }, { label: "Amount", align: "right", total: true }]}
          rows={payRows}
          emptyMessage="No payments recorded yet."
        />
        <DataTable
          title="Purchase Returns"
          exportName={`supplier-${supplier.id}-returns`}
          pageSize={8}
          columns={[{ label: "Return No." }, { label: "Date" }, { label: "Reason" }, { label: "Amount", align: "right", total: true }]}
          rows={retRows}
          emptyMessage="No returns recorded."
        />
      </div>
    </div>
  );
}
