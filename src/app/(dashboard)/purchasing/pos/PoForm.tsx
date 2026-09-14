"use client";

import React, { useActionState, useState } from "react";
import Link from "next/link";
import { AlertCircle, Save, Send } from "lucide-react";
import { Card, Field, inputClass } from "@/components/ui";
import { LineItemsEditor, linesToPayload, type EditorLine } from "@/components/forms/LineItemsEditor";
import type { ProductOption } from "@/lib/services/inventory";
import { savePurchaseOrder, type FormState } from "../actions";
import { todayInput } from "@/lib/calc";

export type PoInitial = {
  id: number;
  supplierId: number | null;
  date: string;
  expectedDeliveryDate: string;
  notes: string;
  items: EditorLine[];
};

export function PoForm({
  suppliers,
  products,
  initial,
  defaultSupplierId,
}: {
  suppliers: { id: number; name: string; companyName: string | null }[];
  products: ProductOption[];
  initial?: PoInitial | null;
  defaultSupplierId?: number | null;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(savePurchaseOrder, {});
  const [lines, setLines] = useState<EditorLine[]>(initial?.items ?? []);
  const [supplierId, setSupplierId] = useState<string>(String(initial?.supplierId ?? defaultSupplierId ?? ""));

  return (
    <form action={formAction} className="space-y-6">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="payload" value={JSON.stringify(linesToPayload(lines))} />

      {state.error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5" /> {state.error}
        </div>
      )}

      <Card title="Order Details">
        <div className="p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
          <Field label="Supplier" required className="md:col-span-2">
            <select name="supplierId" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputClass} required>
              <option value="">Choose supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.companyName ? ` (${s.companyName})` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Order Date" required>
            <input type="date" name="date" defaultValue={initial?.date || todayInput()} className={inputClass} required />
          </Field>
          <Field label="Expected Delivery">
            <input type="date" name="expectedDeliveryDate" defaultValue={initial?.expectedDeliveryDate ?? ""} className={inputClass} />
          </Field>
          <Field label="Notes" className="md:col-span-4">
            <input name="notes" defaultValue={initial?.notes ?? ""} className={inputClass} placeholder="Delivery instructions, agreed terms..." />
          </Field>
        </div>
      </Card>

      <Card title="Products to Order">
        <div className="p-5">
          <LineItemsEditor products={products} lines={lines} onChange={setLines} priceKey="purchasePrice" autoFocus={!initial} />
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          name="intent"
          value="ordered"
          disabled={pending || lines.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          <Send size={16} /> {pending ? "Saving..." : "Save & Mark as Ordered"}
        </button>
        <button
          type="submit"
          name="intent"
          value="draft"
          disabled={pending || lines.length === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <Save size={16} /> Save as Draft
        </button>
        <Link href="/purchasing/pos" className="text-sm text-slate-500 hover:underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
