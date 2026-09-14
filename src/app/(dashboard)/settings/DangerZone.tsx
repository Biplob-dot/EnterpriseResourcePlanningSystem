"use client";

import React, { useActionState, useState } from "react";
import { AlertTriangle, CheckCircle2, Trash2, Loader2 } from "lucide-react";
import { Card, inputClass } from "@/components/ui";
import { clearDataAction, type SettingsState } from "./actions";

export function DangerZone() {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(clearDataAction, {});
  const [scope, setScope] = useState<"demo" | "transactions">("demo");

  return (
    <Card title="Danger Zone" className="border-red-200">
      <form action={formAction} className="space-y-4 p-5">
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            This permanently deletes data and cannot be undone. Create a backup first
            (Backup &amp; Restore) if you are unsure.
          </span>
        </div>

        {state.error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle size={15} className="mt-0.5" /> {state.error}
          </div>
        )}
        {state.success && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <CheckCircle2 size={15} className="mt-0.5" /> {state.success}
          </div>
        )}

        <div className="space-y-2">
          <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${scope === "demo" ? "border-red-400 bg-red-50/50" : "border-slate-200"}`}>
            <input type="radio" name="scope" value="demo" checked={scope === "demo"} onChange={() => setScope("demo")} className="mt-1" />
            <div>
              <p className="text-sm font-medium text-slate-800">Remove all demo / sample data (recommended for going live)</p>
              <p className="text-xs text-slate-500">
                Deletes every product, customer, supplier, invoice, purchase, payment and accounting entry, and stops the samples from coming back. Business settings, warehouses, units, categories and bank accounts are kept.
              </p>
            </div>
          </label>

          <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${scope === "transactions" ? "border-red-400 bg-red-50/50" : "border-slate-200"}`}>
            <input type="radio" name="scope" value="transactions" checked={scope === "transactions"} onChange={() => setScope("transactions")} className="mt-1" />
            <div>
              <p className="text-sm font-medium text-slate-800">Clear transactions only (keep products &amp; contacts)</p>
              <p className="text-xs text-slate-500">
                Deletes all sales, purchases, payments, stock movements and accounting, but keeps your products, customers and suppliers. Stock and balances reset to zero.
              </p>
            </div>
          </label>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Type <span className="font-mono font-bold text-red-600">DELETE</span> to confirm
          </label>
          <input name="confirmText" placeholder="DELETE" autoComplete="off" className={`${inputClass} max-w-xs`} />
        </div>

        <button
          type="submit"
          disabled={pending}
          onClick={(e) => {
            if (!confirm("This permanently deletes the selected data and cannot be undone. Continue?")) e.preventDefault();
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
        >
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
          {pending ? "Clearing..." : "Clear Data Permanently"}
        </button>
      </form>
    </Card>
  );
}
