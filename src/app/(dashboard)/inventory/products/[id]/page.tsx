import React from "react";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { db } from "@/db";
import { products, categories, brands, units, inventoryTransactions, warehouses } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { Badge, Card, LinkButton, PageHeader, StatTile } from "@/components/ui";
import { DataTable, type Cell } from "@/components/ui/DataTable";
import { getProductStock, stockStatus } from "@/lib/services/inventory";
import { dateTime, money, num, qty } from "@/lib/format";
import { ToggleActive } from "../ToggleActive";
import { DeleteButton } from "@/components/forms/DeleteButton";
import { deleteProduct } from "../../actions";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isFinite(productId)) notFound();

  const [row] = await db
    .select({
      p: products,
      category: categories.name,
      brand: brands.name,
      unit: units.symbol,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(brands, eq(products.brandId, brands.id))
    .leftJoin(units, eq(products.unitId, units.id))
    .where(eq(products.id, productId))
    .limit(1);

  if (!row) notFound();
  const p = row.p;
  const stock = await getProductStock(productId);
  const status = stockStatus(stock, p.reorderLevel, p.minStockLevel);

  const movements = await db
    .select({
      id: inventoryTransactions.id,
      createdAt: inventoryTransactions.createdAt,
      type: inventoryTransactions.transactionType,
      quantity: inventoryTransactions.quantity,
      previousStock: inventoryTransactions.previousStock,
      newStock: inventoryTransactions.newStock,
      reference: inventoryTransactions.referenceDocument,
      warehouse: warehouses.name,
      notes: inventoryTransactions.notes,
    })
    .from(inventoryTransactions)
    .leftJoin(warehouses, eq(inventoryTransactions.warehouseId, warehouses.id))
    .where(eq(inventoryTransactions.productId, productId))
    .orderBy(desc(inventoryTransactions.id))
    .limit(100);

  const rows: Cell[][] = movements.map((m) => {
    const q = num(m.quantity);
    return [
      { text: dateTime(m.createdAt), sort: m.createdAt ? new Date(m.createdAt).getTime() : 0 },
      { text: m.type.replace("_", " "), tone: q >= 0 ? "green" : "red" },
      { text: m.reference ?? "-", muted: true },
      { text: q > 0 ? qty(q) : "-", sort: q > 0 ? q : 0 },
      { text: q < 0 ? qty(Math.abs(q)) : "-", sort: q < 0 ? Math.abs(q) : 0 },
      { text: qty(m.newStock), sort: num(m.newStock), bold: true },
      { text: m.warehouse ?? "-", muted: true },
      { text: m.notes ?? "-", muted: true },
    ];
  });

  const details: [string, string][] = [
    ["Product Code", p.code],
    ["Barcode", p.barcode ?? "-"],
    ["Category", row.category ?? "-"],
    ["Brand", row.brand ?? "-"],
    ["Unit", row.unit ?? "-"],
    ["Tax Rate", `${num(p.taxRate)}%`],
    ["Thickness", p.thickness ?? "-"],
    ["Sheet Size", p.length && p.width ? `${num(p.length)} ft x ${num(p.width)} ft` : "-"],
    ["Area", p.area ? `${num(p.area)} sq.ft` : "-"],
    ["Grade", p.grade ?? "-"],
    ["Finish", p.finish ?? "-"],
    ["Reorder Level", qty(p.reorderLevel)],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={p.name}
        subtitle={`${p.code} • ${row.category ?? "Uncategorised"}`}
        actions={
          <>
            <DeleteButton
              action={deleteProduct}
              id={p.id}
              label="Delete"
              message={`Delete "${p.name}"?\n\nIf this product has any sales, purchases or stock history it will be safely deactivated instead of deleted (so your records stay intact).`}
            />
            <ToggleActive id={p.id} isActive={p.isActive ?? true} />
            <LinkButton href={`/inventory/products/${p.id}/edit`}>
              <Pencil size={16} /> Edit
            </LinkButton>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Current Stock" value={`${qty(stock)} ${row.unit ?? ""}`} tone={status.tone === "green" ? "green" : status.tone} />
        <StatTile label="Purchase Price" value={money(p.purchasePrice)} />
        <StatTile label="Selling Price" value={money(p.sellingPrice)} tone="blue" />
        <StatTile label="Stock Value" value={money(stock * num(p.purchasePrice))} tone="indigo" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Product Details" className="lg:col-span-1">
          <dl className="p-5 space-y-2.5 text-sm">
            {details.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-dashed border-slate-100 pb-2 last:border-0">
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-medium text-slate-800 text-right">{v}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 pt-1">
              <dt className="text-slate-500">Status</dt>
              <dd>
                <Badge tone={p.isActive ? "green" : "slate"}>{p.isActive ? "Active" : "Inactive"}</Badge>
              </dd>
            </div>
            {p.description && <p className="text-slate-600 pt-2">{p.description}</p>}
          </dl>
        </Card>

        <div className="lg:col-span-2">
          <DataTable
            title="Stock Movement History"
            exportName={`movement-${p.code}`}
            columns={[
              { label: "Date" },
              { label: "Type" },
              { label: "Reference" },
              { label: "In", align: "right" },
              { label: "Out", align: "right" },
              { label: "Balance", align: "right" },
              { label: "Warehouse" },
              { label: "Notes" },
            ]}
            rows={rows}
            emptyMessage="No stock movements recorded for this product yet."
          />
        </div>
      </div>
    </div>
  );
}
