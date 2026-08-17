import { NextResponse } from "next/server";
import { findRawPropertyById } from "@/data/normalize";

interface UpdatePropertyBody {
  id?: unknown;
  value?: unknown;
  income?: unknown;
}

// A plain decimal amount. Deliberately narrower than Number(): that accepts "  " as 0,
// "0x1f" as 31 and "1e3" as 1000, none of which a user typed into a money field.
const DECIMAL_AMOUNT = /^\d+(\.\d+)?$/;

// Parses one optional numeric field. Returns undefined when the field is absent, null when
// it is present but isn't a usable amount (so callers can tell "not sent" from "sent as
// garbage"). Negatives are rejected: neither a property value nor a monthly income can be
// below zero, and silently storing one corrupts every aggregate downstream.
function parseOptionalAmount(raw: unknown): number | undefined | null {
  if (raw === undefined || raw === null) return undefined;

  if (typeof raw === "number") {
    return Number.isFinite(raw) && raw >= 0 ? raw : null;
  }

  if (typeof raw !== "string") return null;

  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (!DECIMAL_AMOUNT.test(trimmed)) return null;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function PATCH(request: Request) {
  if (Math.random() < 0.1) {
    return new NextResponse("server error", { status: 500 });
  }

  let body: UpdatePropertyBody;
  try {
    body = (await request.json()) as UpdatePropertyBody;
  } catch {
    return NextResponse.json({ ok: false, reason: "malformed request body" }, { status: 400 });
  }

  if (typeof body?.id !== "string" || body.id === "") {
    return NextResponse.json({ ok: false, reason: "missing id" }, { status: 400 });
  }

  const value = parseOptionalAmount(body.value);
  if (value === null) {
    return NextResponse.json({ ok: false, reason: "invalid value" }, { status: 400 });
  }

  const income = parseOptionalAmount(body.income);
  if (income === null) {
    return NextResponse.json({ ok: false, reason: "invalid income" }, { status: 400 });
  }

  if (value === undefined && income === undefined) {
    return NextResponse.json({ ok: false, reason: "nothing to update" }, { status: 400 });
  }

  const prop = findRawPropertyById(body.id);
  if (!prop) {
    return NextResponse.json({ ok: false, reason: "not found" }, { status: 404 });
  }

  // NOTE: mutates the in-memory RAW_PROPERTIES module singleton. Fine for this mock
  // "database"; a real deployment needs a store that survives restarts and is not
  // per-instance. Writes here are intentionally the only path that mutates raw rows.
  if (value !== undefined) prop.currentValue = value;
  if (income !== undefined) prop.monthlyIncomeOverride = income;

  return NextResponse.json({ ok: true, updated_at: Date.now() });
}
