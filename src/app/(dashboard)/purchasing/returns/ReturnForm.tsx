"use client";

import React, { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowDownLeft, Trash2 } from "lucide-react";
import { Card, Field, inputClass } from "@/components/ui";
import { ProductPicker } from "@/components/forms/ProductPicker";
import type { ProductOption } from "@/lib/services/inventory";
import { submitPurchaseReturn, type FormState } from "../actions";
import { calcLine, calcTotals, todayInput } from "@/lib/calc";
import { dateShort, money } from "@/lib/format";

export type ReturnableGrn = {
  id: number;
  grnNumber: string;
  supplierId: number | null;
  date: Date | null;
  items: { productId: number; code: string; name: string; unit: string | null; accepted: number; returned: number; unitPrice: number; taxRate: number }[];
};

type Line = {
  key: string;
  productId: number;
  code: string;
  name: string;
  unit: string;
  maxQty: number | null;
  stock: number;
  quantity: string;
  unitPrice: string;
  taxRate: string;
};

const REASONS = ["Damaged", "Wrong item delivered", "Quality issue", "Excess quantity", "Other"];
const cell = "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-right outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export function ReturnForm({
  suppliers,
  products,
  grns,
  initialGrnId,
  initialSupplierId,
}: {
  suppliers: { id: number; name: string }[];
  products: ProductOption[];
  grns: ReturnableGrn[];
  initialGrnId?: number | null;
  initialSupplierId?: number | null;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(submitPurchaseReturn, {});
  const stockOf = (productId: number) => products.find((p) => p.id === productId)?.stock ?? 0;

  const linesFromGrn = (g: ReturnableGrn): Line[] =>
    g.items
      .filter((i) => i.accepted - i.returned > 0.0001)
      .map((i) => ({
        key: `grn-${g.id}-${i.productId}`,
        productId: i.productId,
        code: i.code,
        name: i.name,
        unit: i.unit ?? "",
        maxQty: Math.round((i.accepted - i.returned) * 10000) / 10000,
        stock: stockOf(i.productId),
        quantity: "",
        unitPrice: String(i.unitPrice),
        taxRate: String(i.taxRate),
      }));

  const initialGrn = initialGrnId ? grns.find((g) => g.id === initialGrnId) ?? null : null;
  const [grnId, setGrnId] = useState<string>(initialGrn ? String(initialGrn.id) : "");
  const [supplierId, setSupplierId] = useState<string>(String(initialGrn?.supplierId ?? initialSupplierId ?? ""));
  const [lines, setLines] = useState<Line[]>(initialGrn ? linesFromGrn(initialGrn) : []);

  const grnsForSupplier = useMemo(() => (supplierId ? grns.filter((g) => String(g.supplierId) === supplierId) : grns), [grns, supplierId]);
  const selectedGrn = grns.find((g) => String(g.id) === grnId) ?? null;

  const chooseGrn = (value: string) => {
    setGrnId(value);
    const g = grns.find((x) => String(x.id) === value);
    if (g) {
      setSupplierId(String(g.supplierId ?? ""));
      setLines(linesFromGrn(g));
    } else {
      setLines([]);
    }
  };

  const addProduct = (p: ProductOption) => {
    if (lines.some((l) => l.productId === p.id)) return;
    setLines((prev) => [
      ...prev,
      {
        key: `free-${p.id}`,
        productId: p.id,
        code: p.code,
        name: p.name,
        unit: p.unit ?? "",
        maxQty: null,
        stock: p.stock,
        quantity: "1",
        unitPrice: String(p.purchasePrice),
        taxRate: String(p.taxRate),
      },
    ]);
  };

  const update = (key: string, patch: Partial<Line>) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const remove = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));

  const computed = lines.map((l) => {
    const quantity = Number(l.quantity) || 0;
    const amounts = calcLine({ quantity, unitPrice: Number(l.unitPrice) || 0, discount: 0, taxRate: Number(l.taxRate) || 0 });
    const overMax = l.maxQty != null && quantity > l.maxQty + 0.0001;
    const overStock = quantity > l.stock + 0.0001;
    return { ...l, quantity, amounts, overMax, overStock };
  });
  const active = computed.filter((c) => c.quantity > 0);
  const totals = calcTotals(active.map((c) => ({ quantity: c.quantity, unitPrice: Number(c.unitPrice) || 0, discount: 0, taxRate: Number(c.taxRate) || 0 })));
  const blocked = computed.some((c) => c.overMax || c.overStock);

  const payload = active.map((c) => ({
    productId: c.productId,
    quantity: c.quantity,
    unitPrice: Number(c.unitPrice) || 0,
    taxRate: Number(c.taxRate) || 0,
  }));

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="supplierId" value={supplierId} />
      <input type="hidden" name="grnId" value={grnId} />
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />

      {state.error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5" /> {state.error}
        </div>
      )}

      <Card title="Return Details">
        <div className="p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
          <Field label="Supplier" required>
            <select value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setGrnId(""); setLines([]); }} className={inputClass} disabled={!!selectedGrn}>
              <option value="">Choose supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Original Goods Receipt" hint="Optional — limits quantities to what was received">
            <select value={grnId} onChange={(e) => chooseGrn(e.target.value)} className={inputClass}>
              <option value="">Not linked to a receipt</option>
              {grnsForSupplier.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.grnNumber} — {dateShort(g.date)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Return Date" required>
            <input type="date" name="date" defaultValue={todayInput()} className={inputClass} required />
          </Field>
          <Field label="Reason" required>
            <select name="reason" className={inputClass} required defaultValue="">
              <option value="">Choose reason</option>
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Notes" className="md:col-span-4">
            <input name="notes" className={inputClass} placeholder="Debit note number, courier details..." />
          </Field>
        </div>
      </Card>

      <Card title="Items Being Returned">
        <div className="p-5 space-y-4">
          <ProductPicker products={products} onPick={addProduct} priceKey="purchasePrice" placeholder="Add a product to return..." />

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Product</th>
                  <th className="px-3 py-2 text-right font-semibold w-28">Returnable</th>
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
                    <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                      Choose a goods receipt to list its items, or search for a product above.
                    </td>
                  </tr>
                )}
                {computed.map((l) => (
                  <tr key={l.key} className={l.overMax || l.overStock ? "bg-red-50/70" : ""}>
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-800">{l.name}</p>
                      <p className="text-xs text-slate-500">{l.code}</p>
                      {l.overMax && <p className="text-xs text-red-600">More than was received on this receipt</p>}
                      {!l.overMax && l.overStock && <p className="text-xs text-red-600">Not enough stock to return this quantity</p>}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">{l.maxQty != null ? `${l.maxQty} ${l.unit}` : "—"}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{l.stock}</td>
                    <td className="px-3 py-2">
                      <input type="number" step="0.01" min="0" value={l.quantity} onChange={(e) => update(l.key, { quantity: e.target.value })} className={cell} placeholder="0" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" step="0.01" min="0" value={l.unitPrice} onChange={(e) => update(l.key, { unitPrice: e.target.value })} className={cell} />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" step="0.01" min="0" value={l.taxRate} onChange={(e) => update(l.key, { taxRate: e.target.value })} className={cell} />
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800">{money(l.amounts.total)}</td>
                    <td className="px-2 py-2 text-center">
                      <button type="button" onClick={() => remove(l.key)} className="text-slate-400 hover:text-red-600">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between gap-4">
            <p className="text-xs text-slate-500 max-w-md">
              Returned quantities are removed from stock and the amount is deducted from what you owe the supplier.
            </p>
            <dl className="w-72 space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd className="font-medium">{money(totals.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Tax</dt><dd className="font-medium">{money(totals.tax)}</dd></div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base"><dt className="font-semibold">Credit from Supplier</dt><dd className="font-bold">{money(totals.total)}</dd></div>
            </dl>
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || active.length === 0 || blocked || !supplierId}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          <ArrowDownLeft size={16} /> {pending ? "Saving..." : "Confirm Return"}
        </button>
        <Link href="/purchasing/returns" className="text-sm text-slate-500 hover:underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
