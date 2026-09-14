import React from "react";
import { Plus, ArrowRight } from "lucide-react";
import { db } from "@/db";
import { units, unitConversions } from "@/db/schema";
import { alias } from "drizzle-orm/pg-core";
import { eq } from "drizzle-orm";
import { Card, Field, PageHeader, inputClass } from "@/components/ui";
import { Flash } from "@/components/ui/Flash";
import { createConversion, createUnit, deleteConversion } from "../actions";
import { ensureSeed } from "@/lib/seed";
import { num } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function UnitsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  await ensureSeed();
  const sp = await searchParams;

  const fromUnit = alias(units, "from_unit");
  const toUnit = alias(units, "to_unit");

  const unitRows = await db.select().from(units).orderBy(units.name);
  const conversions = await db
    .select({
      id: unitConversions.id,
      from: fromUnit.name,
      fromSymbol: fromUnit.symbol,
      to: toUnit.name,
      toSymbol: toUnit.symbol,
      multiplier: unitConversions.multiplier,
    })
    .from(unitConversions)
    .leftJoin(fromUnit, eq(unitConversions.fromUnitId, fromUnit.id))
    .leftJoin(toUnit, eq(unitConversions.toUnitId, toUnit.id));

  return (
    <div>
      <PageHeader
        title="Units & Conversions"
        subtitle="Set how one unit converts to another, for example 1 Sheet = 32 sq.ft."
      />
      <Flash saved={sp.saved} error={sp.error} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Units of Measurement">
          <form action={createUnit} className="p-5 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <Field label="Unit name" required>
              <input name="name" className={inputClass} placeholder="Bundle" required />
            </Field>
            <Field label="Short symbol" required>
              <input name="symbol" className={inputClass} placeholder="bdl" required />
            </Field>
            <button className="inline-flex h-[38px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700">
              <Plus size={16} /> Add
            </button>
          </form>
          <ul className="divide-y divide-slate-100 text-sm">
            {unitRows.map((u) => (
              <li key={u.id} className="px-5 py-2.5 flex items-center justify-between">
                <span className="font-medium text-slate-800">{u.name}</span>
                <span className="text-slate-500">{u.symbol}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Conversion Rules">
          <form action={createConversion} className="p-5 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <Field label="1 unit of" required>
              <select name="fromUnitId" className={inputClass} required>
                <option value="">Select</option>
                {unitRows.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="equals" required>
              <input name="multiplier" type="number" step="0.0001" min="0.0001" className={inputClass} placeholder="32" required />
            </Field>
            <Field label="of unit" required>
              <select name="toUnitId" className={inputClass} required>
                <option value="">Select</option>
                {unitRows.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </Field>
            <button className="inline-flex h-[38px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700">
              <Plus size={16} /> Add
            </button>
          </form>
          <ul className="divide-y divide-slate-100 text-sm">
            {conversions.length === 0 && (
              <li className="px-5 py-8 text-center text-slate-500">No conversion rules yet.</li>
            )}
            {conversions.map((c) => (
              <li key={c.id} className="px-5 py-2.5 flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-800">
                  <strong>1 {c.from}</strong>
                  <ArrowRight size={14} className="text-slate-400" />
                  <strong>
                    {num(c.multiplier)} {c.toSymbol}
                  </strong>
                </span>
                <form action={deleteConversion}>
                  <input type="hidden" name="id" value={c.id} />
                  <button className="text-xs font-medium text-red-600 hover:underline">Remove</button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
