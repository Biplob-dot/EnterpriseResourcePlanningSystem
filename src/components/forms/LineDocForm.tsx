"use client";

import React, { useActionState, useState } from "react";
import Link from "next/link";
import { AlertCircle, Save, Send } from "lucide-react";
import { Card, Field, inputClass } from "@/components/ui";
import { LineItemsEditor, linesToPayload, type EditorLine } from "@/components/forms/LineItemsEditor";
import type { ProductOption } from "@/lib/services/inventory";
import { todayInput } from "@/lib/calc";

type Party = { id: number; name: string; companyName: string | null };

export function LineDocForm({
  action,
  parties,
  products,
  title,
  subtitle,
  defaultPartyId,
  initial,
  showDeliveryDate = false,
  listHref,
}: {
  action: (prev: { error?: string }, fd: FormData) => { error?: string } | Promise<{ error?: string }>;
  parties: Party[];
  products: ProductOption[];
  title: string;
  subtitle: string;
  defaultPartyId?: number | null;
  initial?: {
    id: number;
    partyId: number | null;
    date: string;
    validUntil?: string | null;
    deliveryDate?: string | null;
    notes: string;
    items: EditorLine[];
  } | null;
  showDeliveryDate?: boolean;
  listHref: string;
}) {
  const [state, formAction, pending] = useActionState<{ error?: string }, FormData>(action, {});
  const [lines, setLines] = useState<EditorLine[]>(initial?.items ?? []);
  const [partyId, setPartyId] = useState<string>(String(initial?.partyId ?? defaultPartyId ?? ""));

  return (
    <form action={formAction} className="space-y-6">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="payload" value={JSON.stringify(linesToPayload(lines))} />

      {state.error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5" /> {state.error}
        </div>
      )}

      <Card title={title}>
        <div className="p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
          <Field label="Customer" required className="md:col-span-2">
            <select name="customerId" value={partyId} onChange={(e) => setPartyId(e.target.value)} className={inputClass} required>
              <option value="">Choose customer</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.companyName ? ` (${p.companyName})` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Document Date" required>
            <input type="date" name="date" defaultValue={initial?.date || todayInput()} className={inputClass} required />
          </Field>
          {showDeliveryDate ? (
            <Field label="Delivery Date">
              <input type="date" name="deliveryDate" defaultValue={initial?.deliveryDate ?? ""} className={inputClass} />
            </Field>
          ) : (
            <Field label="Valid Until">
              <input type="date" name="validUntil" defaultValue={initial?.validUntil ?? ""} className={inputClass} />
            </Field>
          )}
          <Field label="Notes" className="md:col-span-4">
            <input name="notes" defaultValue={initial?.notes ?? ""} className={inputClass} />
          </Field>
        </div>
      </Card>

      <Card title="Products">
        <div className="p-5">
          <LineItemsEditor products={products} lines={lines} onChange={setLines} priceKey="sellingPrice" showStock autoFocus={!initial} />
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          name="intent"
          value="sent"
          disabled={pending || lines.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          <Send size={16} /> {pending ? "Saving..." : "Save & Mark Sent"}
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
        <Link href={listHref} className="text-sm text-slate-500 hover:underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
