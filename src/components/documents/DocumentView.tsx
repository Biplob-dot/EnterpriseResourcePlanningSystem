import React from "react";
import { Printer } from "lucide-react";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { Badge } from "@/components/ui";
import { PrintButton } from "./PrintButton";

export type DocColumn = { label: string; align?: "left" | "right" | "center" };
export type DocTotal = { label: string; value: string; strong?: boolean; tone?: "red" | "green" };

export async function getBusinessProfile() {
  const [config] = await db.select().from(settings).limit(1);
  return config ?? null;
}

export async function DocumentView({
  title,
  number,
  date,
  status,
  party,
  meta = [],
  columns,
  rows,
  totals,
  notes,
  footer,
  actions,
}: {
  title: string;
  number: string;
  date: string;
  status?: { label: string; tone: "green" | "red" | "amber" | "blue" | "slate" | "indigo" };
  party: { heading: string; name: string; lines: (string | null | undefined)[] };
  meta?: [string, string][];
  columns: DocColumn[];
  rows: string[][];
  totals: DocTotal[];
  notes?: string | null;
  footer?: string | null;
  actions?: React.ReactNode;
}) {
  const biz = await getBusinessProfile();
  const align = (a?: string) => (a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left");

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4 print:hidden">
        <div className="flex items-center gap-2">{actions}</div>
        <PrintButton>
          <Printer size={16} /> Print / Save PDF
        </PrintButton>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 print:border-0 print:shadow-none print:p-0 print:rounded-none">
        <div className="flex justify-between gap-6 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{biz?.businessName ?? "Business"}</h1>
            {biz?.address && <p className="text-sm text-slate-600 mt-1">{biz.address}</p>}
            <p className="text-sm text-slate-600">
              {[biz?.phone, biz?.email].filter(Boolean).join(" • ")}
            </p>
            {biz?.panVatNumber && <p className="text-sm text-slate-600">PAN/VAT: {biz.panVatNumber}</p>}
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 uppercase">{title}</h2>
            <p className="text-sm font-mono text-slate-700 mt-1">{number}</p>
            <p className="text-sm text-slate-500">{date}</p>
            {status && (
              <div className="mt-2">
                <Badge tone={status.tone}>{status.label}</Badge>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 py-6">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">{party.heading}</p>
            <p className="font-semibold text-slate-900 mt-1">{party.name}</p>
            {party.lines.filter(Boolean).map((l, i) => (
              <p key={i} className="text-sm text-slate-600">
                {l}
              </p>
            ))}
          </div>
          {meta.length > 0 && (
            <dl className="text-sm space-y-1">
              {meta.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="font-medium text-slate-800 text-right">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-slate-300 bg-slate-50 print:bg-transparent">
              {columns.map((c, i) => (
                <th key={i} className={`px-3 py-2 text-xs uppercase tracking-wide text-slate-600 font-semibold ${align(c.align)}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, ri) => (
              <tr key={ri}>
                {r.map((cell, ci) => (
                  <td key={ci} className={`px-3 py-2 text-slate-800 ${align(columns[ci]?.align)}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end pt-4">
          <dl className="w-72 space-y-1 text-sm">
            {totals.map((t) => (
              <div
                key={t.label}
                className={`flex justify-between ${t.strong ? "border-t border-slate-300 pt-2 text-base font-bold text-slate-900" : ""}`}
              >
                <dt className={t.strong ? "" : "text-slate-500"}>{t.label}</dt>
                <dd className={t.tone === "red" ? "text-red-600" : t.tone === "green" ? "text-emerald-600" : ""}>{t.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {notes && (
          <div className="mt-6 text-sm">
            <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Notes</p>
            <p className="text-slate-700 whitespace-pre-line mt-1">{notes}</p>
          </div>
        )}

        {footer && <p className="mt-8 text-xs text-slate-500 border-t border-slate-200 pt-4 whitespace-pre-line">{footer}</p>}
      </div>
    </div>
  );
}
