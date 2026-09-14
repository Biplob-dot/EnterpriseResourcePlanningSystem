"use client";

import React, { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, CalendarClock, CreditCard } from "lucide-react";
import { Card, Field, inputClass } from "@/components/ui";
import { SearchableSelect } from "@/components/forms/SearchableSelect";
import { submitCustomerPayment, type FormState } from "../actions";
import { PAYMENT_METHODS, todayInput } from "@/lib/calc";
import { money } from "@/lib/format";

export function CustomerPaymentForm({
  customers,
  defaultCustomerId,
}: {
  customers: { id: number; name: string; companyName: string | null; outstandingBalance: string | null }[];
  defaultCustomerId?: number | null;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(submitCustomerPayment, {});
  const [customerId, setCustomerId] = useState<string>(defaultCustomerId ? String(defaultCustomerId) : "");
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<string>("Cash");
  const [chequeDate, setChequeDate] = useState<string>("");
  const [advance, setAdvance] = useState(false);

  const selected = customers.find((c) => String(c.id) === customerId);

  // Options for the typeable customer picker, ordered to surface who owes most.
  const options = useMemo(
    () =>
      customers
        .map((c) => ({
          id: c.id,
          label: c.name,
          hint: c.companyName ?? undefined,
          note: Number(c.outstandingBalance ?? 0) > 0 ? `owes ${money(c.outstandingBalance)}` : "settled",
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [customers]
  );

  const isCheque = method === "Cheque";
  const chequeInvalid = isCheque && !chequeDate;
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
      <Card title="Payment from Customer">
        <div className="p-5 space-y-4">
          <Field label="Customer" required hint="Click, then type a name or company to search">
            <SearchableSelect
              name="customerId"
              options={options}
              value={customerId}
              onChange={setCustomerId}
              placeholder="Type to search customers..."
            />
          </Field>
          {selected && (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                <p className="text-[11px] uppercase text-slate-500">Outstanding</p>
                <p className="font-semibold text-slate-800">{money(outstanding)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                <p className="text-[11px] uppercase text-slate-500">Receiving</p>
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
              <select name="method" className={inputClass} value={method} onChange={(e) => setMethod(e.target.value)}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="Reference" hint="Cheque no., transaction ID...">
              <input name="reference" className={inputClass} />
            </Field>

            {isCheque && (
              <>
                <Field label="Cheque Date" required hint="Date written on the cheque">
                  <input
                    name="chequeDate"
                    type="date"
                    value={chequeDate}
                    onChange={(e) => setChequeDate(e.target.value)}
                    className={inputClass}
                    required
                  />
                </Field>
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                  <span className="font-medium">Cheque payments start as “Not cashed in”.</span> Toggle the status to
                  “Cashed in” from the Payment History list once the bank clears it.
                </div>
              </>
            )}
            <Field label="Notes" className="col-span-2">
              <input name="notes" className={inputClass} />
            </Field>
          </div>
          {selected && (
            <button type="button" onClick={() => setAmount(String(Math.max(0, outstanding)))} className="text-xs font-medium text-blue-600 hover:underline">
              Apply full outstanding ({money(outstanding)})
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
        {chequeInvalid && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <CalendarClock size={15} className="mt-0.5 shrink-0" /> A cheque payment needs a cheque date before it can be saved.
          </div>
        )}

        <button
          type="submit"
          disabled={pending || !customerId || amt <= 0 || (exceeds && !advance) || chequeInvalid}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          <CreditCard size={16} /> {pending ? "Saving..." : "Record Payment"}
        </button>
        <Link href="/sales/payments" className="text-sm text-slate-500 hover:underline">Cancel</Link>
      </div>
    </form>
  );
}
