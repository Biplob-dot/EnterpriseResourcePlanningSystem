"use client";

import React, { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, PackageCheck, Trash2 } from "lucide-react";
import { Card, Field, inputClass } from "@/components/ui";
import { ProductPicker } from "@/components/forms/ProductPicker";
import type { ProductOption } from "@/lib/services/inventory";
import { submitGrn, type FormState } from "../actions";
import { calcLine, calcTotals, todayInput } from "@/lib/calc";
import { money } from "@/lib/format";

export type OpenPo = {
  id: number;
  poNumber: string;
  supplierId: number | null;
  supplierName: string | null;
  items: {
    poItemId: number;
    productId: number;
    code: string;
    name: string;
    unitId: number | null;
    unit: string | null;
    ordered: number;
    received: number;
    remaining: number;
    unitPrice: number;
    discountPerUnit: number;
    taxRate: number;
  }[];
};

type Line = {
  key: string;
  productId: number;
  poItemId: number | null;
  code: string;
  name: string;
  unit: string;
  ordered: number | null;
  remaining: number | null;
  received: string;
  damaged: string;
  unitPrice: string;
  discountPerUnit: number;
  taxRate: string;
  warehouseId: string;
  binId: string;
  batchNumber: string;
};

const cell = "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export function GrnForm({
  suppliers,
  products,
  warehouses,
  bins,
  openPos,
  initialPoId,
  initialSupplierId,
}: {
  suppliers: { id: number; name: string }[];
  products: ProductOption[];
  warehouses: { id: number; name: string }[];
  bins: { id: number; name: string; rack: string | null; warehouseId: number | null }[];
  openPos: OpenPo[];
  initialPoId?: number | null;
  initialSupplierId?: number | null;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(submitGrn, {});
  const defaultWarehouse = String(warehouses[0]?.id ?? "");

  const linesFromPo = (po: OpenPo): Line[] =>
    po.items
      .filter((i) => i.remaining > 0)
      .map((i) => ({
        key: `po-${i.poItemId}`,
        productId: i.productId,
        poItemId: i.poItemId,
        code: i.code,
        name: i.name,
        unit: i.unit ?? "",
        ordered: i.ordered,
        remaining: i.remaining,
        received: String(i.remaining),
        damaged: "0",
        unitPrice: String(i.unitPrice),
        discountPerUnit: i.discountPerUnit,
        taxRate: String(i.taxRate),
        warehouseId: defaultWarehouse,
        binId: "",
        batchNumber: "",
      }));

  const initialPo = initialPoId ? openPos.find((p) => p.id === initialPoId) ?? null : null;
  const [poId, setPoId] = useState<string>(initialPo ? String(initialPo.id) : "");
  const [supplierId, setSupplierId] = useState<string>(String(initialPo?.supplierId ?? initialSupplierId ?? ""));
  const [lines, setLines] = useState<Line[]>(initialPo ? linesFromPo(initialPo) : []);

  const selectedPo = useMemo(() => openPos.find((p) => String(p.id) === poId) ?? null, [openPos, poId]);
  const posForSupplier = useMemo(
    () => (supplierId ? openPos.filter((p) => String(p.supplierId) === supplierId) : openPos),
    [openPos, supplierId]
  );

  const choosePo = (value: string) => {
    setPoId(value);
    const po = openPos.find((p) => String(p.id) === value);
    if (po) {
      setSupplierId(String(po.supplierId ?? ""));
      setLines(linesFromPo(po));
    } else {
      setLines((prev) => prev.filter((l) => !l.poItemId));
    }
  };

  const addProduct = (p: ProductOption) => {
    if (lines.some((l) => l.productId === p.id && !l.poItemId)) return;
    setLines((prev) => [
      ...prev,
      {
        key: `free-${p.id}-${Date.now()}`,
        productId: p.id,
        poItemId: null,
        code: p.code,
        name: p.name,
        unit: p.unit ?? "",
        ordered: null,
        remaining: null,
        received: "1",
        damaged: "0",
        unitPrice: String(p.purchasePrice),
        discountPerUnit: 0,
        taxRate: String(p.taxRate),
        warehouseId: defaultWarehouse,
        binId: "",
        batchNumber: "",
      },
    ]);
  };

  const update = (key: string, patch: Partial<Line>) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const remove = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));

  const computed = lines.map((l) => {
    const received = Number(l.received) || 0;
    const damaged = Number(l.damaged) || 0;
    const accepted = Math.max(0, received - damaged);
    const discount = Math.round(l.discountPerUnit * accepted * 100) / 100;
    const amounts = calcLine({ quantity: accepted, unitPrice: Number(l.unitPrice) || 0, discount, taxRate: Number(l.taxRate) || 0 });
    const over = l.remaining != null && accepted > l.remaining + 0.0001;
    return { ...l, received, damaged, accepted, discount, amounts, over };
  });
  const totals = calcTotals(computed.map((c) => ({ quantity: c.accepted, unitPrice: Number(c.unitPrice) || 0, discount: c.discount, taxRate: Number(c.taxRate) || 0 })));
  const hasOver = computed.some((c) => c.over);

  const payload = computed.map((c) => ({
    productId: c.productId,
    poItemId: c.poItemId,
    quantityReceived: c.received,
    quantityDamaged: c.damaged,
    unitPrice: Number(c.unitPrice) || 0,
    discount: c.discount,
    taxRate: Number(c.taxRate) || 0,
    warehouseId: c.warehouseId ? Number(c.warehouseId) : null,
    binId: c.binId ? Number(c.binId) : null,
    batchNumber: c.batchNumber || null,
  }));

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="supplierId" value={supplierId} />
      <input type="hidden" name="poId" value={poId} />
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />

      {state.error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5" /> {state.error}
        </div>
      )}

      <Card title="Step 1 — Who delivered and against which order?">
        <div className="p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
          <Field label="Supplier" required>
            <select value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setPoId(""); setLines((p) => p.filter((l) => !l.poItemId)); }} className={inputClass} disabled={!!selectedPo}>
              <option value="">Choose supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Purchase Order" hint="Optional — leave empty for a direct purchase">
            <select value={poId} onChange={(e) => choosePo(e.target.value)} className={inputClass}>
              <option value="">No purchase order (direct purchase)</option>
              {posForSupplier.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.poNumber} — {p.supplierName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Received Date" required>
            <input type="date" name="date" defaultValue={todayInput()} className={inputClass} required />
          </Field>
          <Field label="Delivery Note / Bill No.">
            <input name="notes" className={inputClass} placeholder="Supplier's reference" />
          </Field>
        </div>
      </Card>

      <Card title="Step 2 — What arrived?">
        <div className="p-5 space-y-4">
          <ProductPicker products={products} onPick={addProduct} priceKey="purchasePrice" placeholder="Add a product that is not on the order..." />

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Product</th>
                  <th className="px-3 py-2 text-right font-semibold w-24">Received</th>
                  <th className="px-3 py-2 text-right font-semibold w-24">Damaged</th>
                  <th className="px-3 py-2 text-right font-semibold w-24">Accepted</th>
                  <th className="px-3 py-2 text-right font-semibold w-28">Unit Price</th>
                  <th className="px-3 py-2 text-right font-semibold w-20">Tax %</th>
                  <th className="px-3 py-2 text-left font-semibold w-36">Warehouse</th>
                  <th className="px-3 py-2 text-left font-semibold w-32">Shelf</th>
                  <th className="px-3 py-2 text-left font-semibold w-28">Batch No.</th>
                  <th className="px-3 py-2 text-right font-semibold w-28">Total</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {computed.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-3 py-8 text-center text-slate-500">
                      Choose a purchase order above to load its items, or search for a product to receive directly.
                    </td>
                  </tr>
                )}
                {computed.map((l) => (
                  <tr key={l.key} className={l.over ? "bg-red-50/70" : ""}>
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-800">{l.name}</p>
                      <p className="text-xs text-slate-500">
                        {l.code}
                        {l.ordered != null ? ` • ordered ${l.ordered}, pending ${l.remaining} ${l.unit}` : " • not on order"}
                      </p>
                      {l.over && <p className="text-xs text-red-600 font-medium">More than pending on the order</p>}
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" step="0.01" min="0" value={l.received} onChange={(e) => update(l.key, { received: e.target.value })} className={`${cell} text-right`} />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" step="0.01" min="0" value={l.damaged} onChange={(e) => update(l.key, { damaged: e.target.value })} className={`${cell} text-right`} />
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800">
                      {l.accepted} <span className="text-xs font-normal text-slate-500">{l.unit}</span>
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" step="0.01" min="0" value={l.unitPrice} onChange={(e) => update(l.key, { unitPrice: e.target.value })} className={`${cell} text-right`} />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" step="0.01" min="0" value={l.taxRate} onChange={(e) => update(l.key, { taxRate: e.target.value })} className={`${cell} text-right`} />
                    </td>
                    <td className="px-3 py-2">
                      <select value={l.warehouseId} onChange={(e) => update(l.key, { warehouseId: e.target.value, binId: "" })} className={cell}>
                        {warehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select value={l.binId} onChange={(e) => update(l.key, { binId: e.target.value })} className={cell}>
                        <option value="">Any</option>
                        {bins
                          .filter((b) => !l.warehouseId || String(b.warehouseId) === l.warehouseId)
                          .map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input value={l.batchNumber} onChange={(e) => update(l.key, { batchNumber: e.target.value })} className={cell} placeholder="Optional" />
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800">{money(l.amounts.total)}</td>
                    <td className="px-2 py-2 text-center">
                      <button type="button" onClick={() => remove(l.key)} className="text-slate-400 hover:text-red-600" title="Remove">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap justify-between gap-4">
            <div className="text-xs text-slate-500 max-w-md space-y-1">
              <p>• Damaged units are rejected at the door: they are not added to stock and are not charged to the supplier.</p>
              <p>• Accepted quantity is added to stock immediately when you confirm.</p>
              <label className="flex items-center gap-2 pt-2 text-sm text-slate-700">
                <input type="checkbox" name="updateCost" defaultChecked className="rounded border-slate-300" />
                Update product cost prices with these rates
              </label>
            </div>
            <dl className="w-72 space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd className="font-medium">{money(totals.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Discount</dt><dd className="font-medium text-red-600">- {money(totals.discount)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Tax</dt><dd className="font-medium">{money(totals.tax)}</dd></div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base"><dt className="font-semibold">Payable to Supplier</dt><dd className="font-bold">{money(totals.total)}</dd></div>
            </dl>
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || computed.length === 0 || hasOver || !supplierId}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          <PackageCheck size={16} /> {pending ? "Confirming..." : "Confirm Receipt & Update Stock"}
        </button>
        <Link href="/purchasing/grn" className="text-sm text-slate-500 hover:underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
