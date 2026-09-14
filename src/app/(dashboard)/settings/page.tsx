import React from "react";
import { db } from "@/db";
import { settings, units, warehouses, auditLogs } from "@/db/schema";
import { desc } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import { DataTable, type Cell } from "@/components/ui/DataTable";
import { SettingsForms } from "./SettingsForms";
import { DangerZone } from "./DangerZone";
import { ensureSeed } from "@/lib/seed";
import { dateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await ensureSeed();
  const [config, unitRows, warehouseRows, logs] = await Promise.all([
    db.select().from(settings).limit(1),
    db.select().from(units).orderBy(units.name),
    db.select().from(warehouses).orderBy(warehouses.name),
    db.select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(50),
  ]);

  const rows: Cell[][] = logs.map((l) => [
    { text: dateTime(l.createdAt), sort: l.createdAt ? new Date(l.createdAt).getTime() : 0 },
    { text: l.action.replace(/_/g, " "), tone: l.action.includes("VOID") || l.action.includes("CANCEL") ? "red" : "blue" },
    { text: l.tableName ?? "-", muted: true },
    { text: l.previousValue ?? "-", muted: true },
    { text: l.newValue ?? "-", sort: l.newValue ?? "" },
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Business details, invoice defaults, inventory defaults, tax and currency." />
      <SettingsForms settings={config[0] ?? null} units={unitRows} warehouses={warehouseRows} />

      <DangerZone />

      <DataTable
        title="Audit History"
        exportName="audit-history"
        pageSize={20}
        columns={[{ label: "Date & Time" }, { label: "Action" }, { label: "Record" }, { label: "Previous Value" }, { label: "New Value" }]}
        rows={rows}
        emptyMessage="No recorded changes yet."
      />
      <p className="text-xs text-slate-500">
        Important changes such as stock adjustments, price changes, cancelled invoices and voided payments are recorded here automatically.
      </p>
    </div>
  );
}
