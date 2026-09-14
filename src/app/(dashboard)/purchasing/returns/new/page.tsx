import React from "react";
import { PageHeader } from "@/components/ui";
import { getProductOptions } from "@/lib/services/inventory";
import { getReceiptsForReturn, getSupplierOptions } from "@/lib/services/purchasing";
import { ensureSeed } from "@/lib/seed";
import { ReturnForm } from "../ReturnForm";

export const dynamic = "force-dynamic";

export default async function NewPurchaseReturnPage({ searchParams }: { searchParams: Promise<{ grnId?: string; supplierId?: string }> }) {
  await ensureSeed();
  const sp = await searchParams;
  const [suppliers, products, grns] = await Promise.all([getSupplierOptions(), getProductOptions(true), getReceiptsForReturn()]);

  return (
    <div>
      <PageHeader title="Return to Supplier" subtitle="Send goods back. Stock and the supplier balance are reduced when you confirm." />
      <ReturnForm
        suppliers={suppliers}
        products={products}
        grns={grns}
        initialGrnId={sp.grnId ? Number(sp.grnId) : null}
        initialSupplierId={sp.supplierId ? Number(sp.supplierId) : null}
      />
    </div>
  );
}
