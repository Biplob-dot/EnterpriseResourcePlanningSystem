import React from "react";
import { PageHeader, StatTile } from "@/components/ui";
import { DataTable, type Cell, type Column } from "@/components/ui/DataTable";
import { ReportFilters, ReportNav, ReportPrintHeader, ReportTabs } from "@/components/reports/ReportControls";
import { getPurchaseReportData } from "@/lib/services/reports";
import { getSuppliers } from "@/lib/services/purchasing";
import { parseDateInput, toDateInput } from "@/lib/calc";
import { dateShort, money, num, qty } from "@/lib/format";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

const views = [
  { key: "receipts", label: "Goods Received" },
  { key: "supplier", label: "By Supplier" },
  { key: "product", label: "By Product" },
  { key: "category", label: "By Category" },
  { key: "returns", label: "Returns" },
  { key: "outstanding", label: "Supplier Outstanding" },
];

export default async function PurchaseReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; view?: string }> }) {
  await ensureSeed();
  const sp = await searchParams;
  const from = parseDateInput(sp.from, null);
  const to = parseDateInput(sp.to, null);
  const view = views.some((v) => v.key === sp.view) ? sp.view! : "receipts";
  const [data, allSuppliers] = await Promise.all([getPurchaseReportData(from, to), getSuppliers()]);
  const preserve = `?from=${encodeURIComponent(sp.from ?? "")}&to=${encodeURIComponent(sp.to ?? "")}`;

  const purchaseTotal = data.receipts.reduce((s, r) => s + num(r.total), 0);
  const taxTotal = data.receipts.reduce((s, r) => s + num(r.tax), 0);
  const returnsTotal = data.returns.reduce((s, r) => s + num(r.total), 0);
  const payable = allSuppliers.reduce((s, r) => s + Math.max(0, num(r.outstandingBalance)), 0);

  let title = "Goods Received / Purchases";
  let columns: Column[] = [];
  let rows: Cell[][] = [];

  if (view === "receipts") {
    columns = [
      { label: "GRN" },
      { label: "Date" },
      { label: "Supplier" },
      { label: "Subtotal", align: "right", total: true },
      { label: "Tax", align: "right", total: true },
      { label: "Total", align: "right", total: true },
    ];
    rows = data.receipts.map((r) => [
      { text: r.grnNumber, href: `/purchasing/grn/${r.id}` },
      { text: dateShort(r.date), sort: r.date ? new Date(r.date).getTime() : 0 },
      { text: r.supplier ?? "-", sort: r.supplier ?? "" },
      { text: money(r.subtotal), sort: num(r.subtotal) },
      { text: money(r.tax), sort: num(r.tax) },
      { text: money(r.total), sort: num(r.total), bold: true },
    ]);
  } else if (view === "supplier") {
    title = "Purchases by Supplier";
    columns = [
      { label: "Supplier" },
      { label: "Receipts", align: "right", total: true },
      { label: "Subtotal", align: "right", total: true },
      { label: "Tax", align: "right", total: true },
      { label: "Purchase Total", align: "right", total: true },
      { label: "Outstanding", align: "right", total: true },
    ];
    rows = data.bySupplier.map((r) => [
      { text: r.supplier ?? "Unknown", href: r.supplierId ? `/purchasing/suppliers/${r.supplierId}` : undefined },
      { text: String(num(r.receipts)), sort: num(r.receipts) },
      { text: money(r.subtotal), sort: num(r.subtotal) },
      { text: money(r.tax), sort: num(r.tax) },
      { text: money(r.total), sort: num(r.total), bold: true },
      { text: money(r.outstanding), sort: num(r.outstanding) },
    ]);
  } else if (view === "product") {
    title = "Purchases by Product";
    columns = [
      { label: "Rank" },
      { label: "Code" },
      { label: "Product" },
      { label: "Accepted Qty", align: "right", total: true },
      { label: "Damaged Qty", align: "right", total: true },
      { label: "Unit" },
      { label: "Purchase Value", align: "right", total: true },
    ];
    rows = data.byProduct.map((r, i) => [
      { text: String(i + 1), sort: i + 1, muted: true },
      { text: r.code, muted: true },
      { text: r.product, href: `/inventory/products/${r.productId}` },
      { text: qty(r.received), sort: num(r.received), bold: true },
      { text: qty(r.damaged), sort: num(r.damaged) },
      { text: r.unit ?? "-", muted: true },
      { text: money(r.total), sort: num(r.total) },
    ]);
  } else if (view === "category") {
    title = "Purchases by Category";
    columns = [
      { label: "Category" },
      { label: "Quantity Received", align: "right", total: true },
      { label: "Purchase Value", align: "right", total: true },
      { label: "Share", align: "right" },
    ];
    rows = data.byCategory.map((r) => [
      { text: r.category ?? "Uncategorised" },
      { text: qty(r.received), sort: num(r.received) },
      { text: money(r.total), sort: num(r.total), bold: true },
      { text: purchaseTotal ? `${((num(r.total) / purchaseTotal) * 100).toFixed(1)}%` : "0%", sort: purchaseTotal ? num(r.total) / purchaseTotal : 0 },
    ]);
  } else if (view === "returns") {
    title = "Purchase Returns";
    columns = [
      { label: "Return" },
      { label: "Date" },
      { label: "Supplier" },
      { label: "Reason" },
      { label: "Subtotal", align: "right", total: true },
      { label: "Tax", align: "right", total: true },
      { label: "Total Credit", align: "right", total: true },
    ];
    rows = data.returns.map((r) => [
      { text: r.returnNumber, href: `/purchasing/returns/${r.id}` },
      { text: dateShort(r.date), sort: r.date ? new Date(r.date).getTime() : 0 },
      { text: r.supplier ?? "-" },
      { text: r.reason ?? "-", muted: true },
      { text: money(r.subtotal), sort: num(r.subtotal) },
      { text: money(r.tax), sort: num(r.tax) },
      { text: money(r.total), sort: num(r.total), bold: true },
    ]);
  } else {
    title = "Supplier Outstanding Balances";
    columns = [
      { label: "Supplier" },
      { label: "Company" },
      { label: "Credit Period" },
      { label: "Total Purchased", align: "right", total: true },
      { label: "Outstanding", align: "right", total: true },
      { label: "Position" },
    ];
    rows = allSuppliers.map((r) => {
      const balance = num(r.outstandingBalance);
      return [
        { text: r.name, href: `/purchasing/suppliers/${r.id}` },
        { text: r.companyName ?? "-", muted: true },
        { text: r.creditPeriod != null ? `${r.creditPeriod} days` : "-", sort: r.creditPeriod ?? 0 },
        { text: money(r.totalPurchased), sort: num(r.totalPurchased) },
        { text: money(Math.abs(balance)), sort: balance, bold: true },
        { text: balance > 0 ? "We owe" : balance < 0 ? "Advance paid" : "Settled", tone: balance > 0 ? "red" : balance < 0 ? "blue" : "green" },
      ];
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Purchase Reports" subtitle="Purchasing activity by supplier, product and category, including returns." />
      <ReportNav active="Purchases" />
      <ReportFilters from={sp.from} to={sp.to} clearHref="/reports/purchases">
        <input type="hidden" name="view" value={view} />
      </ReportFilters>
      <ReportPrintHeader title={title} range={`${dateShort(data.range.from)} to ${dateShort(data.range.to)}`} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Purchases" value={money(purchaseTotal)} tone="blue" />
        <StatTile label="Purchase Returns" value={money(returnsTotal)} tone="indigo" />
        <StatTile label="Input Tax" value={money(taxTotal)} tone="green" />
        <StatTile label="Supplier Payable" value={money(payable)} tone="red" />
      </div>

      <ReportTabs items={views} active={view} baseHref="/reports/purchases" preserve={preserve} />
      <DataTable title={title} exportName={`purchases-${view}`} pageSize={25} columns={columns} rows={rows} emptyMessage={`No ${title.toLowerCase()} records.`} />
      <p className="text-xs text-slate-500 print:hidden">Date range: {toDateInput(data.range.from)} to {toDateInput(data.range.to)}. Goods received, not purchase orders, determine purchase totals.</p>
    </div>
  );
}
