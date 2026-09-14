import React from "react";
import { CreditCard } from "lucide-react";
import { LinkButton, PageHeader, StatTile } from "@/components/ui";
import { DataTable, type Cell } from "@/components/ui/DataTable";
import { Flash } from "@/components/ui/Flash";
import { getSupplierPayments, getSuppliers } from "@/lib/services/purchasing";
import { ensureSeed } from "@/lib/seed";
import { dateShort, money, num } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SupplierPaymentsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await ensureSeed();
  const sp = await searchParams;
  const [rows, sups] = await Promise.all([getSupplierPayments(), getSuppliers()]);

  const now = new Date();
  const monthTotal = rows
    .filter((r) => r.date && new Date(r.date).getMonth() === now.getMonth() && new Date(r.date).getFullYear() === now.getFullYear())
    .reduce((s, r) => s + num(r.amount), 0);
  const payable = sups.reduce((s, r) => s + Math.max(0, num(r.outstandingBalance)), 0);

  const data: Cell[][] = rows.map((p) => [
    { text: p.paymentNumber, muted: true },
    { text: dateShort(p.date), sort: p.date ? new Date(p.date).getTime() : 0 },
    { text: p.supplier, href: `/purchasing/suppliers/${p.supplierId}`, sort: p.supplier },
    { text: p.paymentMethod ?? "-", tone: p.paymentMethod === "Cash" ? "green" : "blue" },
    { text: p.reference ?? "-", muted: true },
    { text: p.notes ?? "-", muted: true },
    { text: money(p.amount), sort: num(p.amount), bold: true },
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier Payments"
        subtitle="Money paid out to suppliers."
        actions={
          <LinkButton href="/purchasing/payments/new">
            <CreditCard size={16} /> Pay Supplier
          </LinkButton>
        }
      />
      <Flash saved={sp.saved} error={sp.error} />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatTile label="Paid This Month" value={money(monthTotal)} tone="green" />
        <StatTile label="Total Paid" value={money(rows.reduce((s, r) => s + num(r.amount), 0))} tone="blue" />
        <StatTile label="Still Owed to Suppliers" value={money(payable)} tone="red" />
      </div>

      <DataTable
        title="Payment History"
        exportName="supplier-payments"
        columns={[
          { label: "Payment No." },
          { label: "Date" },
          { label: "Supplier" },
          { label: "Method" },
          { label: "Reference" },
          { label: "Notes" },
          { label: "Amount", align: "right", total: true },
        ]}
        rows={data}
        emptyMessage="No supplier payments recorded yet."
      />
    </div>
  );
}
