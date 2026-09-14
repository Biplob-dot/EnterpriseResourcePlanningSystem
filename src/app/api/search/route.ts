import { NextResponse } from "next/server";
import { globalSearch } from "@/lib/services/search";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  try {
    const results = await globalSearch(q);
    return NextResponse.json({ query: q, results });
  } catch {
    return NextResponse.json({ query: q, results: [] });
  }
}
