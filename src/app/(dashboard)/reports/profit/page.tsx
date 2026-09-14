import React from "react";
import { Card, PageHeader, StatTile } from "@/components/ui";
import { DataTable, type Cell, type Column } from "@/components/ui/DataTable";
import { ReportFilters, ReportNav, ReportPrintHeader, ReportTabs } from "@/components/reports/ReportControls";
import { getProfitReportData } from "@/lib/services/reports";
import { parseDateInput, toDateInput } from "@/lib/calc";
import { dateShort, money, num, qty } from "@/lib/format";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

const views = [
  { key: "product", label: "By Product" },
  { key: "category", label: "By Category" },
  { key: "customer", label: "By Customer" },
];

export default async function ProfitReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; view?: string }> }) {
  await ensureSeed();
  const sp = await searchParams;
  const from = parseDateInput(sp.from, null);
  const to = parseDateInput(sp.to, null);
  const view = views.some((v) => v.key === sp.view) ? sp.view! : "product";
  const data = await getProfitReportData(from, to);
  const s = data.summary;
  const preserve = `?from=${encodeURIComponent(sp.from ?? "")}&to=${encodeURIComponent(sp.to ?? "")}`;

  let title = "Profit by Product";
  let columns: Column[] = [];
  let rows: Cell[][] = [];

  if (view === "product") {
    columns = [
      { label: "Rank" },
      { label: "Code" },
      { label: "Product" },
      { label: "Quantity Sold", align: "right", total: true },
      { label: "Net Sales", align: "right", total: true },
      { label: "Cost of Goods", align: "right", total: true },
      { label: "Gross Profit", align: "right", total: true },
      { label: "Margin", align: "right" },
    ];
    rows = data.byProduct.map((r, i) => [
      { text: String(i + 1), sort: i + 1, muted: true },
      { text: r.code, muted: true },
      { text: r.product, href: `/inventory/products/${r.productId}` },
      { text: qty(r.quantity), sort: num(r.quantity) },
      { text: money(r.salesNumber), sort: r.salesNumber },
      { text: money(r.cogsNumber), sort: r.cogsNumber },
      { text: money(r.profit), sort: r.profit, bold: true, tone: r.profit >= 0 ? "green" : "red" },
      { text: r.salesNumber ? `${((r.profit / r.salesNumber) * 100).toFixed(1)}%` : "0%", sort: r.salesNumber ? r.profit / r.salesNumber : 0 },
    ]);
  } else if (view === "category") {
    title = "Profit by Category";
    columns = [
      { label: "Category" },
      { label: "Net Sales", align: "right", total: true },
      { label: "Cost of Goods", align: "right", total: true },
      { label: "Gross Profit", align: "right", total: true },
      { label: "Margin", align: "right" },
    ];
    rows = data.byCategory.map((r) => [
      { text: r.category ?? "Uncategorised" },
      { text: money(r.salesNumber), sort: r.salesNumber },
      { text: money(r.cogsNumber), sort: r.cogsNumber },
      { text: money(r.profit), sort: r.profit, bold: true, tone: r.profit >= 0 ? "green" : "red" },
      { text: r.salesNumber ? `${((r.profit / r.salesNumber) * 100).toFixed(1)}%` : "0%", sort: r.salesNumber ? r.profit / r.salesNumber : 0 },
    ]);
  } else {
    title = "Profit by Customer";
    columns = [
      { label: "Customer" },
      { label: "Net Sales", align: "right", total: true },
      { label: "Cost of Goods", align: "right", total: true },
      { label: "Gross Profit", align: "right", total: true },
      { label: "Margin", align: "right" },
    ];
    rows = data.byCustomer.map((r) => [
      { text: r.customer ?? "Unknown", href: r.customerId ? `/sales/customers/${r.customerId}` : undefined },
      { text: money(r.salesNumber), sort: r.salesNumber },
      { text: money(r.cogsNumber), sort: r.cogsNumber },
      { text: money(r.profit), sort: r.profit, bold: true, tone: r.profit >= 0 ? "green" : "red" },
      { text: r.salesNumber ? `${((r.profit / r.salesNumber) * 100).toFixed(1)}%` : "0%", sort: r.salesNumber ? r.profit / r.salesNumber : 0 },
    ]);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Profit Reports" subtitle="Understand what is earned after product costs and operating expenses." />
      <ReportNav active="Profit" />
      <ReportFilters from={sp.from} to={sp.to} clearHref="/reports/profit">
        <input type="hidden" name="view" value={view} />
      </ReportFilters>
      <ReportPrintHeader title={title} range={`${dateShort(data.range.from)} to ${dateShort(data.range.to)}`} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Net Sales" value={money(s.netSales)} tone="blue" />
        <StatTile label="Cost of Goods Sold" value={money(s.cogs)} tone="amber" />
        <StatTile label="Gross Profit" value={money(s.grossProfit)} tone={s.grossProfit >= 0 ? "green" : "red"} />
        <StatTile label="Net Profit" value={money(s.netProfit)} tone={s.netProfit >= 0 ? "green" : "red"} />
      </div>

      <Card title="Profit & Loss Summary">
        <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-2">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Gross invoice sales (excluding VAT)</dt><dd className="font-medium">{money(s.grossSales)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Less: sales returns</dt><dd className="font-medium text-red-600">− {money(s.returns)}</dd></div>
            <div className="flex justify-between border-t border-slate-200 pt-2"><dt className="font-medium">Net Sales</dt><dd className="font-semibold">{money(s.netSales)}</dd></div>
            <div className="flex justify-between text-xs"><dt className="text-slate-400 pl-3">of which transportation billed</dt><dd className="text-slate-500">{money(s.transport)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Less: cost of goods sold</dt><dd className="font-medium text-red-600">− {money(s.cogs)}</dd></div>
            <div className="flex justify-between border-t border-slate-300 pt-2 text-base"><dt className="font-semibold">Gross Profit</dt><dd className="font-bold">{money(s.grossProfit)}</dd></div>
          </dl>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Gross Profit</dt><dd className="font-medium">{money(s.grossProfit)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Add: other income</dt><dd className="font-medium text-emerald-600">+ {money(s.otherIncome)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Less: operating expenses</dt><dd className="font-medium text-red-600">− {money(s.expenses)}</dd></div>
            <div className="flex justify-between border-t border-slate-300 pt-2 text-base"><dt className="font-semibold">Net Profit</dt><dd className={`font-bold ${s.netProfit >= 0 ? "text-emerald-700" : "text-red-700"}`}>{money(s.netProfit)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">VAT collected (not income)</dt><dd className="font-medium">{money(s.tax)}</dd></div>
          </dl>
        </div>
      </Card>

      <ReportTabs items={views} active={view} baseHref="/reports/profit" preserve={preserve} />
      <DataTable title={title} exportName={`profit-${view}`} pageSize={25} columns={columns} rows={rows} emptyMessage="No invoiced sales in this period." />

      <Card title="How this report is calculated">
        <div className="space-y-2 p-5 text-sm leading-6 text-slate-600">
          <p><strong className="text-slate-800">Net Sales</strong> = invoice sales excluding VAT − sales returns excluding VAT. This includes transportation charges billed to customers, since transport is money the business earns.</p>
          <p><strong className="text-slate-800">Gross Profit</strong> = Net Sales − Cost of Goods Sold. Product cost is captured on each invoice line at the time of sale, so later price changes do not rewrite old profit.</p>
          <p><strong className="text-slate-800">Net Profit</strong> = Gross Profit + Other Income − Operating Expenses. Stock purchases are assets, not expenses; their cost enters profit only when goods are sold.</p>
          <p className="text-xs">Period: {toDateInput(data.range.from)} to {toDateInput(data.range.to)}. Cancelled invoices and reversed expenses are excluded.</p>
        </div>
      </Card>
    </div>
  );
}
