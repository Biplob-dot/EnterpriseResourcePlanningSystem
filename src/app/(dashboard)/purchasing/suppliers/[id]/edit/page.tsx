import React from "react";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { suppliers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import { SupplierForm } from "../../SupplierForm";

export const dynamic = "force-dynamic";

export default async function EditSupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supplierId = Number(id);
  if (!Number.isFinite(supplierId)) notFound();
  const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1);
  if (!supplier) notFound();

  return (
    <div>
      <PageHeader title={`Edit ${supplier.name}`} subtitle="Update supplier contact details and terms." />
      <SupplierForm supplier={supplier} />
    </div>
  );
}
