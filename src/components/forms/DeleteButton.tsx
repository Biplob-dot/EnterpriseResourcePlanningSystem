"use client";

import React from "react";
import { Trash2 } from "lucide-react";

export function DeleteButton({
  action,
  id,
  message,
  label = "Delete",
  iconOnly = false,
}: {
  action: (fd: FormData) => void | Promise<void>;
  id: number;
  message: string;
  label?: string;
  iconOnly?: boolean;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className={
          iconOnly
            ? "text-slate-400 hover:text-red-600"
            : "inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
        }
        title={label}
      >
        <Trash2 size={iconOnly ? 15 : 16} />
        {!iconOnly && label}
      </button>
    </form>
  );
}
