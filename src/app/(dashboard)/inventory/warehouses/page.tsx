import React from "react";
import { Plus, Warehouse as WarehouseIcon, Layers, Rows3, Box } from "lucide-react";
import { db } from "@/db";
import { warehouses, warehouseZones, racks, bins } from "@/db/schema";
import { Card, Field, PageHeader, inputClass } from "@/components/ui";
import { Flash } from "@/components/ui/Flash";
import { createBin, createRack, createWarehouse, createZone } from "../actions";
import { ensureSeed } from "@/lib/seed";
import { DataTable, type Cell } from "@/components/ui/DataTable";
import { getStockByLocation } from "@/lib/services/inventory";
import { qty } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function WarehousesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  await ensureSeed();
  const sp = await searchParams;

  const [whRows, zoneRows, rackRows, binRows, locations] = await Promise.all([
    db.select().from(warehouses).orderBy(warehouses.name),
    db.select().from(warehouseZones),
    db.select().from(racks),
    db.select().from(bins),
    getStockByLocation(),
  ]);

  const zonesOf = (wid: number) => zoneRows.filter((z) => z.warehouseId === wid);
  const racksOf = (zid: number) => rackRows.filter((r) => r.zoneId === zid);
  const binsOf = (rid: number) => binRows.filter((b) => b.rackId === rid);

  const locRows: Cell[][] = locations.map((l) => [
    { text: l.code ?? "-", muted: true },
    { text: l.product ?? "-", href: `/inventory/products/${l.productId}` },
    { text: l.warehouse ?? "Unassigned" },
    { text: l.zone ?? "-", muted: true },
    { text: l.rack ?? "-", muted: true },
    { text: l.bin ?? "-", muted: true },
    { text: `${qty(l.quantity)} ${l.unit ?? ""}`, sort: l.quantity, bold: true },
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouses & Locations"
        subtitle="Organise storage as Warehouse → Zone → Rack → Shelf so stock is easy to find."
      />
      <Flash saved={sp.saved} error={sp.error} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card title="Storage Structure" className="xl:col-span-2">
          <div className="p-5 space-y-5">
            {whRows.map((w) => (
              <div key={w.id} className="rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 border-b border-slate-200">
                  <WarehouseIcon size={16} className="text-blue-600" />
                  <span className="font-semibold text-slate-800">{w.name}</span>
                  {w.location && <span className="text-xs text-slate-500">• {w.location}</span>}
                </div>
                <div className="p-4 space-y-3">
                  {zonesOf(w.id).length === 0 && (
                    <p className="text-sm text-slate-500">No zones yet. Add one on the right.</p>
                  )}
                  {zonesOf(w.id).map((z) => (
                    <div key={z.id} className="pl-2 border-l-2 border-slate-200">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <Layers size={14} className="text-indigo-500" /> {z.name}
                      </div>
                      <div className="pl-5 mt-1.5 space-y-1.5">
                        {racksOf(z.id).map((r) => (
                          <div key={r.id}>
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Rows3 size={13} className="text-amber-500" /> {r.name}
                            </div>
                            <div className="pl-6 flex flex-wrap gap-1.5 mt-1">
                              {binsOf(r.id).map((b) => (
                                <span
                                  key={b.id}
                                  className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                                >
                                  <Box size={11} /> {b.name}
                                </span>
                              ))}
                              {binsOf(r.id).length === 0 && (
                                <span className="text-xs text-slate-400">No shelves</span>
                              )}
                            </div>
                          </div>
                        ))}
                        {racksOf(z.id).length === 0 && <p className="text-xs text-slate-400">No racks</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card title="Add Warehouse">
            <form action={createWarehouse} className="p-5 space-y-3">
              <Field label="Warehouse name" required>
                <input name="name" className={inputClass} placeholder="Second Warehouse" required />
              </Field>
              <Field label="Location">
                <input name="location" className={inputClass} placeholder="City / area" />
              </Field>
              <button className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                <Plus size={16} /> Add Warehouse
              </button>
            </form>
          </Card>

          <Card title="Add Zone">
            <form action={createZone} className="p-5 space-y-3">
              <Field label="Warehouse" required>
                <select name="warehouseId" className={inputClass} required>
                  {whRows.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Zone name" required>
                <input name="name" className={inputClass} placeholder="Zone C" required />
              </Field>
              <button className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Add Zone
              </button>
            </form>
          </Card>

          <Card title="Add Rack">
            <form action={createRack} className="p-5 space-y-3">
              <Field label="Zone" required>
                <select name="zoneId" className={inputClass} required>
                  {zoneRows.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Rack name" required>
                <input name="name" className={inputClass} placeholder="Rack A03" required />
              </Field>
              <button className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Add Rack
              </button>
            </form>
          </Card>

          <Card title="Add Shelf / Bin">
            <form action={createBin} className="p-5 space-y-3">
              <Field label="Rack" required>
                <select name="rackId" className={inputClass} required>
                  {rackRows.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Shelf name" required>
                <input name="name" className={inputClass} placeholder="A03-01" required />
              </Field>
              <button className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Add Shelf
              </button>
            </form>
          </Card>
        </div>
      </div>

      <DataTable
        title="Stock by Location"
        exportName="stock-by-location"
        columns={[
          { label: "Code" },
          { label: "Product" },
          { label: "Warehouse" },
          { label: "Zone" },
          { label: "Rack" },
          { label: "Shelf" },
          { label: "Quantity", align: "right" },
        ]}
        rows={locRows}
        emptyMessage="No stock stored yet."
      />
    </div>
  );
}
