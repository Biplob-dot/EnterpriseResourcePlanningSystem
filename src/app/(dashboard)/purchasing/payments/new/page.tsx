import React from "react";
import { PageHeader } from "@/components/ui";
import { getSupplierOptions } from "@/lib/services/purchasing";
import { ensureSeed } from "@/lib/seed";
import { SupplierPaymentForm } from "../PaymentForm";

export const dynamic = "force-dynamic";

export default async function NewSupplierPaymentPage({ searchParams }: { searchParams: Promise<{ supplierId?: string }> }) {
  await ensureSeed();
  const sp = await searchParams;
  const suppliers = await getSupplierOptions();

  return (
    <div>
      <PageHeader title="Pay Supplier" subtitle="Record money paid to a supplier. Their balance and your cash/bank account update automatically." />
      <SupplierPaymentForm suppliers={suppliers} defaultSupplierId={sp.supplierId ? Number(sp.supplierId) : null} />
    </div>
  );
}
