import { NextResponse } from "next/server";
import { fetchAllShowcases } from "@/lib/vimeo";
import { verifyAdmin } from "@/lib/auth";

export async function GET(request: Request) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const showcases = await fetchAllShowcases();
    return NextResponse.json(showcases);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to fetch showcases",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
