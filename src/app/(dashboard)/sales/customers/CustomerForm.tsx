"use client";

import React, { useActionState } from "react";
import Link from "next/link";
import { AlertCircle, Save } from "lucide-react";
import { Card, Field, inputClass } from "@/components/ui";
import { saveCustomer, type FormState } from "../actions";

export function CustomerForm({ customer }: { customer?: Record<string, any> | null }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveCustomer, {});

  return (
    <form action={formAction} className="space-y-6 max-w-4xl">
      {customer?.id && <input type="hidden" name="id" value={customer.id} />}
      {state.error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5" /> {state.error}
        </div>
      )}

      <Card title="Customer Details">
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Customer Name" required>
            <input name="name" defaultValue={customer?.name ?? ""} className={inputClass} placeholder="e.g. Krishna Furniture Works" />
          </Field>
          <Field label="Company Name">
            <input name="companyName" defaultValue={customer?.companyName ?? ""} className={inputClass} />
          </Field>
          <Field label="Contact Person">
            <input name="contactPerson" defaultValue={customer?.contactPerson ?? ""} className={inputClass} />
          </Field>
          <Field label="Phone">
            <input name="phone" defaultValue={customer?.phone ?? ""} className={inputClass} />
          </Field>
          <Field label="Email">
            <input name="email" type="email" defaultValue={customer?.email ?? ""} className={inputClass} />
          </Field>
          <Field label="PAN / VAT Number">
            <input name="panVatNumber" defaultValue={customer?.panVatNumber ?? ""} className={inputClass} />
          </Field>
          <Field label="Address" className="md:col-span-2">
            <textarea name="address" rows={2} defaultValue={customer?.address ?? ""} className={inputClass} />
          </Field>
        </div>
      </Card>

      <Card title="Account Settings">
        <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          {!customer?.id && (
            <Field label="Opening Balance (owed to us)" hint="Amount already owed by this customer">
              <input name="openingBalance" type="number" step="0.01" min="0" defaultValue="0" className={inputClass} />
            </Field>
          )}
          <Field label="Status">
            <select name="isActive" defaultValue={String(customer?.isActive ?? true)} className={inputClass}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </Field>
          <Field label="Notes" className="md:col-span-2">
            <textarea name="notes" rows={2} defaultValue={customer?.notes ?? ""} className={inputClass} />
          </Field>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
          <Save size={16} /> {pending ? "Saving..." : "Save Customer"}
        </button>
        <Link href="/sales/customers" className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Cancel
        </Link>
      </div>
    </form>
  );
}
