"use client";

import React, { useActionState, useRef, useState } from "react";
import { Upload, X, FileUp, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

type State = { error?: string; success?: string };

export function CsvImport({
  action,
  buttonLabel = "Import CSV",
  title,
  columnsHelp,
  sampleHeader,
}: {
  action: (prev: State, fd: FormData) => Promise<State>;
  buttonLabel?: string;
  title: string;
  columnsHelp: string;
  sampleHeader: string;
}) {
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, formAction, pending] = useActionState<State, FormData>(action, {});

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    setCsv(text);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <FileUp size={16} /> {buttonLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 print:hidden">
          <div className="w-full max-w-xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <h3 className="font-semibold text-slate-800">{title}</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form action={formAction} className="space-y-4 p-5">
              {state.error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" /> {state.error}
                </div>
              )}
              {state.success && (
                <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> {state.success}
                </div>
              )}

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                <p className="font-medium text-slate-700">Expected columns (first row must be the header):</p>
                <p className="mt-1">{columnsHelp}</p>
                <p className="mt-2 font-mono text-[11px] text-slate-500 break-all">{sampleHeader}</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Choose a .csv file</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => onFile(e.target.files?.[0])}
                  className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-white hover:file:bg-blue-700"
                />
                {fileName && <p className="mt-1 text-xs text-slate-500">Loaded: {fileName}</p>}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">…or paste CSV text</label>
                <textarea
                  name="csv"
                  value={csv}
                  onChange={(e) => setCsv(e.target.value)}
                  rows={6}
                  placeholder={sampleHeader}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending || !csv.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {pending ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  {pending ? "Importing..." : "Import"}
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Rows are matched by{" "}
                {title.toLowerCase().includes("product")
                  ? "product code"
                  : title.toLowerCase().includes("customer")
                  ? "customer name"
                  : "supplier name"}{" "}
                — existing records are updated, new ones are added.
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
