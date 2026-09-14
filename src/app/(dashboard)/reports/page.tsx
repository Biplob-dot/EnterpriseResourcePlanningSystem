import React from "react";
import Link from "next/link";
import {
  Boxes,
  ShoppingCart,
  Truck,
  TrendingUp,
  Users,
  Landmark,
  ReceiptText,
  ArrowRight,
} from "lucide-react";
import { PageHeader, StatTile } from "@/components/ui";
import { getInventorySummary } from "@/lib/services/inventory";
import { getProfitSnapshot, getReceivableAging } from "@/lib/services/finance";
import { getSuppliers } from "@/lib/services/purchasing";
import { ensureSeed } from "@/lib/seed";
import { money, num } from "@/lib/format";

export const dynamic = "force-dynamic";

const reportCards = [
  {
    title: "Inventory Reports",
    description: "Stock summary, valuation, movements, low/out-of-stock, fast, slow and dead stock.",
    href: "/reports/inventory",
    icon: Boxes,
    color: "bg-indigo-100 text-indigo-700",
  },
  {
    title: "Sales Reports",
    description: "Daily and monthly sales, products, categories, customers, methods and returns.",
    href: "/reports/sales",
    icon: ShoppingCart,
    color: "bg-blue-100 text-blue-700",
  },
  {
    title: "Purchase Reports",
    description: "Purchases by supplier, product and category, plus returns and balances.",
    href: "/reports/purchases",
    icon: Truck,
    color: "bg-amber-100 text-amber-700",
  },
  {
    title: "Profit Reports",
    description: "Gross and net profit with analysis by product, category and customer.",
    href: "/reports/profit",
    icon: TrendingUp,
    color: "bg-emerald-100 text-emerald-700",
  },
  {
    title: "Accounts Receivable",
    description: "Outstanding customer invoices and aging: current through 90+ days.",
    href: "/reports/receivables",
    icon: Users,
    color: "bg-purple-100 text-purple-700",
  },
  {
    title: "Accounts Payable",
    description: "Supplier balances and purchase aging based on agreed credit periods.",
    href: "/reports/payables",
    icon: Landmark,
    color: "bg-red-100 text-red-700",
  },
  {
    title: "Tax / VAT Report",
    description: "Output tax, input tax, returns adjustments and net VAT by month.",
    href: "/reports/tax",
    icon: ReceiptText,
    color: "bg-slate-100 text-slate-700",
  },
];

export default async function ReportsPage() {
  await ensureSeed();
  const [inventory, profit, receivables, suppliers] = await Promise.all([
    getInventorySummary(),
    getProfitSnapshot(new Date(new Date().getFullYear(), new Date().getMonth(), 1), new Date()),
    getReceivableAging(),
    getSuppliers(),
  ]);
  const payable = suppliers.reduce((sum, s) => sum + Math.max(0, num(s.outstandingBalance)), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        subtitle="Clear business information for decisions, printing and spreadsheet export."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Inventory Value" value={money(inventory.totalValue)} tone="indigo" />
        <StatTile label="Sales This Month" value={money(profit.revenue)} tone="blue" />
        <StatTile label="Customer Receivables" value={money(receivables.reduce((s, r) => s + num(r.due), 0))} tone="amber" />
        <StatTile label="Supplier Payables" value={money(payable)} tone="red" />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {reportCards.map((card) => (
          <Link
            href={card.href}
            key={card.href}
            className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-blue-400 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-4">
              <div className={`rounded-lg p-2.5 ${card.color}`}>
                <card.icon size={21} />
              </div>
              <ArrowRight size={17} className="text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-blue-600" />
            </div>
            <h2 className="mt-4 font-semibold text-slate-900">{card.title}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">{card.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
