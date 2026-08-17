import { NextResponse } from "next/server";
import { getActiveProperties } from "@/data/normalize";

export async function GET() {
  return NextResponse.json({ items: getActiveProperties() });
}
