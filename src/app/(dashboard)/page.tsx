import React from "react";
import Link from "next/link";
import {
  Plus,
  AlertTriangle,
  Package,
  TrendingUp,
  Users,
  ShoppingCart,
  CreditCard,
  Truck,
  FileText,
  Receipt,
  Wallet,
  Boxes,
  Activity,
} from "lucide-react";
import { db } from "@/db";
import { customers, invoices, suppliers } from "@/db/schema";
import { sql } from "drizzle-orm";
import { ensureSeed } from "@/lib/seed";
import { getInventorySummary, getMovements, stockStatus } from "@/lib/services/inventory";
import { money, num, qty, dateTime } from "@/lib/format";
import { Badge, Card, LinkButton } from "@/components/ui";

export const dynamic = "force-dynamic";

function StatCard({
  title,
  value,
  icon: Icon,
  tone = "slate",
  hint,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  tone?: "slate" | "blue" | "green" | "amber" | "red" | "indigo";
  hint?: string;
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-600",
    blue: "bg-blue-100 text-blue-600",
    green: "bg-emerald-100 text-emerald-600",
    amber: "bg-amber-100 text-amber-600",
    red: "bg-red-100 text-red-600",
    indigo: "bg-indigo-100 text-indigo-600",
  };
  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
      <div className={`inline-flex p-2 rounded-lg ${tones[tone]}`}>
        <Icon size={18} />
      </div>
      <p className="text-sm text-slate-500 font-medium mt-3">{title}</p>
      <h3 className="text-xl font-bold text-slate-900 mt-0.5">{value}</h3>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

function QuickAction({
  title,
  href,
  icon: Icon,
  color,
  ready = true,
}: {
  title: string;
  href: string;
  icon: React.ElementType;
  color: string;
  ready?: boolean;
}) {
  const inner = (
    <>
      <div className={`p-2.5 rounded-full ${color} text-white mb-2`}>
        <Icon size={20} />
      </div>
      <span className="text-xs font-medium text-slate-700 text-center">{title}</span>
    </>
  );
  if (!ready) {
    return (
      <div className="flex flex-col items-center justify-center p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 opacity-60">
        {inner}
      </div>
    );
  }
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-500 hover:shadow-md transition-all"
    >
      {inner}
    </Link>
  );
}

