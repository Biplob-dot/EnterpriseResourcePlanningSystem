import React from "react";
import { FileText } from "lucide-react";
import { LinkButton, PageHeader, StatTile } from "@/components/ui";
import { DataTable, type Cell } from "@/components/ui/DataTable";
import { Flash } from "@/components/ui/Flash";
import { getQuotations } from "@/lib/services/sales";
import { ensureSeed } from "@/lib/seed";
import { dateShort, money, num } from "@/lib/format";

export const dynamic = "force-dynamic";

const quoteTone = (s: string | null): Cell["tone"] =>
  s === "ACCEPTED" ? "green" : s === "SENT" ? "blue" : s === "REJECTED" || s === "EXPIRED" ? "red" : "slate";

export default async function QuotationsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await ensureSeed();
  const sp = await searchParams;
  const rows = await getQuotations();

  const data: Cell[][] = rows.map((q) => [
    { text: q.quoteNumber, href: `/sales/quotations/${q.id}` },
    { text: dateShort(q.date), sort: q.date ? new Date(q.date).getTime() : 0 },
    { text: q.customer ?? "-", sort: q.customer ?? "" },
    { text: q.validUntil ? dateShort(q.validUntil) : "-", muted: true, sort: q.validUntil ? new Date(q.validUntil).getTime() : 0 },
    { text: String(num(q.itemCount)), sort: num(q.itemCount), muted: true },
    { text: money(q.totalAmount), sort: num(q.totalAmount) },
    { text: (q.status ?? "DRAFT").replace(/_/g, " "), tone: quoteTone(q.status) },
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotations"
        subtitle="Price quotes you send to customers before they place an order."
        actions={
          <LinkButton href="/sales/quotations/new">
            <FileText size={16} /> New Quotation
          </LinkButton>
        }
      />
      <Flash saved={sp.saved} error={sp.error} />

      <div className="grid grid-cols-2 gap-4 max-w-xl">
        <StatTile label="Quotations" value={String(rows.length)} />
        <StatTile label="Total Value" value={money(rows.reduce((s, r) => s + num(r.totalAmount), 0))} tone="blue" />
      </div>

      <DataTable
        title="Quotation List"
        exportName="quotations"
        columns={[
          { label: "Quote No." },
          { label: "Date" },
          { label: "Customer" },
          { label: "Valid Until" },
          { label: "Lines", align: "right" },
          { label: "Total", align: "right", total: true },
          { label: "Status" },
        ]}
        rows={data}
        emptyMessage="No quotations yet. Create one to share pricing with a customer."
      />
    </div>
  );
}
