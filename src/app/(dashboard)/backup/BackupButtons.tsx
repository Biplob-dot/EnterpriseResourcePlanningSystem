"use client";

import React, { useTransition, useActionState } from "react";
import { Download, Trash2, Upload, Database, FileJson, Loader2, AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react";
import { Card, inputClass } from "@/components/ui";
import { deleteBackupAction, restoreBackupAction, runBackup, runJsonExport, type BackupState } from "./actions";

export function BackupButtons() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = React.useState<BackupState>({});

  const doBackup = () =>
    startTransition(async () => {
      setResult(await runBackup());
    });

  const doJson = () =>
    startTransition(async () => {
      setResult(await runJsonExport());
    });

  return (
    <Card title="Create Backup">
      <div className="space-y-3 p-5">
        {result.error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle size={15} className="mt-0.5" /> {result.error}
          </div>
        )}
        {result.success && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <CheckCircle2 size={15} className="mt-0.5" /> {result.success}
          </div>
        )}

        <button
          type="button"
          onClick={doBackup}
          disabled={pending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
          Backup Database Now
        </button>

        <button
          type="button"
          onClick={doJson}
          disabled={pending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <FileJson size={16} /> Create Portable JSON Backup
        </button>

        <p className="text-xs leading-5 text-slate-500">
          The SQL backup is a full PostgreSQL dump for restoring on this device. The JSON backup is portable and can be restored from this screen. Keep copies on a USB drive or separate folder.
        </p>
      </div>
    </Card>
  );
}

export function RestoreForm({
  backups,
}: {
  backups: { fileName: string; sizeLabel: string; kind: string; createdAtLabel: string }[];
}) {
  const [state, formAction, pending] = useActionState<BackupState, FormData>(restoreBackupAction, {});

  return (
    <Card title="Restore Backup">
      <form action={formAction} className="space-y-3 p-5">
        {state.error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle size={15} className="mt-0.5" /> {state.error}
          </div>
        )}
        {state.success && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <CheckCircle2 size={15} className="mt-0.5" /> {state.success}
          </div>
        )}

        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <ShieldAlert size={15} className="mt-0.5 shrink-0" />
          <span>Restoring replaces all current data with the contents of the chosen backup file. This cannot be undone.</span>
        </div>

        <select name="fileName" className={inputClass} defaultValue="" required>
          <option value="">Choose a backup file…</option>
          {backups.map((b) => (
            <option key={b.fileName} value={b.fileName}>
              {b.fileName} • {b.sizeLabel} • {b.createdAtLabel}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="confirm" className="rounded border-slate-300" required />I understand this will replace all current data
        </label>

        <button
          type="submit"
          disabled={pending || backups.length === 0}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
        >
          <Upload size={16} /> {pending ? "Restoring..." : "Restore Backup"}
        </button>
      </form>
    </Card>
  );
}

export function DeleteBackupButton({ fileName }: { fileName: string }) {
  return (
    <form action={deleteBackupAction}>
      <input type="hidden" name="fileName" value={fileName} />
      <button className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline" title="Delete this backup file">
        <Trash2 size={13} /> Delete
      </button>
    </form>
  );
}

export function DownloadLink({ fileName, children }: { fileName: string; children: React.ReactNode }) {
  return (
    <a
      href={`/backup/download?file=${encodeURIComponent(fileName)}`}
      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
    >
      <Download size={13} /> {children}
    </a>
  );
}
