import React from "react";
import { PageHeader } from "@/components/ui";
import { getCustomerOptions } from "@/lib/services/sales";
import { ensureSeed } from "@/lib/seed";
import { CustomerPaymentForm } from "../PaymentForm";

export const dynamic = "force-dynamic";

export default async function NewCustomerPaymentPage({ searchParams }: { searchParams: Promise<{ customerId?: string }> }) {
  await ensureSeed();
  const sp = await searchParams;
  const customers = await getCustomerOptions();
  return (
    <div>
      <PageHeader title="Record Customer Payment" subtitle="Money received from a customer. Invoices are settled automatically, oldest first." />
      <CustomerPaymentForm customers={customers} defaultCustomerId={sp.customerId ? Number(sp.customerId) : null} />
    </div>
  );
}
