import React from "react";
import { Plus, Settings2, Ruler } from "lucide-react";
import { DataTable, type Cell } from "@/components/ui/DataTable";
import { LinkButton, PageHeader, StatTile } from "@/components/ui";
import { Flash } from "@/components/ui/Flash";
import { CsvImport } from "@/components/forms/CsvImport";
import { DeleteButton } from "@/components/forms/DeleteButton";
import { getInventorySummary, stockStatus } from "@/lib/services/inventory";
import { deleteProduct, importProductsCsv } from "../actions";
import { ensureSeed } from "@/lib/seed";
import { money, num, qty } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  await ensureSeed();
  const sp = await searchParams;
  const { levels, totalProducts, totalValue, lowStock, outOfStock } = await getInventorySummary();

  const columns = [
    { label: "Code" },
    { label: "Product Name" },
    { label: "Category" },
    { label: "Brand" },
    { label: "Unit" },
    { label: "Purchase", align: "right" as const },
    { label: "Selling", align: "right" as const },
    { label: "Stock", align: "right" as const },
    { label: "Value", align: "right" as const, total: true },
    { label: "Status" },
    { label: "", align: "center" as const },
  ];

  const rows: Cell[][] = levels.map((p) => {
    const status = p.isActive === false
      ? { label: "Inactive", tone: "slate" as const }
      : stockStatus(p.stock, p.reorderLevel, p.minStockLevel);
    return [
      { text: p.code, sort: p.code, href: `/inventory/products/${p.id}` },
      { text: p.name, sort: p.name },
      { text: p.category ?? "-", sort: p.category ?? "" },
      { text: p.brand ?? "-", sort: p.brand ?? "" },
      { text: p.unit ?? "-", sort: p.unit ?? "" },
      { text: money(p.purchasePrice), sort: num(p.purchasePrice) },
      { text: money(p.sellingPrice), sort: num(p.sellingPrice) },
      { text: qty(p.stock), sort: p.stock, bold: true },
      { text: money(p.stockValue), sort: p.stockValue },
      { text: status.label, tone: status.tone },
      {
        text: "",
        node: (
          <DeleteButton
            action={deleteProduct}
            id={p.id}
            iconOnly
            label="Delete product"
            message={`Delete "${p.name}"?\n\nIf this product has any sales, purchases or stock history it will be safely deactivated instead of deleted (so your records stay intact).`}
          />
        ),
      },
    ];
  });

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Every item you buy and sell, with live stock and valuation."
        actions={
          <>
            <LinkButton href="/inventory/units" variant="secondary">
              <Ruler size={16} /> Units
            </LinkButton>
            <LinkButton href="/inventory/categories" variant="secondary">
              <Settings2 size={16} /> Categories
            </LinkButton>
            <CsvImport
              action={importProductsCsv}
              title="Import Products from CSV"
              buttonLabel="Import CSV"
              columnsHelp="Required: code, name. Optional: barcode, category, brand, unit, purchasePrice, sellingPrice, taxRate, minStockLevel, reorderLevel, openingStock, thickness, length, width, grade, finish, description."
              sampleHeader="code,name,category,brand,unit,purchasePrice,sellingPrice,taxRate,openingStock"
            />
            <LinkButton href="/inventory/products/new">
              <Plus size={16} /> New Product
            </LinkButton>
          </>
        }
      />
      <Flash saved={sp.saved} error={sp.error} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatTile label="Total Products" value={String(totalProducts)} />
        <StatTile label="Inventory Value" value={money(totalValue)} tone="blue" />
        <StatTile label="Low Stock" value={String(lowStock.length)} tone="amber" />
        <StatTile label="Out of Stock" value={String(outOfStock.length)} tone="red" />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        title="Product Catalogue"
        exportName="products"
        emptyMessage="No products yet. Click 'New Product' to add your first item."
      />
    </div>
  );
}
