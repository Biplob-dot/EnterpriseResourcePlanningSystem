import React from "react";
import { PageHeader } from "@/components/ui";
import { SupplierForm } from "../SupplierForm";

export const dynamic = "force-dynamic";

export default function NewSupplierPage() {
  return (
    <div>
      <PageHeader title="New Supplier" subtitle="Add a company or person you purchase from." />
      <SupplierForm />
    </div>
  );
}
