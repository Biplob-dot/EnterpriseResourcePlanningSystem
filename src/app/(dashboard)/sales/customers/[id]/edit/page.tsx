import React from "react";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import { CustomerForm } from "../../CustomerForm";

export const dynamic = "force-dynamic";

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customerId = Number(id);
  if (!Number.isFinite(customerId)) notFound();
  const [customer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
  if (!customer) notFound();
  return (
    <div>
      <PageHeader title={`Edit ${customer.name}`} subtitle="Update customer details and credit settings." />
      <CustomerForm customer={customer} />
    </div>
  );
}
