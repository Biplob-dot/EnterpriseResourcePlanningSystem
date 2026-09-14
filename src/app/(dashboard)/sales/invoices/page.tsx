import React from "react";
import { Receipt } from "lucide-react";
import { LinkButton, PageHeader, StatTile } from "@/components/ui";
import { DataTable, type Cell } from "@/components/ui/DataTable";
import { Flash } from "@/components/ui/Flash";
import { getInvoices } from "@/lib/services/sales";
import { ensureSeed } from "@/lib/seed";
import { dateShort, money, num } from "@/lib/format";
import { invTone } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await ensureSeed();
  const sp = await searchParams;
  const rows = await getInvoices();

  const totalSales = rows.filter((r) => !r.isCancelled).reduce((s, r) => s + num(r.totalAmount), 0);
  const unpaid = rows.filter((r) => !r.isCancelled && (r.status === "UNPAID" || r.status === "PARTIALLY_PAID")).reduce((s, r) => s + num(r.amountDue), 0);

  const data: Cell[][] = rows.map((inv) => [
    { text: inv.invoiceNumber, href: `/sales/invoices/${inv.id}` },
    { text: dateShort(inv.date), sort: inv.date ? new Date(inv.date).getTime() : 0 },
    { text: inv.customer ?? "-", sort: inv.customer ?? "" },
    { text: inv.isCancelled ? "Cancelled" : (inv.status ?? "UNPAID").replace(/_/g, " "), tone: invTone(inv.status, inv.isCancelled ?? false) },
    { text: money(inv.totalAmount), sort: num(inv.totalAmount) },
    { text: money(inv.amountPaid), sort: num(inv.amountPaid) },
    { text: inv.isCancelled ? "-" : money(inv.amountDue), sort: num(inv.amountDue), bold: true },
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Invoices"
        subtitle="All invoices — cash and credit, paid and outstanding."
        actions={
          <LinkButton href="/sales/invoices/new">
            <Receipt size={16} /> New Invoice
          </LinkButton>
        }
      />
      <Flash saved={sp.saved} error={sp.error} />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatTile label="Total Sales" value={money(totalSales)} tone="blue" />
        <StatTile label="Outstanding" value={money(unpaid)} tone="amber" />
        <StatTile label="Invoices" value={String(rows.length)} />
      </div>

      <DataTable
        title="Invoice List"
        exportName="invoices"
        columns={[
          { label: "Invoice No." },
          { label: "Date" },
          { label: "Customer" },
          { label: "Status" },
          { label: "Total", align: "right", total: true },
          { label: "Paid", align: "right", total: true },
          { label: "Due", align: "right", total: true },
        ]}
        rows={data}
        emptyMessage="No invoices yet. Click 'New Invoice' to record a sale."
      />
    </div>
  );
}
