import React from "react";
import { db } from "@/db";
import { warehouses } from "@/db/schema";
import { PageHeader } from "@/components/ui";
import { getBinOptions, getProductOptions } from "@/lib/services/inventory";
import { getOpenPurchaseOrders, getSupplierOptions } from "@/lib/services/purchasing";
import { ensureSeed } from "@/lib/seed";
import { GrnForm } from "../GrnForm";

export const dynamic = "force-dynamic";

export default async function NewGrnPage({ searchParams }: { searchParams: Promise<{ poId?: string; supplierId?: string }> }) {
  await ensureSeed();
  const sp = await searchParams;
  const [suppliers, products, whs, bins, openPos] = await Promise.all([
    getSupplierOptions(),
    getProductOptions(),
    db.select({ id: warehouses.id, name: warehouses.name }).from(warehouses),
    getBinOptions(),
    getOpenPurchaseOrders(),
  ]);

  return (
    <div>
      <PageHeader title="Receive Goods" subtitle="Record what the supplier delivered. Stock and the supplier balance update the moment you confirm." />
      <GrnForm
        suppliers={suppliers}
        products={products}
        warehouses={whs}
        bins={bins}
        openPos={openPos}
        initialPoId={sp.poId ? Number(sp.poId) : null}
        initialSupplierId={sp.supplierId ? Number(sp.supplierId) : null}
      />
    </div>
  );
}
