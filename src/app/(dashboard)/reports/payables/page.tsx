import React from "react";
import { PageHeader, StatTile } from "@/components/ui";
import { DataTable, type Cell } from "@/components/ui/DataTable";
import { ReportNav, ReportPrintHeader } from "@/components/reports/ReportControls";
import { PrintButton } from "@/components/documents/PrintButton";
import { Printer } from "lucide-react";
import { getPayableAging } from "@/lib/services/finance";
import { dateShort, money, num } from "@/lib/format";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

export default async function PayablesReportPage() {
  await ensureSeed();
  const rows = await getPayableAging();
  const total = rows.reduce((s, r) => s + num(r.outstanding), 0);
  const sumBucket = (key: string) => rows.filter((r) => r.bucket === key).reduce((s, r) => s + num(r.outstanding), 0);

  const data: Cell[][] = rows.map((r) => [
    { text: r.supplier, href: `/purchasing/suppliers/${r.supplierId}` },
    { text: String(num(r.receiptCount)), sort: num(r.receiptCount) },
    { text: r.firstPurchase ? dateShort(r.firstPurchase) : "Opening balance", sort: r.firstPurchase ? new Date(r.firstPurchase).getTime() : 0 },
    { text: r.lastPurchase ? dateShort(r.lastPurchase) : "-", sort: r.lastPurchase ? new Date(r.lastPurchase).getTime() : 0 },
    { text: r.dueDate ? dateShort(r.dueDate) : "-", sort: r.dueDate ? r.dueDate.getTime() : 0 },
    { text: money(r.purchases), sort: num(r.purchases) },
    { text: money(r.outstanding), sort: num(r.outstanding), bold: true },
    { text: String(r.daysOverdue), sort: r.daysOverdue, tone: r.daysOverdue > 90 ? "red" : r.daysOverdue > 30 ? "amber" : r.daysOverdue > 0 ? "blue" : "green" },
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Accounts Payable Aging" subtitle="What is still owed to suppliers, grouped by age." actions={<PrintButton><Printer size={15} /> Print / Save PDF</PrintButton>} />
      <ReportNav active="Payables" />
      <ReportPrintHeader title="Accounts Payable Aging" range={`As at ${dateShort(new Date())}`} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <StatTile label="Total Payable" value={money(total)} tone="red" />
        <StatTile label="Current" value={money(sumBucket("current"))} tone="green" />
        <StatTile label="1–30 Days" value={money(sumBucket("d30"))} tone="blue" />
        <StatTile label="31–60 Days" value={money(sumBucket("d60"))} tone="amber" />
        <StatTile label="61–90 Days" value={money(sumBucket("d90"))} tone="amber" />
        <StatTile label="90+ Days" value={money(sumBucket("d90p"))} tone="red" />
      </div>

      <DataTable
        title="Supplier Balances"
        exportName="accounts-payable-aging"
        pageSize={30}
        columns={[
          { label: "Supplier" },
          { label: "Receipts", align: "right" },
          { label: "First Purchase" },
          { label: "Last Purchase" },
          { label: "Due From" },
          { label: "Total Purchases", align: "right", total: true },
          { label: "Balance", align: "right", total: true },
          { label: "Days Overdue", align: "right" },
        ]}
        rows={data}
        emptyMessage="No outstanding supplier balances."
      />
      <p className="text-xs text-slate-500 print:hidden">Supplier payments are maintained as account balances rather than allocated to individual receipts. Aging starts from the oldest unpaid supplier activity plus that supplier&apos;s credit period.</p>
    </div>
  );
}
