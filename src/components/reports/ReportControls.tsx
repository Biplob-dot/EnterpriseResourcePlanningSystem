import React from "react";
import Link from "next/link";
import { Filter, Printer } from "lucide-react";
import { Field, inputClass } from "@/components/ui";
import { PrintButton } from "@/components/documents/PrintButton";

export const reportLinks = [
  { label: "Inventory", href: "/reports/inventory" },
  { label: "Sales", href: "/reports/sales" },
  { label: "Purchases", href: "/reports/purchases" },
  { label: "Profit", href: "/reports/profit" },
  { label: "Receivables", href: "/reports/receivables" },
  { label: "Payables", href: "/reports/payables" },
  { label: "Tax / VAT", href: "/reports/tax" },
];

export function ReportNav({ active }: { active: string }) {
  return (
    <nav className="flex flex-wrap gap-2 print:hidden">
      {reportLinks.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
            active === l.label
              ? "border-blue-600 bg-blue-600 text-white"
              : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

export function ReportFilters({
  from,
  to,
  children,
  clearHref,
}: {
  from?: string;
  to?: string;
  children?: React.ReactNode;
  clearHref: string;
}) {
  return (
    <form className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 print:hidden">
      <Field label="From">
        <input type="date" name="from" defaultValue={from ?? ""} className={inputClass} />
      </Field>
      <Field label="To">
        <input type="date" name="to" defaultValue={to ?? ""} className={inputClass} />
      </Field>
      {children}
      <button className="inline-flex h-[38px] items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700">
        <Filter size={15} /> Apply Filters
      </button>
      <Link href={clearHref} className="pb-2.5 text-sm text-slate-500 hover:underline">
        Clear
      </Link>
      <div className="ml-auto">
        <PrintButton>
          <Printer size={15} /> Print / Save PDF
        </PrintButton>
      </div>
    </form>
  );
}

export function ReportPrintHeader({
  title,
  range,
}: {
  title: string;
  range: string;
}) {
  return (
    <div className="hidden border-b border-slate-300 pb-4 print:block">
      <div className="flex justify-between">
        <div>
          <h1 className="text-xl font-bold">PlyERP</h1>
          <p className="text-sm text-slate-500">Plywood Warehouse System</p>
        </div>
        <div className="text-right">
          <h2 className="text-lg font-bold uppercase">{title}</h2>
          <p className="text-sm text-slate-600">{range}</p>
        </div>
      </div>
    </div>
  );
}

export function ReportTabs({
  items,
  active,
  baseHref,
  preserve = "",
}: {
  items: { key: string; label: string }[];
  active: string;
  baseHref: string;
  preserve?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-slate-200 print:hidden">
      {items.map((item) => {
        const joiner = preserve ? "&" : "?";
        const href = `${baseHref}${preserve}${joiner}view=${item.key}`;
        return (
          <Link
            key={item.key}
            href={href}
            className={`border-b-2 px-4 py-2 text-sm font-medium ${
              active === item.key
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
