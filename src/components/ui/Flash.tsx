import React from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export function Flash({ saved, error }: { saved?: string; error?: string }) {
  if (!saved && !error) return null;
  return (
    <div className="mb-4 space-y-2 print:hidden">
      {saved && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          <CheckCircle2 size={16} /> {saved}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          <AlertCircle size={16} /> {error}
        </div>
      )}
    </div>
  );
}

export function ConfirmSubmit({
  label,
  className = "",
  message,
}: {
  label: string;
  className?: string;
  message?: string;
}) {
  return (
    <button
      type="submit"
      formNoValidate
      className={className || "text-xs text-red-600 hover:underline"}
      // eslint-disable-next-line react/no-unknown-property
      data-confirm={message}
    >
      {label}
    </button>
  );
}
