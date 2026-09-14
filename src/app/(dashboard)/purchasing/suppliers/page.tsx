import React from "react";
import { Plus, CreditCard } from "lucide-react";
import { LinkButton, PageHeader, StatTile } from "@/components/ui";
import { DataTable, type Cell } from "@/components/ui/DataTable";
import { Flash } from "@/components/ui/Flash";
import { CsvImport } from "@/components/forms/CsvImport";
import { DeleteButton } from "@/components/forms/DeleteButton";
import { getSuppliers } from "@/lib/services/purchasing";
import { deleteSupplier, importSuppliersCsv } from "../actions";
import { ensureSeed } from "@/lib/seed";
import { money, num } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await ensureSeed();
  const sp = await searchParams;
  const rows = await getSuppliers();

  const totalPayable = rows.reduce((s, r) => s + Math.max(0, num(r.outstandingBalance)), 0);
  const totalPurchased = rows.reduce((s, r) => s + num(r.totalPurchased), 0);

  const data: Cell[][] = rows.map((s) => {
    const bal = num(s.outstandingBalance);
    return [
      { text: s.name, href: `/purchasing/suppliers/${s.id}`, sort: s.name },
      { text: s.companyName ?? "-", muted: true },
      { text: s.phone ?? "-", muted: true },
      { text: s.creditPeriod != null ? `${s.creditPeriod} days` : "-", muted: true, sort: s.creditPeriod ?? 0 },
      { text: String(num(s.grnCount)), sort: num(s.grnCount) },
      { text: money(s.totalPurchased), sort: num(s.totalPurchased) },
      { text: money(bal), sort: bal, bold: true, tone: bal > 0 ? "amber" : bal < 0 ? "blue" : "green" },
      { text: s.isActive ? "Active" : "Inactive", tone: s.isActive ? "green" : "slate" },
      {
        text: "",
        node: (
          <DeleteButton
            action={deleteSupplier}
            id={s.id}
            iconOnly
            label="Delete supplier"
            message={`Delete "${s.name}"?\n\nIf this supplier has any purchase orders, receipts, returns or payments it will be safely deactivated instead of deleted (so your records stay intact).`}
          />
        ),
      },
    ];
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers"
        subtitle="Who you buy from, what you owe them, and their purchase history."
        actions={
          <>
            <LinkButton href="/purchasing/payments/new" variant="secondary">
              <CreditCard size={16} /> Pay Supplier
            </LinkButton>
            <CsvImport
              action={importSuppliersCsv}
              title="Import Suppliers from CSV"
              buttonLabel="Import CSV"
              columnsHelp="Required: name. Optional: company, contact, phone, email, address, pan, paymentTerms, creditPeriod, openingBalance, notes."
              sampleHeader="name,company,phone,email,pan,creditPeriod,openingBalance"
            />
            <LinkButton href="/purchasing/suppliers/new">
              <Plus size={16} /> New Supplier
            </LinkButton>
          </>
        }
      />
      <Flash saved={sp.saved} error={sp.error} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Suppliers" value={String(rows.length)} />
        <StatTile label="Total Payable" value={money(totalPayable)} tone="red" />
        <StatTile label="Total Purchased" value={money(totalPurchased)} tone="blue" />
        <StatTile label="Suppliers Owed" value={String(rows.filter((r) => num(r.outstandingBalance) > 0).length)} tone="amber" />
      </div>

      <DataTable
        title="Supplier List"
        exportName="suppliers"
        columns={[
          { label: "Supplier" },
          { label: "Company" },
          { label: "Phone" },
          { label: "Credit Period" },
          { label: "Receipts", align: "right" },
          { label: "Total Purchased", align: "right", total: true },
          { label: "Outstanding", align: "right", total: true },
          { label: "Status" },
          { label: "", align: "center" },
        ]}
        rows={data}
        emptyMessage="No suppliers yet. Add your first supplier to start purchasing."
      />
    </div>
  );
}
