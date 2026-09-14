"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseDateInput } from "@/lib/calc";
import { createExpense, createIncome, createBankAccount, bankTransfer, toggleReconciled, voidExpense } from "@/lib/services/finance";

export type FormState = { error?: string; success?: string };

const str = (fd: FormData, k: string) => (fd.get(k)?.toString() ?? "").trim();
const numOrNull = (fd: FormData, k: string) => {
  const v = str(fd, k);
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
function friendly(e: unknown, fallback: string): string {
  const msg = e instanceof Error ? e.message : "";
  if (!msg || msg.includes("violates") || msg.includes("syntax")) return fallback;
  return msg;
}

export async function submitExpense(_prev: FormState, fd: FormData): Promise<FormState> {
  const amount = numOrNull(fd, "amount");
  if (!amount || amount <= 0) return { error: "Enter an amount greater than zero." };
  try {
    await createExpense({
      date: parseDateInput(str(fd, "date"))!,
      category: str(fd, "category"),
      amount,
      method: str(fd, "method") || "Cash",
      description: str(fd, "description") || null,
    });
  } catch (e) {
    return { error: friendly(e, "Unable to record the expense. Nothing was saved.") };
  }
  revalidatePath("/accounting/expenses");
  redirect("/accounting/expenses?saved=Expense+recorded");
}

export async function voidExpenseAction(fd: FormData) {
  const id = Number(fd.get("id"));
  try {
    await voidExpense(id);
  } catch (e) {
    redirect(`/accounting/expenses?saved=${encodeURIComponent(friendly(e, "Unable to reverse the expense."))}`);
  }
  revalidatePath("/accounting/expenses");
  redirect("/accounting/expenses?saved=Expense+reversed");
}

export async function submitIncome(_prev: FormState, fd: FormData): Promise<FormState> {
  const amount = numOrNull(fd, "amount");
  if (!amount || amount <= 0) return { error: "Enter an amount greater than zero." };
  try {
    await createIncome({
      date: parseDateInput(str(fd, "date"))!,
      category: str(fd, "category"),
      amount,
      method: str(fd, "method") || "Cash",
      description: str(fd, "description") || null,
    });
  } catch (e) {
    return { error: friendly(e, "Unable to record the income. Nothing was saved.") };
  }
  revalidatePath("/accounting/income");
  redirect("/accounting/income?saved=Income+recorded");
}

export async function submitBankAccount(_prev: FormState, fd: FormData): Promise<FormState> {
  const name = str(fd, "name");
  if (!name) return { error: "Account name is required." };
  try {
    await createBankAccount({
      name,
      type: (str(fd, "type") as "CASH" | "BANK") || "CASH",
      bankName: str(fd, "bankName") || null,
      accountNumber: str(fd, "accountNumber") || null,
      openingBalance: numOrNull(fd, "openingBalance") ?? 0,
    });
  } catch (e) {
    return { error: friendly(e, "Unable to create the account.") };
  }
  revalidatePath("/accounting/bank");
  redirect("/accounting/bank?saved=Account+created");
}

export async function submitTransfer(_prev: FormState, fd: FormData): Promise<FormState> {
  const from = numOrNull(fd, "fromAccountId");
  const to = numOrNull(fd, "toAccountId");
  const amount = numOrNull(fd, "amount");
  if (!from || !to) return { error: "Choose both accounts." };
  if (!amount || amount <= 0) return { error: "Enter an amount greater than zero." };
  try {
    await bankTransfer({
      fromAccountId: from,
      toAccountId: to,
      amount,
      date: parseDateInput(str(fd, "date"))!,
      reference: str(fd, "reference") || null,
    });
  } catch (e) {
    return { error: friendly(e, "Unable to complete the transfer.") };
  }
  revalidatePath("/accounting/bank");
  redirect("/accounting/bank?saved=Transfer+completed");
}

export async function reconcileAction(fd: FormData) {
  const id = Number(fd.get("id"));
  const value = str(fd, "value") === "true";
  await toggleReconciled(id, value);
  revalidatePath("/accounting/bank");
}
