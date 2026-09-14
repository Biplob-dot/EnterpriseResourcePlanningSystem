"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Users,
  Truck,
  Receipt,
  Wallet,
  BarChart3,
  Settings,
  Database,
  Warehouse,
  FileText,
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  Ruler,
  Tags,
  Boxes,
  Activity,
} from "lucide-react";

type Item = { name: string; href: string; icon: React.ElementType; ready?: boolean };

const navItems: { group: string; items: Item[] }[] = [
  {
    group: "General",
    items: [{ name: "Dashboard", href: "/", icon: LayoutDashboard, ready: true }],
  },
  {
    group: "Inventory",
    items: [
      { name: "Products", href: "/inventory/products", icon: Package, ready: true },
      { name: "Categories & Brands", href: "/inventory/categories", icon: Tags, ready: true },
      { name: "Units", href: "/inventory/units", icon: Ruler, ready: true },
      { name: "Stock Levels", href: "/inventory/stock", icon: Boxes, ready: true },
      { name: "Stock Movement", href: "/inventory/movement", icon: Activity, ready: true },
      { name: "Warehouses", href: "/inventory/warehouses", icon: Warehouse, ready: true },
    ],
  },
  {
    group: "Purchasing",
    items: [
      { name: "Suppliers", href: "/purchasing/suppliers", icon: Truck, ready: true },
      { name: "Purchase Orders", href: "/purchasing/pos", icon: FileText, ready: true },
      { name: "Goods Received", href: "/purchasing/grn", icon: Package, ready: true },
      { name: "Purchase Returns", href: "/purchasing/returns", icon: ArrowDownLeft, ready: true },
      { name: "Supplier Payments", href: "/purchasing/payments", icon: CreditCard, ready: true },
    ],
  },
  {
    group: "Sales",
    items: [
      { name: "Customers", href: "/sales/customers", icon: Users, ready: true },
      { name: "Quotations", href: "/sales/quotations", icon: FileText, ready: true },
      { name: "Sales Orders", href: "/sales/orders", icon: FileText, ready: true },
      { name: "Invoices", href: "/sales/invoices", icon: Receipt, ready: true },
      { name: "Delivery Notes", href: "/sales/delivery", icon: Truck, ready: true },
      { name: "Payments", href: "/sales/payments", icon: CreditCard, ready: true },
      { name: "Sales Returns", href: "/sales/returns", icon: ArrowUpRight, ready: true },
    ],
  },
  {
    group: "Accounting",
    items: [
      { name: "Expenses", href: "/accounting/expenses", icon: Wallet, ready: true },
      { name: "Income", href: "/accounting/income", icon: Wallet, ready: true },
      { name: "Bank & Cash", href: "/accounting/bank", icon: CreditCard, ready: true },
      { name: "Ledger", href: "/accounting/ledger", icon: FileText, ready: true },
    ],
  },
  {
    group: "System",
    items: [
      { name: "Reports", href: "/reports", icon: BarChart3, ready: true },
      { name: "Settings", href: "/settings", icon: Settings, ready: true },
      { name: "Backup & Restore", href: "/backup", icon: Database, ready: true },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 h-screen sticky top-0 flex flex-col border-r border-slate-800 print:hidden">
      <div className="p-5 border-b border-slate-800">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <Package className="text-blue-500" size={20} />
          PlyERP
        </h1>
        <p className="text-[11px] text-slate-500 mt-1">Plywood Warehouse System</p>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-5">
        {navItems.map((group) => (
          <div key={group.group}>
            <h2 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">
              {group.group}
            </h2>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                if (!item.ready) {
                  return (
                    <li key={item.name}>
                      <span className="flex items-center justify-between px-2 py-1.5 rounded-md text-slate-600 cursor-not-allowed">
                        <span className="flex items-center gap-2.5">
                          <item.icon size={16} />
                          <span className="text-[13px]">{item.name}</span>
                        </span>
                        <span className="text-[9px] uppercase bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded">
                          soon
                        </span>
                      </span>
                    </li>
                  );
                }
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors ${
                        active ? "bg-blue-600 text-white" : "hover:bg-slate-800 hover:text-white"
                      }`}
                    >
                      <item.icon size={16} className={active ? "text-white" : "text-slate-400"} />
                      <span className="text-[13px]">{item.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-800 text-[11px] text-center text-slate-500">
        Phase 7 · Complete ERP
      </div>
    </aside>
  );
}
