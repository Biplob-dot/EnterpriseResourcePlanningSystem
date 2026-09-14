import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CreditCard, Pencil, Power, Receipt, ScrollText } from "lucide-react";
import { Badge, Card, LinkButton, PageHeader, StatTile } from "@/components/ui";
import { DataTable, type Cell } from "@/components/ui/DataTable";
import { Flash } from "@/components/ui/Flash";
import { ConfirmForm } from "@/components/documents/PrintButton";
import { getCustomerDetail } from "@/lib/services/sales";
import { toggleCustomerActive } from "../../actions";
import { dateShort, money, num } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const customerId = Number(id);
  if (!Number.isFinite(customerId)) notFound();
  const detail = await getCustomerDetail(customerId);
  if (!detail) notFound();
  const { customer, invoices, returns, payments, ledger, agg, overdue } = detail;
  const balance = num(customer.outstandingBalance);

  const ledgerRows: Cell[][] = ledger.map((l) => [
    { text: dateShort(l.date), sort: new Date(l.date).getTime() },
    { text: l.reference ?? "-", muted: true },
    { text: l.type, tone: l.type === "INVOICE" ? "amber" : l.type === "PAYMENT" ? "green" : l.type === "RETURN" ? "blue" : "slate" },
    { text: l.notes ?? "-", muted: true },
    { text: num(l.credit) > 0 ? money(l.credit) : "", sort: num(l.credit) },
    { text: num(l.debit) > 0 ? money(l.debit) : "", sort: num(l.debit) },
    { text: money(l.balanceAfter), sort: num(l.balanceAfter), bold: true },
  ]);

  const invRows: Cell[][] = invoices.map((i) => [
    { text: i.invoiceNumber, href: `/sales/invoices/${i.id}` },
    { text: dateShort(i.date), sort: i.date ? new Date(i.date).getTime() : 0 },
    { text: i.isCancelled ? "Cancelled" : (i.status ?? "UNPAID").replace(/_/g, " "), tone: i.isCancelled ? "slate" : i.status === "PAID" ? "green" : i.status === "PARTIALLY_PAID" ? "blue" : "amber" },
    { text: money(i.totalAmount), sort: num(i.totalAmount) },
    { text: money(i.amountPaid), sort: num(i.amountPaid) },
    { text: money(i.amountDue), sort: num(i.amountDue), bold: true },
  ]);

  const payRows: Cell[][] = payments.map((p) => [
    { text: p.paymentNumber, muted: true },
    { text: dateShort(p.date), sort: p.date ? new Date(p.date).getTime() : 0 },
    { text: p.paymentMethod ?? "-", muted: true },
    { text: p.reference ?? "-", muted: true },
    { text: money(p.amount), sort: num(p.amount) },
  ]);

  const retRows: Cell[][] = returns.map((r) => [
    { text: r.returnNumber, href: `/sales/returns/${r.id}` },
    { text: dateShort(r.date), sort: r.date ? new Date(r.date).getTime() : 0 },
    { text: r.reason ?? "-", muted: true },
    { text: money(r.totalAmount), sort: num(r.totalAmount) },
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={customer.name}
        subtitle={[customer.companyName, customer.phone, customer.email].filter(Boolean).join(" • ") || "Customer"}
        actions={
          <>
            <ConfirmForm action={toggleCustomerActive} message={customer.isActive ? "Deactivate this customer?" : "Activate this customer again?"}>
              <input type="hidden" name="id" value={customer.id} />
              <button className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <Power size={16} /> {customer.isActive ? "Deactivate" : "Activate"}
              </button>
            </ConfirmForm>
            <LinkButton href={`/sales/customers/${customer.id}/statement`} variant="secondary">
              <ScrollText size={16} /> Statement
            </LinkButton>
            <LinkButton href={`/sales/customers/${customer.id}/edit`} variant="secondary">
              <Pencil size={16} /> Edit
            </LinkButton>
            <LinkButton href={`/sales/invoices/new?customerId=${customer.id}`}>
              <Receipt size={16} /> New Invoice
            </LinkButton>
            <LinkButton href={`/sales/payments/new?customerId=${customer.id}`}>
              <CreditCard size={16} /> Record Payment
            </LinkButton>
          </>
        }
      />
      <Flash saved={sp.saved} error={sp.error} />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatTile label={balance < 0 ? "Advance Credit" : "Outstanding"} value={money(Math.abs(balance))} tone={balance > 0 ? "amber" : balance < 0 ? "blue" : "green"} />
        <StatTile label="Total Invoiced" value={money(agg?.invoiced)} tone="blue" />
        <StatTile label="Total Paid" value={money(agg?.paid)} tone="green" />
        <StatTile label="Total Returned" value={money(agg?.returned)} tone="indigo" />
        <StatTile label="Overdue" value={String(overdue.length)} tone={overdue.length ? "red" : "green"} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <Card title="Customer Information">
          <dl className="p-5 space-y-2.5 text-sm">
            {(
              [
                ["Company", customer.companyName],
                ["Contact Person", customer.contactPerson],
                ["Phone", customer.phone],
                ["Email", customer.email],
                ["PAN / VAT", customer.panVatNumber],
                ["Address", customer.address],
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
                <Badge tone={customer.isActive ? "green" : "slate"}>{customer.isActive ? "Active" : "Inactive"}</Badge>
              </dd>
            </div>
            {customer.notes && <p className="text-slate-600 pt-2">{customer.notes}</p>}
          </dl>
        </Card>

        <div className="xl:col-span-2">
          <DataTable
            title="Account Activity"
            exportName={`customer-${customer.id}-activity`}
            pageSize={10}
            columns={[
              { label: "Date" },
              { label: "Reference" },
              { label: "Type" },
              { label: "Details" },
              { label: "Charged (+)", align: "right" },
              { label: "Paid/Returned (−)", align: "right" },
              { label: "Balance", align: "right" },
            ]}
            rows={ledgerRows}
            emptyMessage="No activity with this customer yet."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <DataTable title="Invoices" exportName={`customer-${customer.id}-invoices`} pageSize={8} columns={[{ label: "Invoice No." }, { label: "Date" }, { label: "Status" }, { label: "Total", align: "right" }, { label: "Paid", align: "right" }, { label: "Due", align: "right" }]} rows={invRows} emptyMessage="No invoices yet." />
        <DataTable title="Payments" exportName={`customer-${customer.id}-payments`} pageSize={8} columns={[{ label: "Payment No." }, { label: "Date" }, { label: "Method" }, { label: "Reference" }, { label: "Amount", align: "right", total: true }]} rows={payRows} emptyMessage="No payments recorded." />
        <DataTable title="Returns" exportName={`customer-${customer.id}-returns`} pageSize={8} columns={[{ label: "Return No." }, { label: "Date" }, { label: "Reason" }, { label: "Amount", align: "right", total: true }]} rows={retRows} emptyMessage="No returns recorded." />
      </div>
    </div>
  );
}
