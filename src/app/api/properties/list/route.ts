import { NextResponse } from "next/server";
import { getActiveProperties } from "@/data/normalize";
import { shouldInjectFailure } from "@/lib/chaos";

export async function GET() {
  if (shouldInjectFailure(0.1)) {
    return new NextResponse("Internal Server Error", { status: 500 });
  }

  return NextResponse.json({ items: getActiveProperties() });
}
