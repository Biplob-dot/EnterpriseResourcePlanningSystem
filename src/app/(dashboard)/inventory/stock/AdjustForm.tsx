"use client";

import React, { useActionState, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Scale } from "lucide-react";
import { Card, Field, inputClass } from "@/components/ui";
import { submitAdjustment, type FormState } from "../actions";

type ProductOpt = { id: number; code: string; name: string; stock: number; unit: string | null };

const REASONS = ["Damaged", "Missing", "Counting correction", "Opening stock", "Other"];

export function AdjustForm({
  products,
  warehouses,
  bins,
}: {
  products: ProductOpt[];
  warehouses: { id: number; name: string }[];
  bins: { id: number; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(submitAdjustment, {});
  const [productId, setProductId] = useState<string>("");
  const [newQty, setNewQty] = useState<string>("");

  const selected = useMemo(
    () => products.find((p) => String(p.id) === productId),
    [products, productId]
  );
  const current = selected?.stock ?? 0;
  const delta = newQty === "" ? 0 : Number(newQty) - current;

  return (
    <Card title="Stock Adjustment">
      <form action={formAction} className="p-5 space-y-4">
        {state.error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle size={15} className="mt-0.5" /> {state.error}
          </div>
        )}
        {state.success && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <CheckCircle2 size={15} className="mt-0.5" /> {state.success}
          </div>
        )}

        <Field label="Product" required>
          <select
            name="productId"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className={inputClass}
            required
          >
            <option value="">Choose a product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
            <p className="text-[11px] uppercase text-slate-500">Current</p>
            <p className="font-semibold text-slate-800">
              {current} {selected?.unit ?? ""}
            </p>
          </div>
          <Field label="New quantity" required>
            <input
              name="newQuantity"
              type="number"
              step="0.01"
              min="0"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              className={inputClass}
              required
            />
          </Field>
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
            <p className="text-[11px] uppercase text-slate-500">Difference</p>
            <p className={`font-semibold ${delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-600" : "text-slate-800"}`}>
              {delta > 0 ? "+" : ""}
              {Number.isFinite(delta) ? delta : 0}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Warehouse">
            <select name="warehouseId" defaultValue={warehouses[0]?.id ?? ""} className={inputClass}>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Shelf / Bin">
            <select name="binId" defaultValue="" className={inputClass}>
              <option value="">Not specified</option>
              {bins.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Reason" required>
          <select name="reason" className={inputClass} required defaultValue="">
            <option value="">Why is the stock changing?</option>
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Notes">
          <textarea name="notes" rows={2} className={inputClass} placeholder="Optional details" />
        </Field>

        <button
          type="submit"
          disabled={pending}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          <Scale size={16} /> {pending ? "Saving..." : "Apply Adjustment"}
        </button>
        <p className="text-xs text-slate-500">
          Every adjustment is recorded in the stock movement history and audit log. Stock is never changed silently.
        </p>
      </form>
    </Card>
  );
}
