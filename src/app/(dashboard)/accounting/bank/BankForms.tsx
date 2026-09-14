"use client";

import React, { useActionState, useState } from "react";
import { AlertCircle, Landmark, ArrowLeftRight } from "lucide-react";
import { Card, Field, inputClass } from "@/components/ui";
import { submitBankAccount, submitTransfer } from "../actions";
import type { FormState } from "../actionsTypes";
import { todayInput } from "@/lib/calc";
import { money } from "@/lib/format";

export function NewAccountForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(submitBankAccount, {});
  return (
    <Card title="Add Cash / Bank Account">
      <form action={formAction} className="p-5 space-y-3">
        {state.error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle size={15} className="mt-0.5" /> {state.error}
          </div>
        )}
        <Field label="Account Name" required>
          <input name="name" className={inputClass} placeholder="e.g. Nabil Bank Current" required />
        </Field>
        <Field label="Type" required>
          <select name="type" className={inputClass} defaultValue="BANK">
            <option value="CASH">Cash</option>
            <option value="BANK">Bank</option>
          </select>
        </Field>
        <Field label="Bank Name">
          <input name="bankName" className={inputClass} />
        </Field>
        <Field label="Account Number">
          <input name="accountNumber" className={inputClass} />
        </Field>
        <Field label="Opening Balance">
          <input name="openingBalance" type="number" step="0.01" defaultValue="0" className={inputClass} />
        </Field>
        <button type="submit" disabled={pending} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
          <Landmark size={16} /> {pending ? "Saving..." : "Add Account"}
        </button>
      </form>
    </Card>
  );
}

export function TransferForm({ accounts }: { accounts: { id: number; name: string; type: string; currentBalance: string | null }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(submitTransfer, {});
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");

  const fromAcc = accounts.find((a) => String(a.id) === from);
  const available = Number(fromAcc?.currentBalance ?? 0);

  return (
    <Card title="Transfer Between Accounts">
      <form action={formAction} className="p-5 space-y-3">
        {state.error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle size={15} className="mt-0.5" /> {state.error}
          </div>
        )}
        <Field label="From" required>
          <select name="fromAccountId" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} required>
            <option value="">Choose account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name} — {money(a.currentBalance)}</option>
            ))}
          </select>
        </Field>
        <Field label="To" required>
          <select name="toAccountId" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} required>
            <option value="">Choose account</option>
            {accounts.filter((a) => String(a.id) !== from).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Amount" required hint={fromAcc ? `Available: ${money(available)}` : undefined}>
          <input name="amount" type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} required />
        </Field>
        {fromAcc && Number(amount) > 0 && (
          <button type="button" onClick={() => setAmount(String(available))} className="text-xs font-medium text-blue-600 hover:underline">
            Transfer everything ({money(available)})
          </button>
        )}
        <Field label="Date" required>
          <input name="date" type="date" defaultValue={todayInput()} className={inputClass} required />
        </Field>
        <Field label="Reference">
          <input name="reference" className={inputClass} placeholder="Voucher / cheque no." />
        </Field>
        <button type="submit" disabled={pending || !from || !to} className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
          <ArrowLeftRight size={16} /> {pending ? "Transferring..." : "Transfer"}
        </button>
      </form>
    </Card>
  );
}
