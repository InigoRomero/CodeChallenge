import { NextResponse } from "next/server";
import { RAW_PROPERTIES } from "@/data/mockProperties";

export async function PATCH(request: Request) {
  await new Promise((r) => setTimeout(r, 400));

  if (Math.random() < 0.1) {
    return new NextResponse("server error", { status: 500 });
  }

  const body = await request.json();

  const prop = RAW_PROPERTIES.find((p) => p.id === body.id);

  if (!prop) {
    return NextResponse.json({ ok: false, reason: "not found" });
  }

  if (body.value !== undefined) {
    prop.currentValue = body.value;
  }
  if (body.income !== undefined) {
    prop.currentValue = body.income;
  }

  return NextResponse.json({ ok: true, updated_at: Date.now() });
}
