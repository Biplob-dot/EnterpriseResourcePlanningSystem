"use client";

import React, { useActionState } from "react";
import Link from "next/link";
import { AlertCircle, Wallet } from "lucide-react";
import { Card, Field, inputClass } from "@/components/ui";
import { PAYMENT_METHODS, todayInput } from "@/lib/calc";
import type { FormState } from "./actionsTypes";

export function ExpenseForm({
  categories,
  action,
  incomeCategories,
  mode,
}: {
  categories: string[];
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  incomeCategories?: string[];
  mode: "expense" | "income";
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      {state.error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5" /> {state.error}
        </div>
      )}
      <Card title={mode === "expense" ? "Expense Details" : "Income Details"}>
        <div className="p-5 space-y-4">
          <Field label={mode === "expense" ? "Expense Category" : "Income Category"} required>
            <select name="category" className={inputClass} defaultValue="" required>
              <option value="">Choose a category</option>
              {(incomeCategories ?? categories).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Amount" required>
              <input name="amount" type="number" step="0.01" min="0.01" className={inputClass} required />
            </Field>
            <Field label="Date" required>
              <input name="date" type="date" defaultValue={todayInput()} className={inputClass} required />
            </Field>
            <Field label="Payment Method" required>
              <select name="method" className={inputClass} defaultValue="Cash">
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Description">
            <input name="description" className={inputClass} placeholder="What was this for?" />
          </Field>
          <p className="text-xs text-slate-500">
            The amount is deducted from your cash or bank account and an accounting entry is created automatically.
          </p>
        </div>
      </Card>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
          <Wallet size={16} /> {pending ? "Saving..." : mode === "expense" ? "Record Expense" : "Record Income"}
        </button>
        <Link href={mode === "expense" ? "/accounting/expenses" : "/accounting/income"} className="text-sm text-slate-500 hover:underline">Cancel</Link>
      </div>
    </form>
  );
}
