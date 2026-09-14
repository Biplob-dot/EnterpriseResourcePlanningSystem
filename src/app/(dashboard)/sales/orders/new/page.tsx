import React from "react";
import { PageHeader } from "@/components/ui";
import { LineDocForm } from "@/components/forms/LineDocForm";
import { getProductOptions, type ProductOption } from "@/lib/services/inventory";
import { getCustomerOptions } from "@/lib/services/sales";
import { ensureSeed } from "@/lib/seed";
import { saveSalesOrder } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewSalesOrderPage({ searchParams }: { searchParams: Promise<{ customerId?: string; quoteId?: string }> }) {
  await ensureSeed();
  const sp = await searchParams;
  const [parties, products] = await Promise.all([getCustomerOptions(), getProductOptions()]);

  return (
    <div>
      <PageHeader title="New Sales Order" subtitle="Confirm an order from a customer. Deliveries are tracked separately." />
      <LineDocForm
        action={saveSalesOrder}
        parties={parties}
        products={products as ProductOption[]}
        title="Sales Order Details"
        subtitle=""
        defaultPartyId={sp.customerId ? Number(sp.customerId) : null}
        listHref="/sales/orders"
        showDeliveryDate
      />
    </div>
  );
}
