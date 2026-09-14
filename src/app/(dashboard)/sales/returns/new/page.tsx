import React from "react";
import { PageHeader } from "@/components/ui";
import { getProductOptions } from "@/lib/services/inventory";
import { getCustomerOptions } from "@/lib/services/sales";
import { ensureSeed } from "@/lib/seed";
import { SalesReturnForm as ReturnForm } from "../ReturnForm";

export const dynamic = "force-dynamic";

export default async function NewSalesReturnPage() {
  await ensureSeed();
  const [customers, products] = await Promise.all([getCustomerOptions(), getProductOptions(true)]);
  return (
    <div>
      <PageHeader title="Return from Customer" subtitle="Record goods a customer sends back. Stock and their balance update on save." />
      <ReturnForm customers={customers} products={products} />
    </div>
  );
}
