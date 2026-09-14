import React from "react";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getProductOptions } from "@/lib/services/inventory";
import { getPurchaseOrder, getSupplierOptions } from "@/lib/services/purchasing";
import { toDateInput } from "@/lib/calc";
import { num } from "@/lib/format";
import { PoForm } from "../../PoForm";

export const dynamic = "force-dynamic";

export default async function EditPurchaseOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const poId = Number(id);
  if (!Number.isFinite(poId)) notFound();
  const po = await getPurchaseOrder(poId);
  if (!po) notFound();
  if (po.status !== "DRAFT") redirect(`/purchasing/pos/${poId}?error=Only+draft+orders+can+be+edited`);

  const [suppliers, products] = await Promise.all([getSupplierOptions(), getProductOptions(true)]);
  const productById = new Map(products.map((p) => [p.id, p]));

  return (
    <div>
      <PageHeader title={`Edit ${po.poNumber}`} subtitle="Draft order — change anything before sending it to the supplier." />
      <PoForm
        suppliers={suppliers}
        products={products.filter((p) => p.stock >= 0)}
        initial={{
          id: po.id,
          supplierId: po.supplierId,
          date: toDateInput(po.date),
          expectedDeliveryDate: toDateInput(po.expectedDeliveryDate),
          notes: po.notes ?? "",
          items: po.items.map((i) => ({
            key: `po-${i.id}`,
            productId: i.productId!,
            code: i.code ?? "",
            name: i.name ?? "",
            unit: i.unit ?? "",
            unitId: i.unitId,
            stock: productById.get(i.productId!)?.stock ?? 0,
            quantity: String(num(i.quantity)),
            unitPrice: String(num(i.unitPrice)),
            discount: String(num(i.discount)),
            taxRate: String(num(i.taxRate)),
          })),
        }}
      />
    </div>
  );
}
