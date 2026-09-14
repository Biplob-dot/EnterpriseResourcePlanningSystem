import React from "react";
import { PageHeader } from "@/components/ui";
import { ExpenseForm } from "../../FinanceForm";
import { submitIncome } from "../../actions";
import { INCOME_CATEGORIES } from "@/lib/services/finance";

export const dynamic = "force-dynamic";

export default function NewIncomePage() {
  return (
    <div>
      <PageHeader title="New Income" subtitle="Record money received that is not from a customer invoice." />
      <ExpenseForm categories={INCOME_CATEGORIES} incomeCategories={INCOME_CATEGORIES} action={submitIncome} mode="income" />
    </div>
  );
}
