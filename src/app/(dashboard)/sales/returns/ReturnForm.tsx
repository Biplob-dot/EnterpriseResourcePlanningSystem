"use client";

import React, { useActionState, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowUpRight, Trash2 } from "lucide-react";
import { Card, Field, inputClass } from "@/components/ui";
import { ProductPicker } from "@/components/forms/ProductPicker";
import type { ProductOption } from "@/lib/services/inventory";
import { submitSalesReturn, type FormState } from "../actions";
import { calcLine, calcTotals, todayInput } from "@/lib/calc";
import { money } from "@/lib/format";

type Line = {
  key: string;
  productId: number;
  code: string;
  name: string;
  unit: string;
  stock: number;
  quantity: string;
  unitPrice: string;
  taxRate: string;
};

const CONDITIONS = [
  { value: "RESELLABLE", label: "Resellable (back to stock)" },
  { value: "DAMAGED", label: "Damaged (write off)" },
  { value: "SCRAP", label: "Scrap (write off)" },
];
const REASONS = ["Defective", "Wrong item shipped", "Customer changed mind", "Late delivery", "Other"];
const cell = "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-right outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export function SalesReturnForm({ customers, products }: { customers: { id: number; name: string }[]; products: ProductOption[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(submitSalesReturn, {});
  const [customerId, setCustomerId] = useState<string>("");
  const [lines, setLines] = useState<Line[]>([]);

  const addProduct = (p: ProductOption) => {
    if (lines.some((l) => l.productId === p.id)) return;
    setLines((prev) => [
      ...prev,
      { key: `r-${p.id}-${Date.now()}`, productId: p.id, code: p.code, name: p.name, unit: p.unit ?? "", stock: p.stock, quantity: "1", unitPrice: String(p.sellingPrice), taxRate: String(p.taxRate) },
    ]);
  };
  const update = (key: string, patch: Partial<Line>) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const remove = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));

  const computed = lines.map((l) => {
    const quantity = Number(l.quantity) || 0;
    const amounts = calcLine({ quantity, unitPrice: Number(l.unitPrice) || 0, discount: 0, taxRate: Number(l.taxRate) || 0 });
    const overStock = quantity > l.stock + 0.0001;
    return { ...l, quantity, amounts, overStock };
  });
  const active = computed.filter((c) => c.quantity > 0);
  const totals = calcTotals(active.map((c) => ({ quantity: c.quantity, unitPrice: Number(c.unitPrice) || 0, discount: 0, taxRate: Number(c.taxRate) || 0 })));
  const blocked = computed.some((c) => c.overStock);

  const payload = active.map((c) => ({ productId: c.productId, quantity: c.quantity, unitPrice: Number(c.unitPrice) || 0, taxRate: Number(c.taxRate) || 0 }));

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />

      {state.error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5" /> {state.error}
        </div>
      )}

      <Card title="Return Details">
        <div className="p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
          <Field label="Customer" required>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inputClass} required>
              <option value="">Choose customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Original Invoice" hint="Optional reference">
            <input name="invoiceId" className={inputClass} placeholder="Invoice # (not required)" />
          </Field>
          <Field label="Return Date" required>
            <input type="date" name="date" defaultValue={todayInput()} className={inputClass} required />
          </Field>
          <Field label="Condition" required>
            <select name="condition" className={inputClass} defaultValue="RESELLABLE" required>
              {CONDITIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Reason" required className="md:col-span-2">
            <select name="reason" className={inputClass} required defaultValue="">
              <option value="">Choose reason</option>
              {REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </Field>
          <Field label="Notes" className="md:col-span-2">
            <input name="notes" className={inputClass} placeholder="Credit note number, inspection details..." />
          </Field>
        </div>
      </Card>

      <Card title="Items Being Returned">
        <div className="p-5 space-y-4">
          <ProductPicker products={products} onPick={addProduct} priceKey="sellingPrice" placeholder="Add a product returned by the customer..." />
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Product</th>
                  <th className="px-3 py-2 text-right font-semibold w-24">In Stock</th>
                  <th className="px-3 py-2 text-right font-semibold w-28">Return Qty</th>
                  <th className="px-3 py-2 text-right font-semibold w-32">Unit Price</th>
                  <th className="px-3 py-2 text-right font-semibold w-20">Tax %</th>
                  <th className="px-3 py-2 text-right font-semibold w-32">Total</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {computed.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-slate-500">Add a returned product above.</td>
                  </tr>
                )}
                {computed.map((l) => (
                  <tr key={l.key} className={l.overStock ? "bg-red-50/70" : ""}>
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-800">{l.name}</p>
                      <p className="text-xs text-slate-500">{l.code}</p>
                      {l.overStock && <p className="text-xs text-red-600">More than in stock ({l.stock})</p>}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">{l.stock}</td>
                    <td className="px-3 py-2">
                      <input type="number" step="0.01" min="0" value={l.quantity} onChange={(e) => update(l.key, { quantity: e.target.value })} className={cell} />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" step="0.01" min="0" value={l.unitPrice} onChange={(e) => update(l.key, { unitPrice: e.target.value })} className={cell} />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" step="0.01" min="0" value={l.taxRate} onChange={(e) => update(l.key, { taxRate: e.target.value })} className={cell} />
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800">{money(l.amounts.total)}</td>
                    <td className="px-2 py-2 text-center">
                      <button type="button" onClick={() => remove(l.key)} className="text-slate-400 hover:text-red-600"><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between gap-4">
            <p className="text-xs text-slate-500 max-w-md">Resellable items return to stock. Damaged/scrap items are written off. Either way the customer&apos;s balance is credited.</p>
            <dl className="w-72 space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd className="font-medium">{money(totals.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Tax</dt><dd className="font-medium">{money(totals.tax)}</dd></div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base"><dt className="font-semibold">Credit to Customer</dt><dd className="font-bold">{money(totals.total)}</dd></div>
            </dl>
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending || active.length === 0 || blocked || !customerId} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
          <ArrowUpRight size={16} /> {pending ? "Saving..." : "Confirm Return"}
        </button>
        <Link href="/sales/returns" className="text-sm text-slate-500 hover:underline">Cancel</Link>
      </div>
    </form>
  );
}
