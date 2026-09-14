import React from "react";
import { Sidebar } from "@/components/shared/Sidebar";
import { GlobalSearch } from "@/components/shared/GlobalSearch";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await ensureSeed();
  const [config] = await db.select().from(settings).limit(1);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 print:hidden">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">
              {config?.businessName ?? "Plywood Warehouse ERP"}
            </h2>
            <p className="text-[11px] text-slate-500">{config?.address ?? "Local single-device system"}</p>
          </div>
          <div className="flex-1 flex justify-center px-6 max-w-2xl">
            <GlobalSearch />
          </div>
          <div className="flex items-center gap-4">
            <div className="text-xs text-slate-500">
              {new Date().toLocaleDateString("en-GB", {
                weekday: "short",
                year: "numeric",
                month: "short",
                day: "2-digit",
              })}
            </div>
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-[11px] font-bold">
              {(config?.businessName ?? "PE").slice(0, 2).toUpperCase()}
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-6 print:overflow-visible print:p-0">{children}</div>
      </main>
    </div>
  );
}
