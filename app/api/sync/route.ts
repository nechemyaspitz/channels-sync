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

/**
 * GET handler for Vercel Cron Jobs.
 * Vercel crons send GET requests. Verify with CRON_SECRET header.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await runBulkSync();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Cron sync failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
