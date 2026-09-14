"use client";

import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function ErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="max-w-xl mx-auto mt-16 rounded-xl border border-red-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 inline-flex rounded-full bg-red-100 p-3 text-red-600">
        <AlertTriangle size={22} />
      </div>
      <h1 className="text-lg font-bold text-slate-900">Something went wrong</h1>
      <p className="mt-2 text-sm text-slate-600">
        The action could not be completed. Nothing was saved, so your data is safe. Please try again.
      </p>
      <p className="mt-3 text-xs text-slate-400 break-words">{error.message}</p>
      <button
        onClick={reset}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        <RotateCcw size={16} /> Try again
      </button>
    </div>
  );
}
