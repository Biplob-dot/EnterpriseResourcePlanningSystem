import React from "react";
import { PageHeader } from "@/components/ui";
import { CustomerForm } from "../CustomerForm";

export default function NewCustomerPage() {
  return (
    <div>
      <PageHeader title="New Customer" subtitle="Add a person or business you sell to." />
      <CustomerForm />
    </div>
  );
}
