import { NextResponse } from "next/server";
import { runBulkSync } from "@/lib/sync";
import { verifyAdmin } from "@/lib/auth";

export const maxDuration = 60;

export async function POST(request: Request) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const showcaseId = body.showcaseId as string | undefined;

    const result = await runBulkSync(showcaseId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Sync failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
