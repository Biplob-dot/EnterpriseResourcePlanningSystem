"use client";

import React, { useActionState } from "react";
import { AlertCircle, CheckCircle2, Save } from "lucide-react";
import { Card, Field, inputClass } from "@/components/ui";
import { saveAllSettings, type SettingsState } from "./actions";

type Unit = { id: number; name: string; symbol: string };
type Warehouse = { id: number; name: string };

export function SettingsForms({
  settings,
  units,
  warehouses,
}: {
  settings: Record<string, any> | null;
  units: Unit[];
  warehouses: Warehouse[];
}) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(saveAllSettings, {});

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5" /> {state.error}
        </div>
      )}
      {state.success && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 size={16} className="mt-0.5" /> {state.success}
        </div>
      )}

      <Card title="Business Information">
        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
          <Field label="Business Name" required>
            <input name="businessName" defaultValue={settings?.businessName ?? ""} className={inputClass} required />
          </Field>
          <Field label="Phone">
            <input name="phone" defaultValue={settings?.phone ?? ""} className={inputClass} />
          </Field>
          <Field label="Email">
            <input name="email" type="email" defaultValue={settings?.email ?? ""} className={inputClass} />
          </Field>
          <Field label="PAN / VAT Number" hint="Printed on invoices and statements">
            <input name="panVatNumber" defaultValue={settings?.panVatNumber ?? ""} className={inputClass} />
          </Field>
          <Field label="Address" className="md:col-span-2">
            <textarea name="address" rows={2} defaultValue={settings?.address ?? ""} className={inputClass} />
          </Field>
        </div>
      </Card>

      <Card title="Invoice Defaults">
        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
          <Field label="Invoice Prefix" hint="Used for the next invoice number">
            <input name="invoicePrefix" defaultValue={settings?.invoicePrefix ?? "INV-"} className={inputClass} />
          </Field>
          <Field label="Starting Invoice Number" hint="Used if no invoices exist yet">
            <input name="startingInvoiceNumber" type="number" min="1" defaultValue={settings?.startingInvoiceNumber ?? 1} className={inputClass} />
          </Field>
          <Field label="Invoice Footer" className="md:col-span-2">
            <textarea name="invoiceFooter" rows={2} defaultValue={settings?.invoiceFooter ?? ""} className={inputClass} />
          </Field>
          <Field label="Terms and Conditions" className="md:col-span-2">
            <textarea name="termsAndConditions" rows={3} defaultValue={settings?.termsAndConditions ?? ""} className={inputClass} />
          </Field>
        </div>
      </Card>

      <Card title="Inventory Defaults">
        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-3">
          <Field label="Default Unit">
            <select name="defaultUnitId" defaultValue={settings?.defaultUnitId ?? ""} className={inputClass}>
              <option value="">No default</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.symbol})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Default Warehouse">
            <select name="defaultWarehouseId" defaultValue={settings?.defaultWarehouseId ?? ""} className={inputClass}>
              <option value="">No default</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Low-Stock Threshold" hint="Fallback level when a product has no reorder level">
            <input name="lowStockThreshold" type="number" min="0" defaultValue={settings?.lowStockThreshold ?? 10} className={inputClass} />
          </Field>
        </div>
      </Card>

      <Card title="Tax and Currency">
        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-4">
          <Field label="Tax Name" hint="For example VAT, GST, Sales Tax">
            <input name="taxName" defaultValue={settings?.taxName ?? "VAT"} className={inputClass} />
          </Field>
          <Field label="Default Tax Rate (%)">
            <input name="taxRate" type="number" step="0.01" min="0" max="100" defaultValue={settings?.taxRate ?? 0} className={inputClass} />
          </Field>
          <Field label="Currency Symbol">
            <input name="currencySymbol" defaultValue={settings?.currencySymbol ?? "Rs."} className={inputClass} />
          </Field>
          <Field label="Currency Format">
            <select name="currencyFormat" defaultValue={settings?.currencyFormat ?? "en-US"} className={inputClass}>
              <option value="en-US">en-US</option>
              <option value="en-GB">en-GB</option>
              <option value="en-IN">en-IN</option>
              <option value="ne-NP">ne-NP</option>
            </select>
          </Field>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
          <Save size={16} /> {pending ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </form>
  );
}
