import React from "react";
import { PageHeader, StatTile } from "@/components/ui";
import { DataTable, type Cell, type Column } from "@/components/ui/DataTable";
import { ReportFilters, ReportNav, ReportPrintHeader, ReportTabs } from "@/components/reports/ReportControls";
import { getSalesReportData } from "@/lib/services/reports";
import { parseDateInput, toDateInput } from "@/lib/calc";
import { dateShort, money, num, qty } from "@/lib/format";
import { ensureSeed } from "@/lib/seed";
import { invTone } from "@/lib/status";

export const dynamic = "force-dynamic";

const views = [
  { key: "invoices", label: "Invoices" },
  { key: "daily", label: "Daily" },
  { key: "monthly", label: "Monthly" },
  { key: "product", label: "By Product" },
  { key: "category", label: "By Category" },
  { key: "customer", label: "By Customer" },
  { key: "method", label: "By Payment Method" },
  { key: "returns", label: "Returns" },
  { key: "outstanding", label: "Outstanding" },
];

export default async function SalesReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; view?: string }> }) {
  await ensureSeed();
  const sp = await searchParams;
  const from = parseDateInput(sp.from, null);
  const to = parseDateInput(sp.to, null);
  const view = views.some((v) => v.key === sp.view) ? sp.view! : "invoices";
  const data = await getSalesReportData(from, to);
  const preserve = `?from=${encodeURIComponent(sp.from ?? "")}&to=${encodeURIComponent(sp.to ?? "")}`;

  const totalSales = data.invoiceRows.reduce((s, r) => s + num(r.total), 0);
  const totalTax = data.invoiceRows.reduce((s, r) => s + num(r.tax), 0);
  const totalDue = data.invoiceRows.reduce((s, r) => s + num(r.due), 0);
  const returnTotal = data.returnRows.reduce((s, r) => s + num(r.total), 0);

  let title = "Invoice Sales";
  let columns: Column[] = [];
  let rows: Cell[][] = [];

  if (view === "invoices" || view === "outstanding") {
    const source = view === "outstanding" ? data.invoiceRows.filter((r) => num(r.due) > 0) : data.invoiceRows;
    title = view === "outstanding" ? "Outstanding Invoices" : "Invoice Sales";
    columns = [
      { label: "Invoice" },
      { label: "Date" },
      { label: "Customer" },
      { label: "Method" },
      { label: "Status" },
      { label: "Subtotal", align: "right", total: true },
      { label: "Tax", align: "right", total: true },
      { label: "Total", align: "right", total: true },
      { label: "Paid", align: "right", total: true },
      { label: "Due", align: "right", total: true },
    ];
    rows = source.map((r) => [
      { text: r.invoiceNumber, href: `/sales/invoices/${r.id}` },
      { text: dateShort(r.date), sort: r.date ? new Date(r.date).getTime() : 0 },
      { text: r.customer ?? "-", sort: r.customer ?? "" },
      { text: r.paymentMethod ?? "Credit", muted: true },
      { text: (r.status ?? "UNPAID").replace(/_/g, " "), tone: invTone(r.status) },
      { text: money(r.subtotal), sort: num(r.subtotal) },
      { text: money(r.tax), sort: num(r.tax) },
      { text: money(r.total), sort: num(r.total), bold: true },
      { text: money(r.paid), sort: num(r.paid) },
      { text: money(r.due), sort: num(r.due), bold: num(r.due) > 0 },
    ]);
  } else if (view === "daily" || view === "monthly") {
    const source = view === "daily" ? data.byDay : data.byMonth;
    title = view === "daily" ? "Daily Sales" : "Monthly Sales";
    columns = [
      { label: view === "daily" ? "Date" : "Month" },
      { label: "Invoices", align: "right", total: true },
      { label: "Subtotal", align: "right", total: true },
      { label: "Tax", align: "right", total: true },
      { label: "Total Sales", align: "right", total: true },
    ];
    rows = source.map((r) => [
      { text: r.period, sort: r.period },
      { text: String(num(r.invoices)), sort: num(r.invoices) },
      { text: money(r.subtotal), sort: num(r.subtotal) },
      { text: money(r.tax), sort: num(r.tax) },
      { text: money(r.total), sort: num(r.total), bold: true },
    ]);
  } else if (view === "product") {
    title = "Sales by Product";
    columns = [
      { label: "Rank" },
      { label: "Code" },
      { label: "Product" },
      { label: "Quantity", align: "right", total: true },
      { label: "Unit" },
      { label: "Sales Value", align: "right", total: true },
    ];
    rows = data.byProduct.map((r, i) => [
      { text: String(i + 1), sort: i + 1, muted: true },
      { text: r.code, muted: true },
      { text: r.product, href: `/inventory/products/${r.productId}` },
      { text: qty(r.quantity), sort: num(r.quantity), bold: true },
      { text: r.unit ?? "-", muted: true },
      { text: money(r.sales), sort: num(r.sales) },
    ]);
  } else if (view === "category") {
    title = "Sales by Category";
    columns = [
      { label: "Category" },
      { label: "Quantity", align: "right", total: true },
      { label: "Sales Value", align: "right", total: true },
      { label: "Share", align: "right" },
    ];
    rows = data.byCategory.map((r) => [
      { text: r.category ?? "Uncategorised", sort: r.category ?? "" },
      { text: qty(r.quantity), sort: num(r.quantity) },
      { text: money(r.sales), sort: num(r.sales), bold: true },
      { text: totalSales ? `${((num(r.sales) / totalSales) * 100).toFixed(1)}%` : "0%", sort: totalSales ? num(r.sales) / totalSales : 0 },
    ]);
  } else if (view === "customer") {
    title = "Sales by Customer";
    columns = [
      { label: "Customer" },
      { label: "Invoices", align: "right", total: true },
      { label: "Sales", align: "right", total: true },
      { label: "Paid", align: "right", total: true },
      { label: "Due", align: "right", total: true },
    ];
    rows = data.byCustomer.map((r) => [
      { text: r.customer ?? "Unknown", href: r.customerId ? `/sales/customers/${r.customerId}` : undefined },
      { text: String(num(r.invoices)), sort: num(r.invoices) },
      { text: money(r.sales), sort: num(r.sales), bold: true },
      { text: money(r.paid), sort: num(r.paid) },
      { text: money(r.due), sort: num(r.due) },
    ]);
  } else if (view === "method") {
    title = "Sales by Payment Method";
    columns = [
      { label: "Payment Method" },
      { label: "Invoices", align: "right", total: true },
      { label: "Invoice Value", align: "right", total: true },
      { label: "Amount Received", align: "right", total: true },
    ];
    rows = data.byMethod.map((r) => [
      { text: r.method ?? "Credit", sort: r.method ?? "Credit" },
      { text: String(num(r.invoices)), sort: num(r.invoices) },
      { text: money(r.total), sort: num(r.total), bold: true },
      { text: money(r.paid), sort: num(r.paid) },
    ]);
  } else {
    title = "Sales Returns";
    columns = [
      { label: "Return" },
      { label: "Date" },
      { label: "Customer" },
      { label: "Condition" },
      { label: "Reason" },
      { label: "Subtotal", align: "right", total: true },
      { label: "Tax", align: "right", total: true },
      { label: "Total", align: "right", total: true },
    ];
    rows = data.returnRows.map((r) => [
      { text: r.returnNumber, href: `/sales/returns/${r.id}` },
      { text: dateShort(r.date), sort: r.date ? new Date(r.date).getTime() : 0 },
      { text: r.customer ?? "-" },
      { text: (r.condition ?? "-").replace(/_/g, " "), tone: r.condition === "RESELLABLE" ? "green" : r.condition === "DAMAGED" ? "amber" : "red" },
      { text: r.reason ?? "-", muted: true },
      { text: money(r.subtotal), sort: num(r.subtotal) },
      { text: money(r.tax), sort: num(r.tax) },
      { text: money(r.total), sort: num(r.total), bold: true },
    ]);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Sales Reports" subtitle="Sales performance by date, product, category, customer and payment method." />
      <ReportNav active="Sales" />
      <ReportFilters from={sp.from} to={sp.to} clearHref="/reports/sales">
        <input type="hidden" name="view" value={view} />
      </ReportFilters>
      <ReportPrintHeader title={title} range={`${dateShort(data.range.from)} to ${dateShort(data.range.to)}`} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Gross Invoice Sales" value={money(totalSales)} tone="blue" />
        <StatTile label="Sales Returns" value={money(returnTotal)} tone="red" />
        <StatTile label="Tax Collected" value={money(totalTax)} tone="indigo" />
        <StatTile label="Outstanding" value={money(totalDue)} tone="amber" />
      </div>

      <ReportTabs items={views} active={view} baseHref="/reports/sales" preserve={preserve} />
      <DataTable title={title} exportName={`sales-${view}`} pageSize={25} columns={columns} rows={rows} emptyMessage={`No ${title.toLowerCase()} in this date range.`} />
      <p className="text-xs text-slate-500 print:hidden">
        Date range: {toDateInput(data.range.from)} to {toDateInput(data.range.to)}. Cancelled invoices are excluded from every sales figure.
      </p>
    </div>
  );
}
