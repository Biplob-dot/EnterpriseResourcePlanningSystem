"use client";

import React, { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, CreditCard } from "lucide-react";
import { Card, Field, inputClass } from "@/components/ui";
import { SearchableSelect } from "@/components/forms/SearchableSelect";
import { submitSupplierPayment, type FormState } from "../actions";
import { PAYMENT_METHODS, todayInput } from "@/lib/calc";
import { money } from "@/lib/format";

export function SupplierPaymentForm({
  suppliers,
  defaultSupplierId,
}: {
  suppliers: { id: number; name: string; companyName: string | null; outstandingBalance: string | null }[];
  defaultSupplierId?: number | null;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(submitSupplierPayment, {});
  const [supplierId, setSupplierId] = useState<string>(defaultSupplierId ? String(defaultSupplierId) : "");
  const [amount, setAmount] = useState<string>("");
  const [advance, setAdvance] = useState(false);

  const selected = useMemo(() => suppliers.find((s) => String(s.id) === supplierId), [suppliers, supplierId]);
  const options = useMemo(
    () =>
      suppliers
        .map((s) => ({
          id: s.id,
          label: s.name,
          hint: s.companyName ?? undefined,
          note: Number(s.outstandingBalance ?? 0) > 0 ? `owed ${money(s.outstandingBalance)}` : "settled",
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [suppliers]
  );
  const outstanding = Number(selected?.outstandingBalance ?? 0);
  const amt = Number(amount) || 0;
  const exceeds = amt > outstanding + 0.005;
  const remaining = outstanding - amt;

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      {state.error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5" /> {state.error}
        </div>
      )}

      <Card title="Payment to Supplier">
        <div className="p-5 space-y-4">
          <Field label="Supplier" required hint="Click, then type a name or company to search">
            <SearchableSelect
              name="supplierId"
              options={options}
              value={supplierId}
              onChange={setSupplierId}
              placeholder="Type to search suppliers..."
            />
          </Field>

          {selected && (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                <p className="text-[11px] uppercase text-slate-500">Outstanding</p>
                <p className="font-semibold text-slate-800">{money(outstanding)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                <p className="text-[11px] uppercase text-slate-500">Paying now</p>
                <p className="font-semibold text-blue-700">{money(amt)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                <p className="text-[11px] uppercase text-slate-500">{remaining < 0 ? "Advance" : "Remaining"}</p>
                <p className={`font-semibold ${remaining < 0 ? "text-indigo-600" : "text-slate-800"}`}>{money(Math.abs(remaining))}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Amount" required>
              <input name="amount" type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} required />
            </Field>
            <Field label="Payment Date" required>
              <input name="date" type="date" defaultValue={todayInput()} className={inputClass} required />
            </Field>
            <Field label="Payment Method" required>
              <select name="method" className={inputClass} defaultValue="Cash">
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Reference" hint="Cheque no., transaction ID...">
              <input name="reference" className={inputClass} />
            </Field>
            <Field label="Notes" className="col-span-2">
              <input name="notes" className={inputClass} />
            </Field>
          </div>

          {selected && (
            <button
              type="button"
              onClick={() => setAmount(String(Math.max(0, outstanding)))}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              Pay full outstanding ({money(outstanding)})
            </button>
          )}

          {exceeds && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              This payment is more than the outstanding balance. Tick below to record the extra as an advance.
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="isAdvance" checked={advance} onChange={(e) => setAdvance(e.target.checked)} className="rounded border-slate-300" />
            Advance payment (allowed to exceed the outstanding balance)
          </label>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || !supplierId || amt <= 0 || (exceeds && !advance)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          <CreditCard size={16} /> {pending ? "Saving..." : "Record Payment"}
        </button>
        <Link href="/purchasing/payments" className="text-sm text-slate-500 hover:underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
