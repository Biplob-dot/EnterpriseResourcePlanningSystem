import React from "react";
import { PageHeader } from "@/components/ui";
import { getProductOptions } from "@/lib/services/inventory";
import { getCustomerOptions, getOpenSalesOrders } from "@/lib/services/sales";
import { ensureSeed } from "@/lib/seed";
import { DeliveryForm } from "../DeliveryForm";

export const dynamic = "force-dynamic";

export default async function NewDeliveryPage({ searchParams }: { searchParams: Promise<{ soId?: string; customerId?: string }> }) {
  await ensureSeed();
  const sp = await searchParams;
  const [customers, products, openSos] = await Promise.all([getCustomerOptions(), getProductOptions(), getOpenSalesOrders()]);

  return (
    <div>
      <PageHeader title="New Delivery Note" subtitle="Record goods delivered to a customer. Linked to a sales order when available." />
      <DeliveryForm
        customers={customers}
        products={products}
        openSos={openSos as any}
        initialSoId={sp.soId ? Number(sp.soId) : null}
        initialCustomerId={sp.customerId ? Number(sp.customerId) : null}
      />
    </div>
  );
}
