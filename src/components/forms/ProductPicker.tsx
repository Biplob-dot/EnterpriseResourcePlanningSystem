"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { ProductOption } from "@/lib/services/inventory";

export function ProductPicker({
  products,
  onPick,
  placeholder = "Search by name, code, barcode or brand — press Enter to add",
  autoFocus,
  priceKey = "sellingPrice",
}: {
  products: ProductOption[];
  onPick: (p: ProductOption) => void;
  placeholder?: string;
  autoFocus?: boolean;
  priceKey?: "sellingPrice" | "purchasePrice";
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return products.slice(0, 8);
    const scored = products
      .map((p) => {
        const code = p.code.toLowerCase();
        const name = p.name.toLowerCase();
        const barcode = (p.barcode ?? "").toLowerCase();
        const brand = (p.brand ?? "").toLowerCase();
        let score = 0;
        if (code === term || barcode === term) score = 100;
        else if (code.startsWith(term)) score = 80;
        else if (name.startsWith(term)) score = 70;
        else if (name.includes(term) || code.includes(term)) score = 50;
        else if (brand.includes(term) || barcode.includes(term)) score = 30;
        return { p, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name));
    return scored.slice(0, 8).map((x) => x.p);
  }, [products, q]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pick = (p: ProductOption) => {
    onPick(p);
    setQ("");
    setHi(0);
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      <Search size={16} className="absolute left-3 top-3 text-slate-400" />
      <input
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setHi(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHi((h) => Math.min(h + 1, matches.length - 1));
            setOpen(true);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHi((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            const exact = products.find(
              (p) => p.code.toLowerCase() === q.trim().toLowerCase() || (p.barcode ?? "").toLowerCase() === q.trim().toLowerCase()
            );
            if (exact) pick(exact);
            else if (matches[hi]) pick(matches[hi]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
      {open && matches.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full max-h-80 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {matches.map((p, i) => (
            <li
              key={p.id}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(p);
              }}
              onMouseEnter={() => setHi(i)}
              className={`flex items-center justify-between px-3 py-2 cursor-pointer text-sm ${
                i === hi ? "bg-blue-50" : ""
              }`}
            >
              <div>
                <p className="font-medium text-slate-800">{p.name}</p>
                <p className="text-xs text-slate-500">
                  {p.code}
                  {p.brand ? ` • ${p.brand}` : ""}
                  {p.barcode ? ` • ${p.barcode}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-800">
                  {p[priceKey].toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
                <p className={`text-xs ${p.stock <= 0 ? "text-red-600" : "text-slate-500"}`}>
                  Stock: {p.stock} {p.unit ?? ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {open && q.trim() && matches.length === 0 && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-500 shadow-lg">
          No product matches &ldquo;{q}&rdquo;.
        </div>
      )}
    </div>
  );
}
