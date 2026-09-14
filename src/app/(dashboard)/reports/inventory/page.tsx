import React from "react";
import { PageHeader, StatTile, Field, inputClass } from "@/components/ui";
import { DataTable, type Cell, type Column } from "@/components/ui/DataTable";
import {
  ReportFilters,
  ReportNav,
  ReportPrintHeader,
  ReportTabs,
} from "@/components/reports/ReportControls";
import { getInventoryReportData } from "@/lib/services/reports";
import { parseDateInput, toDateInput } from "@/lib/calc";
import { dateShort, money, num, qty } from "@/lib/format";
import { stockStatus } from "@/lib/services/inventory";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

const views = [
  { key: "summary", label: "Stock Summary" },
  { key: "movement", label: "Movement" },
  { key: "low", label: "Low Stock" },
  { key: "out", label: "Out of Stock" },
  { key: "fast", label: "Fast Moving" },
  { key: "slow", label: "Slow Moving" },
  { key: "dead", label: "Dead Stock" },
];

export default async function InventoryReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; view?: string; days?: string }>;
}) {
  await ensureSeed();
  const sp = await searchParams;
  const from = parseDateInput(sp.from, null);
  const to = parseDateInput(sp.to, null);
  const deadDays = Math.max(1, Math.min(3650, Number(sp.days) || 90));
  const view = views.some((v) => v.key === sp.view) ? sp.view! : "summary";
  const data = await getInventoryReportData(from, to, deadDays);

  const totalValue = data.levels.reduce((s, r) => s + r.stockValue, 0);
  const low = data.levels.filter((r) => r.stock > 0 && num(r.reorderLevel) > 0 && r.stock <= num(r.reorderLevel));
  const out = data.levels.filter((r) => r.stock <= 0);
  const preserve = `?from=${encodeURIComponent(sp.from ?? "")}&to=${encodeURIComponent(sp.to ?? "")}&days=${deadDays}`;
  const rangeText = `${dateShort(data.range.from)} to ${dateShort(data.range.to)}`;

  let columns: Column[] = [];
  let rows: Cell[][] = [];
  let title = "Stock Summary";

  if (view === "summary" || view === "low" || view === "out") {
    const source = view === "low" ? low : view === "out" ? out : data.levels;
    title = view === "low" ? "Low Stock" : view === "out" ? "Out of Stock" : "Stock Summary & Valuation";
    columns = [
      { label: "Code" },
      { label: "Product" },
      { label: "Category" },
      { label: "Quantity", align: "right", total: true },
      { label: "Unit" },
      { label: "Cost", align: "right" },
      { label: "Selling Price", align: "right" },
      { label: "Stock Value", align: "right", total: true },
      { label: "Reorder At", align: "right" },
      { label: "Status" },
    ];
    rows = source.map((r) => {
      const status = stockStatus(r.stock, r.reorderLevel, r.minStockLevel);
      return [
        { text: r.code, href: `/inventory/products/${r.id}` },
        { text: r.name, sort: r.name },
        { text: r.category ?? "-", muted: true },
        { text: qty(r.stock), sort: r.stock, bold: true },
        { text: r.unit ?? "-", muted: true },
        { text: money(r.purchasePrice), sort: num(r.purchasePrice) },
        { text: money(r.sellingPrice), sort: num(r.sellingPrice) },
        { text: money(r.stockValue), sort: r.stockValue },
        { text: qty(r.reorderLevel), sort: num(r.reorderLevel), muted: true },
        { text: status.label, tone: status.tone },
      ];
    });
  } else if (view === "movement") {
    title = "Stock Movement";
    columns = [
      { label: "Date" },
      { label: "Code" },
      { label: "Product" },
      { label: "Transaction" },
      { label: "Reference" },
      { label: "Quantity In", align: "right", total: true },
      { label: "Quantity Out", align: "right", total: true },
      { label: "Balance", align: "right" },
    ];
    rows = data.movement.map((r) => {
      const amount = num(r.quantity);
      return [
        { text: dateShort(r.date), sort: r.date ? new Date(r.date).getTime() : 0 },
        { text: r.code, muted: true },
        { text: r.product, href: `/inventory/products/${r.productId}` },
        { text: r.type.replace(/_/g, " "), tone: amount >= 0 ? "green" : "red" },
        { text: r.reference ?? "-", muted: true },
        { text: amount > 0 ? qty(amount) : "", sort: amount > 0 ? amount : 0 },
        { text: amount < 0 ? qty(Math.abs(amount)) : "", sort: amount < 0 ? Math.abs(amount) : 0 },
        { text: qty(r.balance), sort: num(r.balance), bold: true },
      ];
    });
  } else if (view === "fast" || view === "slow") {
    const source = view === "fast" ? data.fastMoving : data.slowMoving;
    title = view === "fast" ? "Fast-Moving Products" : "Slow-Moving Products";
    columns = [
      { label: "Rank" },
      { label: "Code" },
      { label: "Product" },
      { label: "Category" },
      { label: "Qty Sold", align: "right", total: true },
      { label: "Sales Value", align: "right", total: true },
      { label: "Stock Now", align: "right" },
      { label: "Last Sale" },
    ];
    rows = source.map((r, i) => [
      { text: String(i + 1), sort: i + 1, muted: true },
      { text: r.code, muted: true },
      { text: r.name, href: `/inventory/products/${r.id}` },
      { text: r.category ?? "-", muted: true },
      { text: qty(r.soldQuantity), sort: r.soldQuantity, bold: true },
      { text: money(r.soldValue), sort: r.soldValue },
      { text: `${qty(r.stock)} ${r.unit ?? ""}`, sort: r.stock },
      { text: r.lastSale ? dateShort(r.lastSale) : "Never", muted: true },
    ]);
  } else {
    title = `Dead Stock (${deadDays}+ Days)`;
    columns = [
      { label: "Code" },
      { label: "Product" },
      { label: "Category" },
      { label: "Quantity", align: "right", total: true },
      { label: "Unit Cost", align: "right" },
      { label: "Tied-up Value", align: "right", total: true },
      { label: "Last Movement" },
      { label: "Days Idle", align: "right" },
    ];
    rows = data.deadStock.map((r) => [
      { text: r.code, muted: true },
      { text: r.name, href: `/inventory/products/${r.id}` },
      { text: r.category ?? "-", muted: true },
      { text: qty(r.stock), sort: r.stock, bold: true },
      { text: money(r.purchasePrice), sort: num(r.purchasePrice) },
      { text: money(r.stockValue), sort: r.stockValue },
      { text: r.lastMovement ? dateShort(r.lastMovement) : "Never", muted: true },
      { text: r.daysSinceMovement == null ? "Never moved" : String(r.daysSinceMovement), sort: r.daysSinceMovement ?? 999999 },
    ]);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory Reports" subtitle="Stock quantities, valuation and product movement analysis." />
      <ReportNav active="Inventory" />
      <ReportFilters from={sp.from} to={sp.to} clearHref="/reports/inventory">
        <Field label="Dead stock after">
          <select name="days" defaultValue={String(deadDays)} className={inputClass}>
            <option value="30">30 days</option>
            <option value="60">60 days</option>
            <option value="90">90 days</option>
            <option value="180">180 days</option>
            <option value="365">365 days</option>
          </select>
        </Field>
        <input type="hidden" name="view" value={view} />
      </ReportFilters>
      <ReportPrintHeader title={title} range={rangeText} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Stock Value" value={money(totalValue)} tone="indigo" />
        <StatTile label="Products" value={String(data.levels.length)} />
        <StatTile label="Low Stock" value={String(low.length)} tone="amber" />
        <StatTile label="Dead Stock Value" value={money(data.deadStock.reduce((s, r) => s + r.stockValue, 0))} tone="red" />
      </div>

      <ReportTabs items={views} active={view} baseHref="/reports/inventory" preserve={preserve} />
      <DataTable title={title} exportName={`inventory-${view}`} pageSize={25} columns={columns} rows={rows} emptyMessage={`No ${title.toLowerCase()} records for this selection.`} />
      <p className="text-xs text-slate-500 print:hidden">
        Movement-based rankings use {toDateInput(data.range.from)} through {toDateInput(data.range.to)}. Stock value is current quantity × current purchase cost.
      </p>
    </div>
  );
}
