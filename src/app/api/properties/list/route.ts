import { NextResponse } from "next/server";
import { getActiveProperties } from "@/data/normalize";

export async function GET() {
  // sometimes fail - different error format than portfolio API
  if (Math.random() < 0.1) {
    return new NextResponse("Internal Server Error", { status: 500 });
  }

  return NextResponse.json({ items: getActiveProperties() });
}
