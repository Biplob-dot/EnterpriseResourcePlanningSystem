import React from "react";
import { PageHeader } from "@/components/ui";
import { ExpenseForm } from "../../FinanceForm";
import { submitExpense } from "../../actions";
import { EXPENSE_CATEGORIES } from "@/lib/services/finance";

export const dynamic = "force-dynamic";

export default function NewExpensePage() {
  return (
    <div>
      <PageHeader title="New Expense" subtitle="Record rent, utilities, salaries, transport and other operating costs." />
      <ExpenseForm categories={EXPENSE_CATEGORIES} action={submitExpense} mode="expense" />
    </div>
  );
}
