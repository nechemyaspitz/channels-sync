import { NextResponse } from "next/server";
import { getMapping } from "@/lib/mapping";
import { verifyAdmin } from "@/lib/auth";

export async function GET(request: Request) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mapping = getMapping();
  return NextResponse.json(mapping);
}
