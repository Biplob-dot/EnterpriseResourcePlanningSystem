"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, X } from "lucide-react";

type Hit = {
  label: string;
  sub: string;
  href: string;
  type: string;
  tone: string;
};

const toneMap: Record<string, string> = {
  green: "bg-emerald-100 text-emerald-700 border-emerald-200",
  red: "bg-red-100 text-red-700 border-red-200",
  amber: "bg-amber-100 text-amber-700 border-amber-200",
  blue: "bg-blue-100 text-blue-700 border-blue-200",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
  indigo: "bg-indigo-100 text-indigo-700 border-indigo-200",
};

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced server search
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
        const data = await res.json();
        setHits(data.results ?? []);
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);

  // Click away to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Global / keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.getElementById("global-search-input")?.focus();
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  return (
    <div ref={boxRef} className="relative w-72">
      <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
      <input
        id="global-search-input"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search products, customers, invoices…"
        className="w-full rounded-lg border border-slate-300 bg-slate-50 py-2 pl-9 pr-8 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
      />
      {query && (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setHits([]);
          }}
          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
          aria-label="Clear search"
        >
          <X size={14} />
        </button>
      )}

      {open && query.trim().length >= 2 && (
        <div className="absolute z-50 mt-1 max-h-96 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
          {loading && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-500">
              <Loader2 size={14} className="animate-spin" /> Searching…
            </div>
          )}
          {!loading && hits.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-slate-500">
              No matches for “{query}”.
            </div>
          )}
          {!loading &&
            hits.map((hit, i) => (
              <button
                key={`${hit.type}-${hit.href}-${i}`}
                type="button"
                onClick={() => go(hit.href)}
                className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5 text-left last:border-0 hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{hit.label}</p>
                  <p className="truncate text-xs text-slate-500">{hit.sub}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${toneMap[hit.tone] ?? toneMap.slate}`}>
                  {hit.type}
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
