import React from "react";
import { db } from "@/db";
import { bins, warehouses } from "@/db/schema";
import { PageHeader, StatTile } from "@/components/ui";
import { DataTable, type Cell } from "@/components/ui/DataTable";
import { getInventorySummary, stockStatus } from "@/lib/services/inventory";
import { ensureSeed } from "@/lib/seed";
import { money, num, qty } from "@/lib/format";
import { AdjustForm } from "./AdjustForm";

export const dynamic = "force-dynamic";

export default async function StockPage() {
  await ensureSeed();
  const { levels, totalQuantity, totalValue, lowStock, outOfStock } = await getInventorySummary();
  const [whs, bns] = await Promise.all([
    db.select({ id: warehouses.id, name: warehouses.name }).from(warehouses),
    db.select({ id: bins.id, name: bins.name }).from(bins),
  ]);

  const rows: Cell[][] = levels.map((p) => {
    const status = stockStatus(p.stock, p.reorderLevel, p.minStockLevel);
    return [
      { text: p.code, href: `/inventory/products/${p.id}` },
      { text: p.name, sort: p.name },
      { text: p.category ?? "-", muted: true },
      { text: `${qty(p.stock)} ${p.unit ?? ""}`, sort: p.stock, bold: true },
      { text: qty(p.reorderLevel), sort: num(p.reorderLevel), muted: true },
      { text: money(p.purchasePrice), sort: num(p.purchasePrice) },
      { text: money(p.stockValue), sort: p.stockValue },
      { text: status.label, tone: status.tone },
    ];
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Levels"
        subtitle="Live quantities and valuation across the warehouse, plus quick stock corrections."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Total Stock Quantity" value={qty(totalQuantity)} />
        <StatTile label="Stock Value (at cost)" value={money(totalValue)} tone="blue" />
        <StatTile label="Low Stock Items" value={String(lowStock.length)} tone="amber" />
        <StatTile label="Out of Stock Items" value={String(outOfStock.length)} tone="red" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className="xl:col-span-2">
          <DataTable
            title="Stock Summary"
            exportName="stock-summary"
            columns={[
              { label: "Code" },
              { label: "Product" },
              { label: "Category" },
              { label: "In Stock", align: "right" },
              { label: "Reorder At", align: "right" },
              { label: "Unit Cost", align: "right" },
              { label: "Stock Value", align: "right", total: true },
              { label: "Status" },
            ]}
            rows={rows}
            emptyMessage="No products found."
          />
        </div>
        <AdjustForm
          products={levels.map((l) => ({
            id: l.id,
            code: l.code,
            name: l.name,
            stock: l.stock,
            unit: l.unit,
          }))}
          warehouses={whs}
          bins={bns}
        />
      </div>
    </div>
  );
}
