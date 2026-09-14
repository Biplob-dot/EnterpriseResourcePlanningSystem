import React from "react";
import { ShieldCheck } from "lucide-react";
import { Card, PageHeader, StatTile } from "@/components/ui";
import { Flash } from "@/components/ui/Flash";
import { formatBytes, listBackups, BACKUP_DIR } from "@/lib/services/backup";
import { dateTime } from "@/lib/format";
import { ensureSeed } from "@/lib/seed";
import { BackupButtons, DeleteBackupButton, DownloadLink, RestoreForm } from "./BackupButtons";

export const dynamic = "force-dynamic";

export default async function BackupPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  await ensureSeed();
  const sp = await searchParams;
  const backups = await listBackups();
  const latest = backups[0] ?? null;
  const totalSize = backups.reduce((s, b) => s + b.sizeBytes, 0);

  const options = backups.map((b) => ({
    fileName: b.fileName,
    sizeLabel: formatBytes(b.sizeBytes),
    kind: b.kind,
    createdAtLabel: dateTime(b.createdAt),
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Backup & Restore" subtitle="Protect your business data. Backups are stored on this device." />
      <Flash saved={sp.saved} error={sp.error} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatTile label="Last Backup" value={latest ? dateTime(latest.createdAt) : "Never"} tone={latest ? "green" : "red"} />
        <StatTile label="Backup Files" value={String(backups.length)} />
        <StatTile label="Total Size" value={formatBytes(totalSize)} tone="blue" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BackupButtons />
        <RestoreForm backups={options} />
      </div>

      <Card title="Backup Location">
        <div className="p-5 text-sm text-slate-600">
          <p className="font-mono text-xs break-all rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-slate-700">{BACKUP_DIR}</p>
          <p className="mt-3 leading-6">
            For a single-device system the safest routine is: back up at the end of every working day, and download a copy to a USB drive or separate folder at least once a week.
          </p>
        </div>
      </Card>

      <Card title="Available Backups">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-2.5 text-left font-semibold">File</th>
                <th className="px-5 py-2.5 text-left font-semibold">Type</th>
                <th className="px-5 py-2.5 text-right font-semibold">Size</th>
                <th className="px-5 py-2.5 text-left font-semibold">Created</th>
                <th className="px-5 py-2.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {backups.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                    No backups yet. Use “Backup Database Now” to create your first one.
                  </td>
                </tr>
              )}
              {backups.map((b) => (
                <tr key={b.fileName} className="hover:bg-slate-50/70">
                  <td className="px-5 py-2.5 font-mono text-xs text-slate-800">{b.fileName}</td>
                  <td className="px-5 py-2.5">
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${b.kind === "pg_dump" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                      {b.kind === "pg_dump" ? "SQL dump" : "JSON"}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-right">{formatBytes(b.sizeBytes)}</td>
                  <td className="px-5 py-2.5 text-slate-600">{dateTime(b.createdAt)}</td>
                  <td className="px-5 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <DownloadLink fileName={b.fileName}>Download</DownloadLink>
                      <DeleteBackupButton fileName={b.fileName} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-4 text-xs text-slate-500">
        <ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-600" />
        <p>
          SQL dumps can be restored on this device by an administrator. JSON backups are restored directly from this screen. Always create a fresh backup before restoring, so you can return to your current data if needed.
        </p>
      </div>
    </div>
  );
}
