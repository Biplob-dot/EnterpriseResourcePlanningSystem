"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createBackup, deleteBackup, exportJsonBackup, restoreBackup } from "@/lib/services/backup";

export type BackupState = { error?: string; success?: string };

function friendly(e: unknown, fallback: string): string {
  const msg = e instanceof Error ? e.message : "";
  if (!msg) return fallback;
  if (msg.includes("ENOENT") || msg.includes("spawn")) {
    return "The backup tool is not available on this device, so the JSON export was used instead. Download it and keep it somewhere safe.";
  }
  if (msg.includes("violates") || msg.includes("syntax")) return fallback;
  return msg;
}

export async function runBackup(): Promise<BackupState> {
  try {
    const info = await createBackup();
    revalidatePath("/backup");
    return {
      success:
        info.kind === "pg_dump"
          ? `SQL database backup created: ${info.fileName}`
          : `Portable JSON backup created: ${info.fileName}`,
    };
  } catch (e) {
    return { error: friendly(e, "Unable to create the backup. Please try again.") };
  }
}

export async function runJsonExport(): Promise<BackupState> {
  try {
    const info = await exportJsonBackup();
    revalidatePath("/backup");
    return { success: `Portable JSON backup created: ${info.fileName}` };
  } catch (e) {
    return { error: friendly(e, "Unable to create the JSON backup.") };
  }
}

export async function deleteBackupAction(fd: FormData) {
  const fileName = fd.get("fileName")?.toString();
  if (!fileName) return;
  try {
    await deleteBackup(fileName);
    revalidatePath("/backup");
    redirect(`/backup?saved=${encodeURIComponent(`${fileName} deleted`)}`);
  } catch (e) {
    redirect(`/backup?error=${encodeURIComponent(friendly(e, "Unable to delete the backup file."))}`);
  }
}

export async function restoreBackupAction(_prev: BackupState, fd: FormData): Promise<BackupState> {
  const fileName = fd.get("fileName")?.toString();
  if (!fileName) return { error: "Choose a backup file to restore." };
  if (fd.get("confirm") !== "on") {
    return { error: "Tick the confirmation box to restore. This replaces all current data." };
  }

  try {
    const result = await restoreBackup(fileName);
    revalidatePath("/", "layout");
    revalidatePath("/backup");
    return { success: `${result.message} Reloading your data…` };
  } catch (e) {
    return { error: friendly(e, "Unable to restore. Your current data was left unchanged.") };
  }
}
