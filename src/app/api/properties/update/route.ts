import { NextResponse } from "next/server";
import { findRawPropertyById } from "@/data/normalize";

interface UpdatePropertyBody {
  id: string;
  value?: string | number;
  income?: string | number;
}

export async function PATCH(request: Request) {
  if (Math.random() < 0.1) {
    return new NextResponse("server error", { status: 500 });
  }

  const body = (await request.json()) as UpdatePropertyBody;

  const prop = findRawPropertyById(body.id);

  if (!prop) {
    return NextResponse.json({ ok: false, reason: "not found" });
  }

  if (body.value !== undefined) {
    const value = Number(body.value);
    if (!Number.isFinite(value)) {
      return NextResponse.json({ ok: false, reason: "invalid value" }, { status: 400 });
    }
    prop.currentValue = value;
  }
  if (body.income !== undefined) {
    const income = Number(body.income);
    if (!Number.isFinite(income)) {
      return NextResponse.json({ ok: false, reason: "invalid income" }, { status: 400 });
    }
    prop.monthlyIncomeOverride = income;
  }

  return NextResponse.json({ ok: true, updated_at: Date.now() });
}
