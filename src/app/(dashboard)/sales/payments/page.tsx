import React from "react";
import { CreditCard, RotateCcw } from "lucide-react";
import { LinkButton, PageHeader, StatTile, Badge } from "@/components/ui";
import { DataTable, type Cell } from "@/components/ui/DataTable";
import { Flash } from "@/components/ui/Flash";
import { ConfirmForm } from "@/components/documents/PrintButton";
import { getCustomerPayments } from "@/lib/services/sales";
import { toggleChequeStatusAction, voidPaymentAction } from "../actions";
import { ensureSeed } from "@/lib/seed";
import { dateShort, money, num } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CustomerPaymentsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await ensureSeed();
  const sp = await searchParams;
  const rows = await getCustomerPayments();

  const now = new Date();
  const monthTotal = rows
    .filter((r) => r.date && new Date(r.date).getMonth() === now.getMonth() && new Date(r.date).getFullYear() === now.getFullYear())
    .reduce((s, r) => s + num(r.amount), 0);

  // Cheques received but not yet cashed in by the bank.
  const unclearedCheques = rows
    .filter((r) => r.paymentMethod === "Cheque" && !r.chequeCleared && r.status !== "VOID")
    .reduce((s, r) => s + num(r.amount), 0);

  const data: Cell[][] = rows.map((p) => {
    const isCheque = p.paymentMethod === "Cheque";
    const isVoid = p.status === "VOID";
    return [
      { text: p.paymentNumber, muted: true },
      { text: dateShort(p.date), sort: p.date ? new Date(p.date).getTime() : 0 },
      { text: p.customer, href: `/sales/customers/${p.customerId}`, sort: p.customer },
      { text: p.paymentMethod ?? "-", tone: p.paymentMethod === "Cash" ? "green" : "blue" },
      { text: p.reference ?? "-", muted: true },
      {
        text: isCheque && p.chequeDate ? dateShort(p.chequeDate) : "-",
        sort: isCheque && p.chequeDate ? new Date(p.chequeDate).getTime() : 0,
        muted: !isCheque,
      },
      {
        text: "",
        node: isCheque ? (
          <span className="inline-flex items-center gap-2">
            <Badge tone={isVoid ? "slate" : p.chequeCleared ? "green" : "amber"}>
              {isVoid ? "Void" : p.chequeCleared ? "Cashed in" : "Not cashed in"}
            </Badge>
            {!isVoid && (
              <form action={toggleChequeStatusAction}>
                <input type="hidden" name="id" value={p.id} />
                <button
                  type="submit"
                  className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  title={p.chequeCleared ? "Mark as not cashed in" : "Mark as cashed in"}
                >
                  {p.chequeCleared ? "Unclear" : "Cash in"}
                </button>
              </form>
            )}
          </span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
      },
      { text: money(p.amount), sort: num(p.amount), bold: true },
      { node: p.status === "VOID" ? <Badge tone="slate">Void</Badge> : <Badge tone="green">Active</Badge>, text: "" },
      {
        node: p.status === "COMPLETED" ? (
          <ConfirmForm action={voidPaymentAction} message="Void this payment? It will be reversed from the customer balance and bank account.">
            <input type="hidden" name="id" value={p.id} />
            <button className="text-xs font-medium text-red-600 hover:underline">Void</button>
          </ConfirmForm>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
        text: "",
      },
    ];
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Customer Payments" subtitle="Money received from customers." actions={<LinkButton href="/sales/payments/new"><CreditCard size={16} /> Record Payment</LinkButton>} />
      <Flash saved={sp.saved} error={sp.error} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Received This Month" value={money(monthTotal)} tone="green" />
        <StatTile label="Total Received" value={money(rows.reduce((s, r) => s + num(r.amount), 0))} tone="blue" />
        <StatTile label="Payments" value={String(rows.length)} />
        <StatTile
          label="Cheques Awaiting Cash-in"
          value={money(unclearedCheques)}
          tone={unclearedCheques > 0 ? "amber" : "green"}
        />
      </div>

      <DataTable
        title="Payment History"
        exportName="customer-payments"
        columns={[
          { label: "Payment No." },
          { label: "Date" },
          { label: "Customer" },
          { label: "Method" },
          { label: "Reference" },
          { label: "Cheque Date" },
          { label: "Cheque Status" },
          { label: "Amount", align: "right", total: true },
          { label: "Status" },
          { label: "" },
        ]}
        rows={data}
        emptyMessage="No customer payments recorded yet."
      />
    </div>
  );
}
