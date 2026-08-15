"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  const [portfolio, setPortfolio] = useState<any>(null);
  const [properties, setProperties] = useState<any>([]);
  const [selectedProperty, setSelectedProperty] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const [err, setErr] = useState<any>(null);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [showCents, setShowCents] = useState(true);

  useEffect(() => {
    const cached = localStorage.getItem("portfolio_cache_v1");
    if (cached) {
      try {
        var parsed = JSON.parse(cached);
        setPortfolio(parsed.data.portfolio);
      } catch (e) {
        console.log(e);
      }
    }

    fetch("/api/v1/user/portfolio-summary")
      .then((response) => response.json())
      .then((json) => {
        setPortfolio(json.data.portfolio);
        localStorage.setItem("portfolio_cache_v1", JSON.stringify(json));
      })
      .catch((err) => {
        setErr(err);
        console.log("portfolio fetch failed lol", err);
      });

    fetch("/api/properties/list")
      .then((response) => response.json())
      .then((json) => {
        setProperties(json.items);
      })
      .catch((err) => {
        console.log(err);
      });

    fetch("/api/legacy/portfolio")
      .then((r) => r.json())
      .then((d) => console.log("legacy", d));

    const timer = setInterval(function () {
      fetch("/api/v1/user/portfolio-summary")
        .then((r) => r.json())
        .then((j) => setPortfolio(j.data.portfolio));
      setRefreshCount(refreshCount + 1);
    }, 30000);

    window.addEventListener("focus", function () {
      fetch("/api/properties/list")
        .then((r) => r.json())
        .then((j) => setProperties(j.items));
    });

    return () => clearInterval(timer);
  }, []);

  const [summaryStats, setSummaryStats] = useState<any>(null);

  useEffect(() => {
    if (portfolio && properties.length > 0) {
      const avgValue =
        properties.reduce((sum: number, p: any) => sum + (getVal(p) || 0), 0) /
        properties.length;
      const positiveCount = properties.filter(
        (p: any) => (getIncome(p) || 0) - (getExpenses(p) || 0) > 0
      ).length;
      setSummaryStats({
        avgPropertyValue: avgValue,
        propertiesInProfit: positiveCount,
        propertiesInLoss: properties.length - positiveCount,
      });
    }
  }, [portfolio, properties]);

  var totalWorth = portfolio?.total_worth + 0;
  var totalInvested = portfolio?.total_invested;
  var monthlyCashflow = portfolio?.monthly_cashflow;
  var gainPercent = ((totalWorth - totalInvested) / totalInvested) * 100;

  function formatMoney(amount: any) {
    if (amount == null) return showCents ? "$0.00" : "$0";
    const symbol = displayCurrency === "EUR" ? "\u20ac" : "$";
    return showCents
      ? symbol + Number(amount).toFixed(2)
      : symbol + Math.round(Number(amount)).toLocaleString();
  }

  function getPropName(p: any) {
    if (p.name) return p.name;
    if (p.title) return p.title;
    return "Unknown Property";
  }

  function getAddr(p: any) {
    if (p.address) {
      return p.address;
    } else {
      if (p.location) {
        return p.location;
      } else {
        return "";
      }
    }
  }

  function getVal(p: any) {
    return p.currentValue || p.market_value || 0;
  }

  function getIncome(p: any) {
    return p.monthlyIncome || p.rent_per_month;
  }

  function getExpenses(p: any) {
    return p.monthlyExpenses || p.costs_per_month || 0;
  }

  function getId(p: any) {
    return p.id || p.propId;
  }

  function getYield(p: any) {
    return ((getIncome(p) * 12) / getVal(p)) * 100;
  }

  function getPricePerSqft(p: any) {
    return getVal(p) / p.squareFeet;
  }

  function handleClick(p: any) {
    setSelectedProperty(p);
    setShowDetailModal(true);
    router.push("/property/" + getId(p));
  }

  properties.sort(function (a: any, b: any) {
    if (getPropName(a) > getPropName(b)) return -1;
    if (getPropName(a) < getPropName(b)) return 1;
    return 0;
  });

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900">PropHero</h1>
            <p className="text-sm text-zinc-500">Real estate portfolio</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {err == null && properties.length > 0 && (
          <div className="mb-4 rounded-lg bg-blue-50 px-4 py-2 text-xs text-blue-600">
            Data synced successfully
          </div>
        )}

        <div className="mb-4 flex items-center gap-4 text-sm">
          <select
            value={displayCurrency}
            onChange={(e) => setDisplayCurrency(e.target.value)}
            className="rounded border border-zinc-200 px-2 py-1 text-sm"
          >
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
          </select>
          <label className="flex items-center gap-1 text-zinc-600">
            <input
              type="checkbox"
              checked={showCents}
              onChange={(e) => setShowCents(e.target.checked)}
            />
            Show cents
          </label>
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Portfolio Overview
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Build and grow your real estate wealth
          </p>
        </div>

        <section className="mb-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h3 className="mb-5 text-xs font-medium uppercase tracking-wider text-zinc-400">
            Summary
          </h3>

          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
            <div>
              <p className="text-xs text-zinc-500">Total Worth</p>
              <p className="mt-1 text-xl font-semibold text-zinc-900">
                {formatMoney(totalWorth)}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Total Invested</p>
              <p className="mt-1 text-xl font-semibold text-zinc-900">
                {formatMoney(totalInvested)}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Monthly Cashflow</p>
              <p className="mt-1 text-xl font-semibold text-zinc-900">
                {formatMoney(monthlyCashflow)}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Gain / Loss</p>
              <p className="mt-1 text-xl font-semibold text-zinc-900">
                {gainPercent.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Properties</p>
              <p className="mt-1 text-xl font-semibold text-zinc-900">
                {portfolio?.property_count}
              </p>
            </div>
          </div>

          {summaryStats && (
            <div className="mt-4 grid grid-cols-3 gap-4 border-t border-zinc-100 pt-4">
              <div>
                <p className="text-xs text-zinc-500">Avg. Property Value</p>
                <p className="mt-1 text-sm font-medium text-zinc-900">
                  {formatMoney(summaryStats.avgPropertyValue)}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">In Profit</p>
                <p className="mt-1 text-sm font-medium text-emerald-600">
                  {summaryStats.propertiesInProfit}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">In Loss</p>
                <p className="mt-1 text-sm font-medium text-red-600">
                  {summaryStats.propertiesInLoss}
                </p>
              </div>
            </div>
          )}

          <p className="mt-4 text-xs text-zinc-300">
            auto-refresh count: {refreshCount}
          </p>
        </section>

        <section>
          <h3 className="mb-4 text-lg font-semibold text-zinc-900">
            Your Properties ({properties.length})
          </h3>

          <div className="space-y-3">
            {properties.map((p: any, i: any) => (
              <PropertyCard
                key={i}
                {...p}
                isSelected={selectedProperty === p}
                onClick={() => handleClick(p)}
              />
            ))}
          </div>
        </section>
      </main>

      {showDetailModal && selectedProperty ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => {
            setShowDetailModal(false);
            setSelectedProperty(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-zinc-900">
              {getPropName(selectedProperty)}
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              {getAddr(selectedProperty)}
            </p>

            <div className="mt-4 space-y-2 border-t border-zinc-100 pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Value</span>
                <span className="font-medium text-zinc-900">
                  {formatMoney(getVal(selectedProperty))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Income</span>
                <span className="font-medium text-zinc-900">
                  {formatMoney(getIncome(selectedProperty))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Expenses</span>
                <span className="font-medium text-zinc-900">
                  {formatMoney(getExpenses(selectedProperty))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Owner</span>
                <span className="font-medium text-zinc-900">
                  {selectedProperty.ownerName}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                setShowDetailModal(false);
                setSelectedProperty(null);
              }}
              className="mt-6 w-full rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PropertyCard(props: any) {
  return (
    <div
      onClick={props.onClick}
      className={
        "flex cursor-pointer items-center justify-between rounded-lg border bg-white px-5 py-4 shadow-sm transition hover:border-zinc-300 hover:shadow " +
        (props.isSelected
          ? "border-blue-300 ring-1 ring-blue-200"
          : "border-zinc-200")
      }
    >
      <div className="min-w-0 flex-1 pr-4">
        <p className="truncate font-medium text-zinc-900">
          {props.name || props.title || "Unknown Property"}
        </p>
        <p className="mt-0.5 truncate text-sm text-zinc-500">
          {props.address || props.location || ""}
        </p>
        <p className="mt-0.5 truncate text-xs text-zinc-400">
          $
          {(
            (props.currentValue || props.market_value || 0) /
            (props.squareFeet || 1)
          ).toLocaleString()}
          /sqft
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-semibold text-zinc-900">
          ${(props.currentValue || props.market_value || 0).toLocaleString()}
        </p>
        <p className="mt-0.5 text-sm text-emerald-600">
          +$
          {(
            (props.monthlyIncome || 0) - (props.monthlyExpenses || 0)
          ).toLocaleString()}
          /mo
        </p>
      </div>
    </div>
  );
}
