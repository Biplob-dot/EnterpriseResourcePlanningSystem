"use client";

import React from "react";
import { Trash2 } from "lucide-react";
import { ProductPicker } from "./ProductPicker";
import type { ProductOption } from "@/lib/services/inventory";
import { calcLine, calcTotals } from "@/lib/calc";
import { money } from "@/lib/format";

export type EditorLine = {
  key: string;
  productId: number;
  code: string;
  name: string;
  unit: string;
  unitId: number | null;
  stock: number;
  quantity: string;
  unitPrice: string;
  discount: string;
  taxRate: string;
  transport?: string;
};

export function linesToPayload(lines: EditorLine[]) {
  return lines.map((l) => ({
    productId: l.productId,
    unitId: l.unitId,
    quantity: Number(l.quantity) || 0,
    unitPrice: Number(l.unitPrice) || 0,
    discount: Number(l.discount) || 0,
    taxRate: Number(l.taxRate) || 0,
    transport: Number(l.transport) || 0,
  }));
}

export function lineTotals(lines: EditorLine[]) {
  return calcTotals(linesToPayload(lines));
}

const cell = "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-right outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export function LineItemsEditor({
  products,
  lines,
  onChange,
  priceKey,
  showStock = false,
  showTransport = false,
  autoFocus = false,
}: {
  products: ProductOption[];
  lines: EditorLine[];
  onChange: (lines: EditorLine[]) => void;
  priceKey: "sellingPrice" | "purchasePrice";
  showStock?: boolean;
  showTransport?: boolean;
  autoFocus?: boolean;
}) {
  const addProduct = (p: ProductOption) => {
    const existing = lines.find((l) => l.productId === p.id);
    if (existing) {
      onChange(lines.map((l) => (l.productId === p.id ? { ...l, quantity: String((Number(l.quantity) || 0) + 1) } : l)));
      return;
    }
    onChange([
      ...lines,
      {
        key: `${p.id}-${Date.now()}`,
        productId: p.id,
        code: p.code,
        name: p.name,
        unit: p.unit ?? "",
        unitId: p.unitId,
        stock: p.stock,
        quantity: "1",
        unitPrice: String(p[priceKey]),
        discount: "0",
        taxRate: String(p.taxRate),
        transport: "0",
      },
    ]);
  };

  const update = (key: string, patch: Partial<EditorLine>) =>
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const remove = (key: string) => onChange(lines.filter((l) => l.key !== key));

  const totals = lineTotals(lines);

  return (
    <div className="space-y-3">
      <ProductPicker products={products} onPick={addProduct} priceKey={priceKey} autoFocus={autoFocus} />

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Product</th>
              {showStock && <th className="px-3 py-2 text-right font-semibold w-24">Stock</th>}
              <th className="px-3 py-2 text-right font-semibold w-28">Qty</th>
              <th className="px-3 py-2 text-left font-semibold w-16">Unit</th>
              <th className="px-3 py-2 text-right font-semibold w-32">Unit Price</th>
              <th className="px-3 py-2 text-right font-semibold w-28">Discount</th>
              <th className="px-3 py-2 text-right font-semibold w-24">Tax %</th>
              {showTransport && (
                <th className="px-3 py-2 text-right font-semibold w-32">Transport</th>
              )}
              <th className="px-3 py-2 text-right font-semibold w-32">Total</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.length === 0 && (
              <tr>
                <td colSpan={showStock ? 9 : 8} className="px-3 py-8 text-center text-slate-500">
                  No products added yet. Search above and press Enter to add a line.
                </td>
              </tr>
            )}
            {showTransport && lines.length === 0 && null}
            {lines.map((l) => {
              const c = calcLine({
                quantity: Number(l.quantity) || 0,
                unitPrice: Number(l.unitPrice) || 0,
                discount: Number(l.discount) || 0,
                taxRate: Number(l.taxRate) || 0,
              });
              const short = showStock && Number(l.quantity) > l.stock;
              return (
                <tr key={l.key} className={short ? "bg-red-50/60" : ""}>
                  <td className="px-3 py-2">
                    <p className="font-medium text-slate-800">{l.name}</p>
                    <p className="text-xs text-slate-500">{l.code}</p>
                  </td>
                  {showStock && (
                    <td className={`px-3 py-2 text-right ${short ? "text-red-600 font-semibold" : "text-slate-600"}`}>
                      {l.stock}
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={l.quantity}
                      onChange={(e) => update(l.key, { quantity: e.target.value })}
                      className={cell}
                    />
                  </td>
                  <td className="px-3 py-2 text-slate-600">{l.unit}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={l.unitPrice}
                      onChange={(e) => update(l.key, { unitPrice: e.target.value })}
                      className={cell}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={l.discount}
                      onChange={(e) => update(l.key, { discount: e.target.value })}
                      className={cell}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={l.taxRate}
                      onChange={(e) => update(l.key, { taxRate: e.target.value })}
                      className={cell}
                    />
                  </td>
                  {showTransport && (
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={l.transport ?? "0"}
                        onChange={(e) => update(l.key, { transport: e.target.value })}
                        className={cell}
                        placeholder="0"
                        title="Transportation charge for this product"
                      />
                    </td>
                  )}
                  <td className="px-3 py-2 text-right font-semibold text-slate-800">{money(c.total)}</td>
                  <td className="px-2 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => remove(l.key)}
                      className="text-slate-400 hover:text-red-600"
                      title="Remove line"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <dl className="w-72 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Subtotal</dt>
            <dd className="font-medium">{money(totals.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Discount</dt>
            <dd className="font-medium text-red-600">- {money(totals.discount)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Tax</dt>
            <dd className="font-medium">{money(totals.tax)}</dd>
          </div>
          {showTransport && (
            <div className="flex justify-between">
              <dt className="text-slate-500">Transportation</dt>
              <dd className="font-medium">{money(totals.transport)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base">
            <dt className="font-semibold">Grand Total</dt>
            <dd className="font-bold text-slate-900">{money(totals.total)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
