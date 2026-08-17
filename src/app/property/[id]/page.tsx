"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { PropertyDetail } from "@/types/property";
import { formatMoney } from "@/lib/formatMoney";

type DetailStatus = "loading" | "not_found" | "error" | "ready";

export default function PropertyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [detail, setDetail] = useState<PropertyDetail | null>(null);
  const [detailStatus, setDetailStatus] = useState<DetailStatus>("loading");
  const [editValue, setEditValue] = useState("");
  const [editIncome, setEditIncome] = useState("");
  const [saveStatus, setSaveStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const propertyId = params.id;

  // Fetch the detail for the current id. `ignore` guards against a stale response
  // (from a previous id) landing after the id has already changed again.
  useEffect(() => {
    let ignore = false;
    setDetailStatus("loading");

    if (propertyId === "never") {
      // legacy/portfolio returns a completely different shape (uuid/label/addr/boughtFor/worth,
      // no .stats) - this cast preserves the existing shape mismatch, see BUGS.md #11.
      fetch("/api/legacy/portfolio")
        .then((r) => r.json())
        .then((d) => {
          if (ignore) return;
          setDetail(d.result.assets[0] as PropertyDetail);
          setDetailStatus("ready");
        })
        .catch(() => {
          if (!ignore) setDetailStatus("error");
        });
    } else {
      fetch("/api/property-details?property_id=" + propertyId)
        .then(async (res) => {
          // the route returns a 404 OR a 200 with {property:null} for a missing id -
          // both mean "not found", not "something broke".
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
          if (!ignore) setDetailStatus("error");
        });
    }

    return () => {
      ignore = true;
    };
  }, [propertyId]);

  const headerValue = Number(detail?.currentValue ?? detail?.purchasePrice);
  const cashflow =
    (detail?.monthlyIncome || 0) - (detail?.monthlyExpenses || detail?.purchasePrice || 0);

  const roi =
    ((headerValue - Number(detail?.purchasePrice)) / Number(detail?.purchasePrice)) * 100;

  const cashOnCash = ((cashflow * 12) / Number(detail?.downPayment)) * 100;

  const rows = [
    { label: "Purchase Price", value: detail?.purchasePrice },
    { label: "Current Value", value: headerValue },
    { label: "Monthly Income", value: detail?.monthlyIncome },
    { label: "Monthly Expenses", value: detail?.monthlyExpenses },
  ];

  const ownerRow = { label: "Owner", value: detail?.ownerName };

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
              <p className="mt-1 text-sm text-zinc-400">Owner: {ownerRow.value}</p>
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
                {rows.map((row, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-6 py-4 text-sm"
                  >
                    <span className="text-zinc-500">{row.label}</span>
                    <span className="font-medium text-zinc-900">
                      {formatMoney(row.value)}
                    </span>
                  </div>
                ))}

                <div className="flex items-center justify-between bg-zinc-50 px-6 py-4 text-sm">
                  <span className="font-medium text-zinc-700">Net Cashflow</span>
                  <span
                    className={
                      "font-semibold " +
                      (cashflow > 0 ? "text-emerald-600" : "text-red-600")
                    }
                  >
                    {formatMoney(cashflow)}
                  </span>
                </div>
                <div className="flex items-center justify-between px-6 py-4 text-sm">
                  <span className="text-zinc-500">ROI</span>
                  <span className="font-medium text-zinc-900">
                    {roi.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between px-6 py-4 text-sm">
                  <span className="text-zinc-500">Cash-on-Cash Return</span>
                  <span className="font-medium text-zinc-900">
                    {cashOnCash.toFixed(1)}%
                  </span>
                </div>
              </div>
            </section>

            <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-400">
                Quick Edit
              </h2>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-zinc-500">Current Value</label>
                  <input
                    type="text"
                    placeholder="e.g. 250000"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500">Monthly Income</label>
                  <input
                    type="text"
                    placeholder="e.g. 1500"
                    value={editIncome}
                    onChange={(e) => setEditIncome(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm"
                  />
                </div>
                <button
                  onClick={() => {
                    const updates: { id: typeof propertyId; value?: string; income?: string } = {
                      id: propertyId,
                    };
                    if (editValue) updates.value = editValue;
                    if (editIncome) updates.income = editIncome;
                    setSaveStatus(null);
                    fetch("/api/properties/update", {
                      method: "PATCH",
                      body: JSON.stringify(updates),
                    })
                      .then(async (res) => {
                        const body = await res.json();
                        if (res.ok && body.ok) {
                          setSaveStatus({ ok: true, message: "Saved." });
                        } else {
                          setSaveStatus({ ok: false, message: body.reason ?? "Could not save." });
                        }
                      })
                      .catch(() => setSaveStatus({ ok: false, message: "Could not save." }));
                  }}
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
