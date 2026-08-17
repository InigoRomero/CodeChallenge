"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { PropertyDetail } from "@/types/property";
import { formatMoney, formatPercent } from "@/lib/format";
import { useDisplayPreferences } from "@/lib/displayPreferences";
import { calculateNetCashflow, calculateRoi } from "@/lib/metrics";

type DetailStatus = "loading" | "not_found" | "error" | "ready";

export default function PropertyDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { showCents } = useDisplayPreferences();
  const [detail, setDetail] = useState<PropertyDetail | null>(null);
  const [detailStatus, setDetailStatus] = useState<DetailStatus>("loading");
  const [editValue, setEditValue] = useState("");
  const [editIncome, setEditIncome] = useState("");
  const [saveStatus, setSaveStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // useParams types catch-all segments as string[]; this route is a single [id] segment.
  const propertyId = Array.isArray(params.id) ? params.id[0] : params.id;

  useEffect(() => {
    let ignore = false;
    setDetailStatus("loading");

    fetch(`/api/property-details?property_id=${encodeURIComponent(propertyId)}`)
      .then(async (res) => {
        // A missing id is "not found", not "something broke".
        if (res.status === 404) return { property: null };
        if (!res.ok) throw new Error("property-details request failed");
        return res.json();
      })
      .then((data) => {
        if (ignore) return;
        if (!data.property) {
          setDetail(null);
          setDetailStatus("not_found");
        } else {
          setDetail(data.property);
          setDetailStatus("ready");
        }
      })
      .catch(() => {
        if (ignore) return;
        // Drop the stale copy: last-known figures next to an error panel, and after a failed
        // post-save refetch next to a green "Saved.", contradict each other.
        setDetail(null);
        setDetailStatus("error");
      });

    return () => {
      ignore = true;
    };
  }, [propertyId, reloadToken]);

  const handleSave = useCallback(async () => {
    setSaveStatus(null);

    const updates: { id: string; value?: string; income?: string } = { id: propertyId };
    if (editValue) updates.value = editValue;
    if (editIncome) updates.income = editIncome;

    if (updates.value === undefined && updates.income === undefined) {
      setSaveStatus({ ok: false, message: "Nothing to save - fill in a field first." });
      return;
    }

    try {
      const res = await fetch("/api/properties/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const body = await res.json().catch(() => null);

      if (res.ok && body?.ok) {
        setSaveStatus({ ok: true, message: "Saved." });
        setEditValue("");
        setEditIncome("");
        // Pull the server's version back so the figures can't disagree with the database.
        setReloadToken((t) => t + 1);
      } else {
        setSaveStatus({ ok: false, message: body?.reason ?? "Could not save." });
      }
    } catch {
      setSaveStatus({ ok: false, message: "Could not save." });
    }
  }, [propertyId, editValue, editIncome]);

  const cashflow = calculateNetCashflow(detail?.monthlyIncome ?? 0, detail?.monthlyExpenses ?? 0);
  const purchasePrice = detail?.purchasePrice ?? 0;
  const currentValue = detail?.currentValue ?? purchasePrice;

  const roi = calculateRoi(currentValue, purchasePrice);
  const cashOnCash = detail?.downPayment ? ((cashflow * 12) / detail.downPayment) * 100 : null;

  // Cents are a display preference and follow the user across routes. The currency is not:
  // every figure here belongs to one property and is drawn in that property's own, so a EUR
  // property is never rendered in dollars because home happens to be set to them.
  const money = (amount: number | null | undefined) =>
    formatMoney(amount, { currency: detail?.currency ?? "USD", showCents });

  const rows = [
    { label: "Purchase Price", value: purchasePrice },
    { label: "Current Value", value: currentValue },
    { label: "Monthly Income", value: detail?.monthlyIncome },
    { label: "Monthly Expenses", value: detail?.monthlyExpenses },
  ];

  const trendDirection = detail?.stats?.trend.direction ?? null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-4">
          <button
            onClick={() => router.back()}
            className="text-sm font-medium text-zinc-600 transition hover:text-zinc-900"
          >
            ← Back to portfolio
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-zinc-900">
            {detailStatus === "not_found"
              ? "Property not found"
              : detailStatus === "error"
                ? "Couldn't load this property"
                : detail?.name || "Loading property..."}
          </h1>
          {detail && (
            <>
              <p className="mt-1 text-sm text-zinc-500">{detail.address}</p>
              <p className="mt-1 text-sm text-zinc-400">Owner: {detail.ownerName}</p>
              <p className="mt-1 text-xs text-zinc-400">
                12mo trend:{" "}
                {trendDirection === "up" ? "↑" : trendDirection === "down" ? "↓" : "N/A"}
              </p>
            </>
          )}
        </div>

        {detailStatus === "not_found" && (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
            There&apos;s no property with id &quot;{String(propertyId)}&quot;.{" "}
            <button
              onClick={() => router.push("/")}
              className="font-medium text-blue-600 underline underline-offset-2"
            >
              Back to portfolio
            </button>
          </div>
        )}

        {detailStatus === "error" && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">
            Something went wrong loading this property. Try reloading the page.
          </div>
        )}

        {detailStatus === "loading" && !detail && (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-400">
            Loading...
          </div>
        )}

        {detail && (
          <>
            <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-100 px-6 py-4">
                <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-400">
                  Financial Overview
                </h2>
              </div>

              <div className="divide-y divide-zinc-100">
                {rows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between px-6 py-4 text-sm"
                  >
                    <span className="text-zinc-500">{row.label}</span>
                    <span className="font-medium text-zinc-900">{money(row.value)}</span>
                  </div>
                ))}

                <div className="flex items-center justify-between bg-zinc-50 px-6 py-4 text-sm">
                  <span className="font-medium text-zinc-700">Net Cashflow</span>
                  <span
                    className={
                      "font-semibold " +
                      (cashflow < 0 ? "text-red-600" : "text-emerald-600")
                    }
                  >
                    {money(cashflow)}
                  </span>
                </div>
                <div className="flex items-center justify-between px-6 py-4 text-sm">
                  <span className="text-zinc-500">ROI</span>
                  <span className="font-medium text-zinc-900">{formatPercent(roi)}</span>
                </div>
                <div className="flex items-center justify-between px-6 py-4 text-sm">
                  <span className="text-zinc-500">Cash-on-Cash Return</span>
                  <span className="font-medium text-zinc-900">{formatPercent(cashOnCash)}</span>
                </div>
              </div>
            </section>

            <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-400">
                Quick Edit
              </h2>

              <div className="space-y-3">
                <div>
                  <label htmlFor="edit-value" className="text-xs text-zinc-500">
                    Current Value
                  </label>
                  <input
                    id="edit-value"
                    type="number"
                    inputMode="decimal"
                    placeholder="e.g. 250000"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="edit-income" className="text-xs text-zinc-500">
                    Monthly Income
                  </label>
                  <input
                    id="edit-income"
                    type="number"
                    inputMode="decimal"
                    placeholder="e.g. 1500"
                    value={editIncome}
                    onChange={(e) => setEditIncome(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSave}
                  className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Save Changes
                </button>
                {saveStatus && (
                  <p
                    className={
                      "text-xs " + (saveStatus.ok ? "text-emerald-600" : "text-red-600")
                    }
                  >
                    {saveStatus.message}
                  </p>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
