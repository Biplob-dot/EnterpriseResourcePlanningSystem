import React from "react";
import { PageHeader } from "@/components/ui";
import { LineDocForm } from "@/components/forms/LineDocForm";
import { getProductOptions, type ProductOption } from "@/lib/services/inventory";
import { getCustomerOptions } from "@/lib/services/sales";
import { ensureSeed } from "@/lib/seed";
import { saveQuotation } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewQuotationPage({ searchParams }: { searchParams: Promise<{ customerId?: string }> }) {
  await ensureSeed();
  const sp = await searchParams;
  const [parties, products] = await Promise.all([getCustomerOptions(), getProductOptions()]);

  return (
    <div>
      <PageHeader title="New Quotation" subtitle="Prepare a quote for a customer. It can be converted to a sales order or invoice later." />
      <LineDocForm
        action={saveQuotation}
        parties={parties}
        products={products as ProductOption[]}
        title="Quotation Details"
        subtitle=""
        defaultPartyId={sp.customerId ? Number(sp.customerId) : null}
        listHref="/sales/quotations"
      />
    </div>
  );
}
