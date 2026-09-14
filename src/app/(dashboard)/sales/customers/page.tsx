import React from "react";
import { Plus, CreditCard, UserPlus } from "lucide-react";
import { LinkButton, PageHeader, StatTile, Badge } from "@/components/ui";
import { DataTable, type Cell } from "@/components/ui/DataTable";
import { Flash } from "@/components/ui/Flash";
import { CsvImport } from "@/components/forms/CsvImport";
import { getCustomers } from "@/lib/services/sales";
import { importCustomersCsv } from "../actions";
import { ensureSeed } from "@/lib/seed";
import { money, num } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await ensureSeed();
  const sp = await searchParams;
  const rows = await getCustomers();

  const totalReceivable = rows.reduce((s, r) => s + Math.max(0, num(r.outstandingBalance)), 0);
  const owedCustomers = rows.filter((r) => num(r.outstandingBalance) > 0).length;

  const data: Cell[][] = rows.map((c) => {
    const bal = num(c.outstandingBalance);
    return [
      { text: c.name, href: `/sales/customers/${c.id}`, sort: c.name },
      { text: c.companyName ?? "-", muted: true },
      { text: c.contactPerson ?? "-", muted: true, sort: c.contactPerson ?? "" },
      { text: c.phone ?? "-", muted: true },
      { text: c.address ?? "-", muted: true, sort: c.address ?? "" },
      { text: String(num(c.invoiceCount)), sort: num(c.invoiceCount), muted: true },
      { text: money(c.revenue), sort: num(c.revenue) },
      {
        text: money(bal),
        sort: bal,
        bold: true,
        tone: bal > 0 ? "amber" : bal < 0 ? "blue" : "green",
      },
      { text: c.isActive ? "Active" : "Inactive", tone: c.isActive ? "green" : "slate" },
    ];
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        subtitle="Who you sell to, their credit and outstanding balances."
        actions={
          <>
            <LinkButton href="/sales/payments/new" variant="secondary">
              <CreditCard size={16} /> Record Payment
            </LinkButton>
            <CsvImport
              action={importCustomersCsv}
              title="Import Customers from CSV"
              buttonLabel="Import CSV"
              columnsHelp="Required: name. Optional: company, contact, phone, email, address, pan, openingBalance, notes."
              sampleHeader="name,company,contact,phone,email,address,pan,openingBalance"
            />
            <LinkButton href="/sales/customers/new">
              <UserPlus size={16} /> New Customer
            </LinkButton>
          </>
        }
      />
      <Flash saved={sp.saved} error={sp.error} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Customers" value={String(rows.length)} />
        <StatTile label="Total Receivable" value={money(totalReceivable)} tone="amber" />
        <StatTile label="Customers Owing" value={String(owedCustomers)} tone="blue" />
        <StatTile label="Active" value={String(rows.filter((r) => r.isActive).length)} />
      </div>

      <DataTable
        title="Customer List"
        exportName="customers"
        columns={[
          { label: "Customer" },
          { label: "Company" },
          { label: "Contact Person" },
          { label: "Phone" },
          { label: "Address" },
          { label: "Invoices", align: "right" },
          { label: "Revenue", align: "right", total: true },
          { label: "Outstanding", align: "right", total: true },
          { label: "Status" },
        ]}
        rows={data}
        emptyMessage="No customers yet. Add your first customer to start selling."
      />
    </div>
  );
}