export default async function Dashboard() {
  await ensureSeed();

  const { totalProducts, totalQuantity, totalValue, lowStock, outOfStock } = await getInventorySummary();
  const movements = await getMovements(8);

  const [salesAgg] = await db
    .select({
      today: sql<string>`coalesce(sum(case when date_trunc('day', ${invoices.date}) = date_trunc('day', now()) then ${invoices.totalAmount} else 0 end), 0)`,
      month: sql<string>`coalesce(sum(case when date_trunc('month', ${invoices.date}) = date_trunc('month', now()) then ${invoices.totalAmount} else 0 end), 0)`,
      total: sql<string>`coalesce(sum(${invoices.totalAmount}), 0)`,
      count: sql<string>`count(*)`,
      due: sql<string>`coalesce(sum(${invoices.amountDue}), 0)`,
    })
    .from(invoices);

  const [custAgg] = await db
    .select({
      count: sql<string>`count(*)`,
      receivable: sql<string>`coalesce(sum(${customers.outstandingBalance}), 0)`,
    })
    .from(customers);

  const [suppAgg] = await db
    .select({
      count: sql<string>`count(*)`,
      payable: sql<string>`coalesce(sum(${suppliers.outstandingBalance}), 0)`,
    })
    .from(suppliers);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Business Overview</h1>
          <p className="text-slate-500 text-sm">
            Everything happening in your warehouse and shop, in one place.
          </p>
        </div>
        <LinkButton href="/inventory/stock">
          <Boxes size={16} /> Check Stock
        </LinkButton>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <TrendingUp size={16} className="text-blue-600" /> Sales
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Today's Sales" value={money(salesAgg?.today)} icon={ShoppingCart} tone="blue" />
          <StatCard title="This Month" value={money(salesAgg?.month)} icon={TrendingUp} tone="green" />
          <StatCard title="Total Sales" value={money(salesAgg?.total)} icon={Receipt} />
          <StatCard title="Invoices Issued" value={String(num(salesAgg?.count))} icon={FileText} tone="indigo" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Package size={16} className="text-indigo-600" /> Inventory
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard title="Products" value={String(totalProducts)} icon={Package} />
          <StatCard title="Stock Quantity" value={qty(totalQuantity)} icon={Boxes} tone="blue" />
          <StatCard title="Inventory Value" value={money(totalValue)} icon={Wallet} tone="indigo" hint="Valued at cost price" />
          <StatCard title="Low Stock" value={String(lowStock.length)} icon={AlertTriangle} tone="amber" />
          <StatCard title="Out of Stock" value={String(outOfStock.length)} icon={AlertTriangle} tone="red" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Wallet size={16} className="text-emerald-600" /> Money
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Customer Receivables" value={money(custAgg?.receivable)} icon={Users} tone="amber" />
          <StatCard title="Unpaid Invoice Amount" value={money(salesAgg?.due)} icon={Receipt} tone="red" />
          <StatCard title="Supplier Payables" value={money(suppAgg?.payable)} icon={Truck} tone="red" />
          <StatCard title="Total Customers" value={String(num(custAgg?.count))} icon={Users} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Plus size={16} /> Quick Actions
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <QuickAction title="New Sale" href="/sales/invoices/new" icon={ShoppingCart} color="bg-emerald-600" />
          <QuickAction title="Add Customer" href="/sales/customers/new" icon={Users} color="bg-blue-500" />
          <QuickAction title="Record Payment" href="/sales/payments/new" icon={CreditCard} color="bg-emerald-500" />
          <QuickAction title="Quotation" href="/sales/quotations/new" icon={FileText} color="bg-purple-600" />
          <QuickAction title="New Purchase" href="/purchasing/pos/new" icon={FileText} color="bg-amber-500" />
          <QuickAction title="Receive Stock" href="/purchasing/grn/new" icon={Boxes} color="bg-emerald-500" />
          <QuickAction title="Add Supplier" href="/purchasing/suppliers/new" icon={Truck} color="bg-amber-600" />
          <QuickAction title="New Product" href="/inventory/products/new" icon={Package} color="bg-blue-600" />
          <QuickAction title="Add Expense" href="/accounting/expenses/new" icon={Wallet} color="bg-red-500" />
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Needs Attention">
          <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
            {[...outOfStock, ...lowStock].slice(0, 8).map((p) => {
              const status = stockStatus(p.stock, p.reorderLevel, p.minStockLevel);
              return (
                <Link
                  key={p.id}
                  href={`/inventory/products/${p.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 hover:bg-slate-50"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{p.name}</p>
                    <p className="text-xs text-slate-500">
                      {p.code} • reorder at {qty(p.reorderLevel)} {p.unit ?? ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{qty(p.stock)}</p>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                </Link>
              );
            })}
            {outOfStock.length + lowStock.length === 0 && (
              <p className="text-sm text-slate-500 py-8 text-center">
                All products are comfortably in stock.
              </p>
            )}
          </div>
        </Card>

        <Card title="Recent Stock Activity">
          <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
            {movements.map((m) => {
              const q = num(m.quantity);
              return (
                <div key={m.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{m.product}</p>
                    <p className="text-xs text-slate-500">
                      {m.type.replace(/_/g, " ")} • {dateTime(m.createdAt)}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold ${q >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {q >= 0 ? "+" : ""}
                    {qty(q)}
                  </span>
                </div>
              );
            })}
            {movements.length === 0 && (
              <p className="text-sm text-slate-500 py-8 text-center">No stock activity recorded yet.</p>
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}
