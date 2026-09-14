import React from "react";
import { PageHeader, StatTile } from "@/components/ui";
import { DataTable, type Cell } from "@/components/ui/DataTable";
import { ReportNav, ReportPrintHeader } from "@/components/reports/ReportControls";
import { PrintButton } from "@/components/documents/PrintButton";
import { Printer } from "lucide-react";
import { getReceivableAging } from "@/lib/services/finance";
import { dateShort, money, num } from "@/lib/format";
import { ensureSeed } from "@/lib/seed";
import { invTone } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function ReceivablesReportPage() {
  await ensureSeed();
  const rows = await getReceivableAging();
  const total = rows.reduce((s, r) => s + num(r.due), 0);
  const sumBucket = (key: string) => rows.filter((r) => r.bucket === key).reduce((s, r) => s + num(r.due), 0);

  const data: Cell[][] = rows.map((r) => [
    { text: r.customer ?? "Unknown", href: r.customerId ? `/sales/customers/${r.customerId}` : undefined },
    { text: r.invoiceNumber, href: `/sales/invoices/${r.invoiceId}` },
    { text: dateShort(r.date), sort: r.date ? new Date(r.date).getTime() : 0 },
    { text: r.dueDate ? dateShort(r.dueDate) : "On receipt", sort: r.dueDate ? new Date(r.dueDate).getTime() : 0 },
    { text: money(r.total), sort: num(r.total) },
    { text: money(r.paid), sort: num(r.paid) },
    { text: money(r.due), sort: num(r.due), bold: true },
    { text: String(r.daysOverdue), sort: r.daysOverdue, tone: r.daysOverdue > 90 ? "red" : r.daysOverdue > 30 ? "amber" : r.daysOverdue > 0 ? "blue" : "green" },
    { text: (r.status ?? "UNPAID").replace(/_/g, " "), tone: invTone(r.status) },
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Accounts Receivable Aging" subtitle="Invoices customers still owe, grouped by how long they are overdue." actions={<PrintButton><Printer size={15} /> Print / Save PDF</PrintButton>} />
      <ReportNav active="Receivables" />
      <ReportPrintHeader title="Accounts Receivable Aging" range={`As at ${dateShort(new Date())}`} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <StatTile label="Total Receivable" value={money(total)} tone="amber" />
        <StatTile label="Current" value={money(sumBucket("current"))} tone="green" />
        <StatTile label="1–30 Days" value={money(sumBucket("d30"))} tone="blue" />
        <StatTile label="31–60 Days" value={money(sumBucket("d60"))} tone="amber" />
        <StatTile label="61–90 Days" value={money(sumBucket("d90"))} tone="amber" />
        <StatTile label="90+ Days" value={money(sumBucket("d90p"))} tone="red" />
      </div>

      <DataTable
        title="Outstanding Customer Invoices"
        exportName="accounts-receivable-aging"
        pageSize={30}
        columns={[
          { label: "Customer" },
          { label: "Invoice" },
          { label: "Invoice Date" },
          { label: "Due Date" },
          { label: "Amount", align: "right", total: true },
          { label: "Paid", align: "right", total: true },
          { label: "Balance", align: "right", total: true },
          { label: "Days Overdue", align: "right" },
          { label: "Status" },
        ]}
        rows={data}
        emptyMessage="No outstanding customer invoices."
      />
      <p className="text-xs text-slate-500 print:hidden">Current means not yet due or no due date. Aging is calculated from each invoice due date through today.</p>
    </div>
  );
}
