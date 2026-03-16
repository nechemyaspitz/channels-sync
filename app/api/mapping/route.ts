import { NextResponse } from "next/server";
import { getMapping, saveMapping } from "@/lib/mapping";
import { verifyAdmin } from "@/lib/auth";

export async function GET(request: Request) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mapping = getMapping();
  return NextResponse.json(mapping);
}

export async function PUT(request: Request) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const mapping = await request.json();
    saveMapping(mapping);
    return NextResponse.json({ success: true, mapping });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to save mapping",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
