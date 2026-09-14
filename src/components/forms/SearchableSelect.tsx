"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

export type SelectOption = { id: number; label: string; hint?: string; note?: string };

/**
 * Typeable single-select. Behaves like a normal <select> for form submission
 * (a hidden input carries the chosen id) but lets the user type to filter.
 */
export function SearchableSelect({
  name,
  options,
  value,
  onChange,
  placeholder = "Search...",
  emptyMessage = "No matches found.",
  disabled,
}: {
  name: string;
  options: SelectOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => String(o.id) === value);

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options.slice(0, 60);
    return options
      .filter((o) => `${o.label} ${o.hint ?? ""} ${o.note ?? ""}`.toLowerCase().includes(term))
      .slice(0, 60);
  }, [options, query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const choose = (o: SelectOption) => {
    onChange(String(o.id));
    setQuery("");
    setOpen(false);
    setHighlight(0);
  };

  return (
    <div ref={boxRef} className="relative">
      {/* The real form value */}
      <input type="hidden" name={name} value={value} />

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
      >
        <span className={selected ? "text-slate-800" : "text-slate-400"}>
          {selected ? selected.label : "Choose customer"}
          {selected?.hint && <span className="ml-1 text-xs text-slate-500">{selected.hint}</span>}
        </span>
        <ChevronDown size={15} className="shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <Search size={14} className="shrink-0 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlight(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlight((h) => Math.min(h + 1, matches.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlight((h) => Math.max(h - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (matches[highlight]) choose(matches[highlight]);
                } else if (e.key === "Escape") {
                  setOpen(false);
                }
              }}
              placeholder={placeholder}
              className="w-full text-sm outline-none placeholder:text-slate-400"
            />
          </div>
          <ul className="max-h-72 overflow-y-auto">
            {matches.length === 0 && <li className="px-3 py-4 text-center text-sm text-slate-500">{emptyMessage}</li>}
            {matches.map((o, i) => (
              <li key={o.id}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => choose(o)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
                    i === highlight ? "bg-blue-50" : ""
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-800">{o.label}</span>
                    {(o.hint || o.note) && (
                      <span className="block truncate text-xs text-slate-500">
                        {[o.hint, o.note].filter(Boolean).join(" • ")}
                      </span>
                    )}
                  </span>
                  {String(o.id) === value && <Check size={15} className="shrink-0 text-blue-600" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
