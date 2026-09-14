import React from "react";
import { PageHeader } from "@/components/ui";
import { getProductOptions, type ProductOption } from "@/lib/services/inventory";
import { getCustomerOptions } from "@/lib/services/sales";
import { ensureSeed } from "@/lib/seed";
import { InvoiceForm } from "../InvoiceForm";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ customerId?: string }> }) {
  await ensureSeed();
  const sp = await searchParams;
  const [customers, products] = await Promise.all([getCustomerOptions(), getProductOptions()]);

  return (
    <div>
      <PageHeader title="New Sale / Invoice" subtitle="Fast single-screen billing. Stock and customer balance update the moment you save." />
      <InvoiceForm customers={customers} products={products as ProductOption[]} defaultCustomerId={sp.customerId ? Number(sp.customerId) : null} />
    </div>
  );
}
