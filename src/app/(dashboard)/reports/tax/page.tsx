import React from "react";
import { Card, PageHeader, StatTile } from "@/components/ui";
import { DataTable, type Cell } from "@/components/ui/DataTable";
import { ReportFilters, ReportNav, ReportPrintHeader } from "@/components/reports/ReportControls";
import { getTaxReportData } from "@/lib/services/reports";
import { parseDateInput, toDateInput } from "@/lib/calc";
import { dateShort, money } from "@/lib/format";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

export default async function TaxReportPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await ensureSeed();
  const sp = await searchParams;
  const from = parseDateInput(sp.from, null);
  const to = parseDateInput(sp.to, null);
  const data = await getTaxReportData(from, to);

  const salesTaxable = data.rows.reduce((s, r) => s + r.salesTaxable, 0);
  const outputTax = data.rows.reduce((s, r) => s + r.outputTax, 0);
  const purchaseTaxable = data.rows.reduce((s, r) => s + r.purchaseTaxable, 0);
  const inputTax = data.rows.reduce((s, r) => s + r.inputTax, 0);
  const netTax = outputTax - inputTax;

  const rows: Cell[][] = data.rows.map((r) => [
    { text: r.period, sort: r.period },
    { text: money(r.salesTaxable), sort: r.salesTaxable },
    { text: money(r.outputTax), sort: r.outputTax },
    { text: money(r.purchaseTaxable), sort: r.purchaseTaxable },
    { text: money(r.inputTax), sort: r.inputTax },
    { text: money(r.netTax), sort: r.netTax, bold: true, tone: r.netTax > 0 ? "red" : r.netTax < 0 ? "blue" : "green" },
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Tax / VAT Report" subtitle="Output VAT on sales minus input VAT on purchases, adjusted for returns." />
      <ReportNav active="Tax / VAT" />
      <ReportFilters from={sp.from} to={sp.to} clearHref="/reports/tax" />
      <ReportPrintHeader title="Tax / VAT Report" range={`${dateShort(data.range.from)} to ${dateShort(data.range.to)}`} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="Taxable Sales" value={money(salesTaxable)} tone="blue" />
        <StatTile label="Output VAT" value={money(outputTax)} tone="amber" />
        <StatTile label="Taxable Purchases" value={money(purchaseTaxable)} tone="indigo" />
        <StatTile label="Input VAT" value={money(inputTax)} tone="green" />
        <StatTile label={netTax >= 0 ? "Net VAT Payable" : "VAT Credit"} value={money(Math.abs(netTax))} tone={netTax > 0 ? "red" : "green"} />
      </div>

      <DataTable
        title="Monthly VAT Summary"
        exportName="tax-vat-report"
        pageSize={24}
        columns={[
          { label: "Month" },
          { label: "Taxable Sales", align: "right", total: true },
          { label: "Output VAT", align: "right", total: true },
          { label: "Taxable Purchases", align: "right", total: true },
          { label: "Input VAT", align: "right", total: true },
          { label: "VAT Payable / (Credit)", align: "right", total: true },
        ]}
        rows={rows}
        emptyMessage="No taxable transactions in this period."
      />

      <Card title="How this tax report works">
        <div className="space-y-2 p-5 text-sm leading-6 text-slate-600">
          <p><strong className="text-slate-800">Output VAT</strong> is VAT charged on sales, less VAT reversed on customer returns.</p>
          <p><strong className="text-slate-800">Input VAT</strong> is VAT paid on stock purchases, less VAT reversed on purchase returns.</p>
          <p><strong className="text-slate-800">Net VAT payable</strong> = Output VAT − Input VAT. A negative result is displayed as a VAT credit.</p>
          <p className="text-xs">Period: {toDateInput(data.range.from)} to {toDateInput(data.range.to)}. This is a configurable ERP report, not tax-filing advice; confirm local filing treatment with your accountant.</p>
        </div>
      </Card>
    </div>
  );
}
