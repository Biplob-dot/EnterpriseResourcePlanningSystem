"use client";

import React, { useActionState, useState } from "react";
import Link from "next/link";
import { Save, AlertCircle } from "lucide-react";
import { Card, Field, inputClass } from "@/components/ui";
import { saveProduct, type FormState } from "../actions";

type Option = { id: number; name: string };

export function ProductForm({
  product,
  categories,
  brands,
  units,
  warehouses,
  bins,
}: {
  product?: Record<string, any> | null;
  categories: Option[];
  brands: Option[];
  units: { id: number; name: string; symbol: string }[];
  warehouses: Option[];
  bins: { id: number; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveProduct, {});
  const [length, setLength] = useState(product?.length ?? "");
  const [width, setWidth] = useState(product?.width ?? "");

  const area = Number(length) > 0 && Number(width) > 0 ? (Number(length) * Number(width)).toFixed(2) : "";

  return (
    <form action={formAction} className="space-y-6 max-w-5xl">
      {product?.id && <input type="hidden" name="id" value={product.id} />}

      {state.error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5" />
          <span>{state.error}</span>
        </div>
      )}

      <Card title="Basic Information">
        <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Product Code / SKU" required>
            <input name="code" defaultValue={product?.code ?? ""} className={inputClass} placeholder="PLY-18-CM" />
          </Field>
          <Field label="Barcode">
            <input name="barcode" defaultValue={product?.barcode ?? ""} className={inputClass} />
          </Field>
          <Field label="Unit of Measurement">
            <select name="unitId" defaultValue={product?.unitId ?? ""} className={inputClass}>
              <option value="">Select unit</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.symbol})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Product Name" required className="md:col-span-2">
            <input name="name" defaultValue={product?.name ?? ""} className={inputClass} placeholder="18mm Commercial Plywood 8x4" />
          </Field>
          <Field label="Status">
            <select name="isActive" defaultValue={String(product?.isActive ?? true)} className={inputClass}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </Field>
          <Field label="Category">
            <select name="categoryId" defaultValue={product?.categoryId ?? ""} className={inputClass}>
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Brand">
            <select name="brandId" defaultValue={product?.brandId ?? ""} className={inputClass}>
              <option value="">Select brand</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tax Rate (%)">
            <input
              name="taxRate"
              type="number"
              step="0.01"
              min="0"
              defaultValue={product?.taxRate ?? "13"}
              className={inputClass}
            />
          </Field>
          <Field label="Description" className="md:col-span-3">
            <textarea name="description" defaultValue={product?.description ?? ""} rows={2} className={inputClass} />
          </Field>
        </div>
      </Card>

      <Card title="Pricing & Stock Levels">
        <div className="p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
          <Field label="Purchase Price" hint="Cost per unit">
            <input
              name="purchasePrice"
              type="number"
              step="0.01"
              min="0"
              defaultValue={product?.purchasePrice ?? "0"}
              className={inputClass}
            />
          </Field>
          <Field label="Selling Price">
            <input
              name="sellingPrice"
              type="number"
              step="0.01"
              min="0"
              defaultValue={product?.sellingPrice ?? "0"}
              className={inputClass}
            />
          </Field>
          <Field label="Minimum Stock" hint="Critical level">
            <input
              name="minStockLevel"
              type="number"
              step="0.01"
              min="0"
              defaultValue={product?.minStockLevel ?? "0"}
              className={inputClass}
            />
          </Field>
          <Field label="Reorder Level" hint="Warn below this quantity">
            <input
              name="reorderLevel"
              type="number"
              step="0.01"
              min="0"
              defaultValue={product?.reorderLevel ?? "0"}
              className={inputClass}
            />
          </Field>
        </div>
      </Card>

      <Card title="Sheet Dimensions (for plywood, MDF, laminate)">
        <div className="p-5 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Field label="Thickness" hint="e.g. 18 mm">
            <input name="thickness" defaultValue={product?.thickness ?? ""} className={inputClass} placeholder="18 mm" />
          </Field>
          <Field label="Length (ft)">
            <input
              name="length"
              type="number"
              step="0.01"
              min="0"
              value={length}
              onChange={(e) => setLength(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Width (ft)">
            <input
              name="width"
              type="number"
              step="0.01"
              min="0"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Area (sq.ft)" hint="Calculated automatically">
            <input name="area" value={area} readOnly className={`${inputClass} bg-slate-50 text-slate-600`} />
          </Field>
          <Field label="Grade">
            <input name="grade" defaultValue={product?.grade ?? ""} className={inputClass} placeholder="MR / BWP" />
          </Field>
          <Field label="Finish">
            <input name="finish" defaultValue={product?.finish ?? ""} className={inputClass} placeholder="Glossy" />
          </Field>
        </div>
      </Card>

      {!product?.id && (
        <Card title="Opening Stock (optional)">
          <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Opening Quantity">
              <input name="openingStock" type="number" step="0.01" min="0" defaultValue="0" className={inputClass} />
            </Field>
            <Field label="Warehouse">
              <select name="warehouseId" defaultValue={warehouses[0]?.id ?? ""} className={inputClass}>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Shelf / Bin">
              <select name="binId" defaultValue="" className={inputClass}>
                <option value="">Not assigned</option>
                {bins.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          <Save size={16} /> {pending ? "Saving..." : "Save Product"}
        </button>
        <Link
          href="/inventory/products"
          className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
