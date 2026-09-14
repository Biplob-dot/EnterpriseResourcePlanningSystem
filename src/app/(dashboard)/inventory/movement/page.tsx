import React from "react";
import { PageHeader, StatTile } from "@/components/ui";
import { DataTable, type Cell } from "@/components/ui/DataTable";
import { getMovements } from "@/lib/services/inventory";
import { ensureSeed } from "@/lib/seed";
import { dateTime, num, qty } from "@/lib/format";

export const dynamic = "force-dynamic";

const toneFor = (type: string): Cell["tone"] => {
  switch (type) {
    case "PURCHASE":
    case "RETURN_SALE":
      return "green";
    case "SALE":
    case "RETURN_PURCHASE":
      return "red";
    case "ADJUSTMENT":
      return "amber";
    default:
      return "slate";
  }
};

export default async function MovementPage() {
  await ensureSeed();
  const movements = await getMovements(500);

  const totalIn = movements.filter((m) => num(m.quantity) > 0).reduce((s, m) => s + num(m.quantity), 0);
  const totalOut = movements.filter((m) => num(m.quantity) < 0).reduce((s, m) => s + Math.abs(num(m.quantity)), 0);

  const rows: Cell[][] = movements.map((m) => {
    const q = num(m.quantity);
    return [
      { text: dateTime(m.createdAt), sort: m.createdAt ? new Date(m.createdAt).getTime() : 0 },
      { text: m.code ?? "-", muted: true },
      { text: m.product ?? "-", sort: m.product ?? "" },
      { text: m.type.replace(/_/g, " "), tone: toneFor(m.type) },
      { text: m.reference ?? "-", muted: true },
      { text: q > 0 ? qty(q) : "", sort: q > 0 ? q : 0 },
      { text: q < 0 ? qty(Math.abs(q)) : "", sort: q < 0 ? Math.abs(q) : 0 },
      { text: qty(m.newStock), sort: num(m.newStock), bold: true },
      { text: m.warehouse ?? "-", muted: true },
    ];
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Movement"
        subtitle="A complete, unchangeable history of every quantity change in the warehouse."
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatTile label="Recorded Movements" value={String(movements.length)} />
        <StatTile label="Total Quantity In" value={qty(totalIn)} tone="green" />
        <StatTile label="Total Quantity Out" value={qty(totalOut)} tone="red" />
      </div>

      <DataTable
        title="Movement Ledger"
        exportName="stock-movement"
        pageSize={20}
        columns={[
          { label: "Date & Time" },
          { label: "Code" },
          { label: "Product" },
          { label: "Type" },
          { label: "Reference" },
          { label: "In", align: "right", total: true },
          { label: "Out", align: "right", total: true },
          { label: "Balance", align: "right" },
          { label: "Warehouse" },
        ]}
        rows={rows}
        emptyMessage="No stock movements recorded yet."
      />
    </div>
  );
}
