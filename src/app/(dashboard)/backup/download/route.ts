import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { getBackup } from "@/lib/services/backup";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fileName = url.searchParams.get("file");
  if (!fileName) return new NextResponse("Missing file", { status: 400 });

  const backup = await getBackup(fileName);
  if (!backup) return new NextResponse("Backup not found", { status: 404 });

  try {
    const data = await readFile(backup.filePath);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": backup.kind === "pg_dump" ? "application/octet-stream" : "application/json",
        "Content-Disposition": `attachment; filename="${backup.fileName}"`,
        "Content-Length": String(backup.sizeBytes),
      },
    });
  } catch {
    return new NextResponse("Unable to read backup", { status: 500 });
  }
}
