import { NextResponse } from "next/server";
import { getMapping } from "@/lib/mapping";

/**
 * Returns the list of showcase IDs from the mapping.
 * Used by the GitHub Actions sync workflow to know which showcases to sync.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mapping = getMapping();
  const showcases = Object.entries(mapping).map(([id, config]) => ({
    id,
    categoryName: config.categoryName,
  }));

  return NextResponse.json({ showcases });
}
