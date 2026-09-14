"use client";

import React from "react";
import { Power } from "lucide-react";
import { toggleProductActive } from "../actions";

export function ToggleActive({ id, isActive }: { id: number; isActive: boolean }) {
  return (
    <form
      action={toggleProductActive}
      onSubmit={(e) => {
        if (
          !confirm(
            isActive
              ? "Deactivate this product? It will stay in reports but will not appear in new sales."
              : "Activate this product again?"
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <Power size={16} /> {isActive ? "Deactivate" : "Activate"}
      </button>
    </form>
  );
}
