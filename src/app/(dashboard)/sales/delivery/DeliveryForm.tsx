"use client";

import React, { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Truck, Trash2 } from "lucide-react";
import { Card, Field, inputClass } from "@/components/ui";
import { ProductPicker } from "@/components/forms/ProductPicker";
import type { ProductOption } from "@/lib/services/inventory";
import { submitDeliveryNote, type FormState } from "../actions";
import { todayInput } from "@/lib/calc";

type OpenSo = {
  id: number;
  soNumber: string;
  customerId: number | null;
  customerName: string | null;
  items: { soItemId: number; productId: number; code: string; name: string; unitId: number | null; unit: string | null; ordered: number; delivered: number; remaining: number }[];
};

type Line = {
  key: string;
  soItemId: number | null;
  productId: number;
  code: string;
  name: string;
  unit: string;
  remaining: number | null;
  quantity: string;
};

const cell = "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-right outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export function DeliveryForm({
  customers,
  products,
  openSos,
  initialSoId,
  initialCustomerId,
}: {
  customers: { id: number; name: string }[];
  products: ProductOption[];
  openSos: OpenSo[];
  initialSoId?: number | null;
  initialCustomerId?: number | null;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(submitDeliveryNote, {});
  const initialSo = initialSoId ? openSos.find((s) => s.id === initialSoId) ?? null : null;

  const [soId, setSoId] = useState<string>(initialSo ? String(initialSo.id) : "");
  const [customerId, setCustomerId] = useState<string>(String(initialSo?.customerId ?? initialCustomerId ?? ""));
  const [lines, setLines] = useState<Line[]>(initialSo ? initialSo.items.filter((i) => i.remaining > 0).map((i) => ({
    key: `so-${i.soItemId}`,
    soItemId: i.soItemId,
    productId: i.productId,
    code: i.code,
    name: i.name,
    unit: i.unit ?? "",
    remaining: i.remaining,
    quantity: String(i.remaining),
  })) : []);

  const sosForCustomer = useMemo(() => (customerId ? openSos.filter((s) => String(s.customerId) === customerId) : openSos), [openSos, customerId]);
  const selectedSo = openSos.find((s) => String(s.id) === soId) ?? null;

  const chooseSo = (value: string) => {
    setSoId(value);
    const so = openSos.find((s) => String(s.id) === value);
    if (so) {
      setCustomerId(String(so.customerId ?? ""));
      setLines(so.items.filter((i) => i.remaining > 0).map((i) => ({
        key: `so-${i.soItemId}`,
        soItemId: i.soItemId,
        productId: i.productId,
        code: i.code,
        name: i.name,
        unit: i.unit ?? "",
        remaining: i.remaining,
        quantity: String(i.remaining),
      })));
    } else {
      setLines((prev) => prev.filter((l) => !l.soItemId));
    }
  };

  const addProduct = (p: ProductOption) => {
    if (lines.some((l) => l.productId === p.id && !l.soItemId)) return;
    setLines((prev) => [
      ...prev,
      { key: `free-${p.id}-${Date.now()}`, soItemId: null, productId: p.id, code: p.code, name: p.name, unit: p.unit ?? "", remaining: null, quantity: "1" },
    ]);
  };

  const update = (key: string, patch: Partial<Line>) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const remove = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));

  const payload = lines
    .filter((l) => Number(l.quantity) > 0)
    .map((l) => ({
      soItemId: l.soItemId,
      productId: l.productId,
      quantity: Number(l.quantity) || 0,
      unitId: null,
    }));

  const over = lines.some((l) => l.remaining != null && (Number(l.quantity) || 0) > l.remaining + 0.0001);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="soId" value={soId} />
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />

      {state.error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5" /> {state.error}
        </div>
      )}

      <Card title="Delivery Details">
        <div className="p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
          <Field label="Customer" required>
            <select value={customerId} onChange={(e) => { setCustomerId(e.target.value); setSoId(""); setLines((p) => p.filter((l) => !l.soItemId)); }} className={inputClass} disabled={!!selectedSo}>
              <option value="">Choose customer</option>
              {customers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Sales Order" hint="Optional — links deliveries to an order">
            <select value={soId} onChange={(e) => chooseSo(e.target.value)} className={inputClass}>
              <option value="">No sales order (adhoc delivery)</option>
              {sosForCustomer.map((s) => (
                <option key={s.id} value={s.id}>{s.soNumber} — {s.customerName}</option>
              ))}
            </select>
          </Field>
          <Field label="Delivery Date" required>
            <input type="date" name="date" defaultValue={todayInput()} className={inputClass} required />
          </Field>
          <Field label="Delivery Address">
            <input name="address" className={inputClass} />
          </Field>
          <Field label="Notes" className="md:col-span-4">
            <input name="notes" className={inputClass} placeholder="Driver, vehicle, instructions..." />
          </Field>
        </div>
      </Card>

      <Card title="Items to Deliver">
        <div className="p-5 space-y-4">
          <ProductPicker products={products} onPick={addProduct} priceKey="sellingPrice" placeholder="Add a product not on the order..." />
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Product</th>
                  <th className="px-3 py-2 text-right font-semibold w-28">Ordered</th>
                  <th className="px-3 py-2 text-right font-semibold w-28">Deliver Qty</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((l) => (
                  <tr key={l.key} className={(l.remaining != null && (Number(l.quantity) || 0) > l.remaining + 0.0001) ? "bg-red-50/70" : ""}>
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-800">{l.name}</p>
                      <p className="text-xs text-slate-500">{l.code}{l.remaining != null ? ` • ordered ${l.remaining} ${l.unit}` : " • not on order"}</p>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">{l.remaining != null ? `${l.remaining} ${l.unit}` : "—"}</td>
                    <td className="px-3 py-2">
                      <input type="number" step="0.01" min="0" value={l.quantity} onChange={(e) => update(l.key, { quantity: e.target.value })} className={cell} />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button type="button" onClick={() => remove(l.key)} className="text-slate-400 hover:text-red-600"><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))}
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-slate-500">Choose a sales order to load its items, or add a product above.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {over && <p className="text-xs text-red-600">One or more lines exceed the quantity remaining on the sales order.</p>}
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending || payload.length === 0 || over || !customerId} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
          <Truck size={16} /> {pending ? "Saving..." : "Create Delivery Note"}
        </button>
        <Link href="/sales/delivery" className="text-sm text-slate-500 hover:underline">Cancel</Link>
      </div>
    </form>
  );
}
