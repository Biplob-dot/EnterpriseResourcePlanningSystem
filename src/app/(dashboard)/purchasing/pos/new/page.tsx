import React from "react";
import { PageHeader } from "@/components/ui";
import { getProductOptions } from "@/lib/services/inventory";
import { getSupplierOptions } from "@/lib/services/purchasing";
import { ensureSeed } from "@/lib/seed";
import { PoForm } from "../PoForm";

export const dynamic = "force-dynamic";

export default async function NewPurchaseOrderPage({ searchParams }: { searchParams: Promise<{ supplierId?: string }> }) {
  await ensureSeed();
  const sp = await searchParams;
  const [suppliers, products] = await Promise.all([getSupplierOptions(), getProductOptions()]);

  return (
    <div>
      <PageHeader title="New Purchase Order" subtitle="Tell the supplier what you want to buy. Stock is added later when goods are received." />
      <PoForm suppliers={suppliers} products={products} defaultSupplierId={sp.supplierId ? Number(sp.supplierId) : null} />
    </div>
  );
}
