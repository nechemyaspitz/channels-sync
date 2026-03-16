import { NextResponse } from "next/server";
import { fetchAllCategories } from "@/lib/webflow";
import { verifyAdmin } from "@/lib/auth";

export async function GET(request: Request) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const categories = await fetchAllCategories();
    return NextResponse.json(categories);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to fetch categories",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
