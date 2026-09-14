"use client";

import React, { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Receipt } from "lucide-react";
import { Card, Field, inputClass } from "@/components/ui";
import { LineItemsEditor, linesToPayload, type EditorLine } from "@/components/forms/LineItemsEditor";
import type { ProductOption } from "@/lib/services/inventory";
import { submitInvoice, type FormState } from "../actions";
import { calcTotals, PAYMENT_METHODS, todayInput } from "@/lib/calc";
import { money, num } from "@/lib/format";

type Customer = { id: number; name: string; outstandingBalance: string | null };

export function InvoiceForm({
  customers,
  products,
  defaultCustomerId,
}: {
  customers: Customer[];
  products: ProductOption[];
  defaultCustomerId?: number | null;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(submitInvoice, {});
  const [lines, setLines] = useState<EditorLine[]>([]);
  const [customerId, setCustomerId] = useState<string>(defaultCustomerId ? String(defaultCustomerId) : "");
  const [amountPaid, setAmountPaid] = useState<string>("0");
  const [method, setMethod] = useState<string>("Cash");

  const customer = useMemo(() => customers.find((c) => String(c.id) === customerId), [customers, customerId]);
  const outstanding = num(customer?.outstandingBalance);
  const totals = calcTotals(linesToPayload(lines));
  const newOutstanding = outstanding + (totals.total - (num(amountPaid) || 0));
  const overStock = lines.some((l) => l.stock + 0.0001 < (Number(l.quantity) || 0));

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="payload" value={JSON.stringify(linesToPayload(lines))} />
      <input type="hidden" name="amountPaid" value={num(amountPaid)} />
      <input type="hidden" name="paymentMethod" value={method} />

      {state.error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5" /> {state.error}
        </div>
      )}

      <Card title="Sale Details">
        <div className="p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
          <Field label="Customer" required className="md:col-span-2">
            <select value={customerId} onChange={(e) => { setCustomerId(e.target.value); setAmountPaid("0"); }} className={inputClass} required>
              <option value="">Choose customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Invoice Date" required>
            <input type="date" name="date" defaultValue={todayInput()} className={inputClass} required />
          </Field>
          <Field label="Due Date" hint="Leave blank for immediate / cash">
            <input type="date" name="dueDate" defaultValue="" className={inputClass} />
          </Field>
        </div>
      </Card>

      <Card title="Products">
        <div className="p-5">
          <LineItemsEditor products={products} lines={lines} onChange={setLines} priceKey="sellingPrice" showStock showTransport autoFocus />
        </div>
      </Card>

      <Card title="Payment">
        <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Payment Method" required>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass} name="method">
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Field label="Amount Paid Now">
            <input type="number" step="0.01" min="0" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Balance Due" hint="Computed">
            <input readOnly value={money(Math.max(0, totals.total - (num(amountPaid) || 0)))} className={`${inputClass} bg-slate-50 text-slate-700`} />
          </Field>
          <Field label="Notes" className="md:col-span-3">
            <input name="notes" className={inputClass} placeholder="Delivery note, vehicle, remarks..." />
          </Field>
        </div>
        {customer && (
          <div className="px-5 pb-5 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
              <p className="text-[11px] uppercase text-slate-500">Current Outstanding</p>
              <p className="font-semibold text-slate-800">{money(outstanding)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
              <p className="text-[11px] uppercase text-slate-500">After This Sale</p>
              <p className="font-semibold text-slate-800">{money(newOutstanding)}</p>
            </div>
          </div>
        )}
      </Card>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || lines.length === 0 || overStock}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          <Receipt size={16} /> {pending ? "Saving..." : "Create Invoice"}
        </button>
        <Link href="/sales/invoices" className="text-sm text-slate-500 hover:underline">Cancel</Link>
      </div>
    </form>
  );
}
