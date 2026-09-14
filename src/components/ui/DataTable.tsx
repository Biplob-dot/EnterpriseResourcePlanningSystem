"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpDown, Download, Printer, Search, ChevronLeft, ChevronRight } from "lucide-react";

export type Cell = {
  text: string;
  sort?: number | string;
  tone?: "green" | "red" | "amber" | "blue" | "slate" | "indigo";
  href?: string;
  muted?: boolean;
  bold?: boolean;
  node?: React.ReactNode;
};

export type Column = {
  label: string;
  align?: "left" | "right" | "center";
  total?: boolean;
  width?: string;
};

const toneMap: Record<string, string> = {
  green: "bg-emerald-100 text-emerald-700 border-emerald-200",
  red: "bg-red-100 text-red-700 border-red-200",
  amber: "bg-amber-100 text-amber-700 border-amber-200",
  blue: "bg-blue-100 text-blue-700 border-blue-200",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
  indigo: "bg-indigo-100 text-indigo-700 border-indigo-200",
};

export function DataTable({
  columns,
  rows,
  title,
  emptyMessage = "No records found.",
  pageSize = 15,
  exportName = "export",
}: {
  columns: Column[];
  rows: Cell[][];
  title?: string;
  emptyMessage?: string;
  pageSize?: number;
  exportName?: string;
}) {
  const [search, setSearch] = useState("");
  const [sortIdx, setSortIdx] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.some((c) => c.text?.toLowerCase().includes(q)));
  }, [rows, search]);

  const sorted = useMemo(() => {
    if (sortIdx === null) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = a[sortIdx]?.sort ?? a[sortIdx]?.text ?? "";
      const bv = b[sortIdx]?.sort ?? b[sortIdx]?.text ?? "";
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return copy;
  }, [filtered, sortIdx, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, totalPages);
  const paged = sorted.slice((current - 1) * pageSize, current * pageSize);

  const totals = useMemo(() => {
    return columns.map((col, i) => {
      if (!col.total) return null;
      return sorted.reduce((sum, r) => {
        const v = r[i]?.sort;
        return sum + (typeof v === "number" ? v : 0);
      }, 0);
    });
  }, [columns, sorted]);

  const exportCsv = () => {
    const header = columns.map((c) => `"${c.label}"`).join(",");
    const body = sorted
      .map((r) => r.map((c) => `"${(c.text ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportName}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSort = (i: number) => {
    if (sortIdx === i) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortIdx(i);
      setSortDir("asc");
    }
  };

  const align = (a?: string) =>
    a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden print:border-0 print:shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 print:hidden">
        <div className="flex items-center gap-3">
          {title && <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>}
          <span className="text-xs text-slate-500">{sorted.length} records</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search..."
              className="pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 w-56"
            />
          </div>
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50"
            type="button"
          >
            <Download size={14} /> Excel
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50"
            type="button"
          >
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {columns.map((c, i) => (
                <th
                  key={i}
                  onClick={() => toggleSort(i)}
                  style={c.width ? { width: c.width } : undefined}
                  className={`px-4 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wide cursor-pointer select-none hover:text-slate-900 ${align(
                    c.align
                  )}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.label}
                    <ArrowUpDown size={11} className={sortIdx === i ? "text-blue-600" : "text-slate-300"} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paged.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {paged.map((row, ri) => (
              <tr key={ri} className="hover:bg-slate-50/70">
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`px-4 py-2.5 ${align(columns[ci]?.align)} ${
                      cell.muted ? "text-slate-500" : "text-slate-800"
                    } ${cell.bold ? "font-semibold" : ""}`}
                  >
                    {cell.node !== undefined ? (
                      cell.node
                    ) : cell.tone ? (
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                          toneMap[cell.tone]
                        }`}
                      >
                        {cell.text}
                      </span>
                    ) : cell.href ? (
                      <Link href={cell.href} className="text-blue-600 hover:underline font-medium">
                        {cell.text}
                      </Link>
                    ) : (
                      cell.text
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {totals.some((t) => t !== null) && sorted.length > 0 && (
            <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-semibold text-slate-800">
              <tr>
                {columns.map((c, i) => (
                  <td key={i} className={`px-4 py-2.5 ${align(c.align)}`}>
                    {i === 0
                      ? "Total"
                      : totals[i] !== null
                      ? (totals[i] as number).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : ""}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 print:hidden">
          <span className="text-xs text-slate-500">
            Page {current} of {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, current - 1))}
              disabled={current === 1}
              className="p-1.5 border border-slate-300 rounded-md disabled:opacity-40 hover:bg-slate-50"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, current + 1))}
              disabled={current === totalPages}
              className="p-1.5 border border-slate-300 rounded-md disabled:opacity-40 hover:bg-slate-50"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
