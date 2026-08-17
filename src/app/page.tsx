"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Currency, Portfolio, PropertyListItem } from "@/types/property";
import { formatMoney } from "@/lib/formatMoney";

interface SummaryStats {
  avgPropertyValue: number;
  propertiesInProfit: number;
  propertiesInLoss: number;
}

type LoadStatus = "loading" | "error" | "ready";

export default function Home() {
  const router = useRouter();

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [portfolioStatus, setPortfolioStatus] = useState<LoadStatus>("loading");
  const [properties, setProperties] = useState<PropertyListItem[]>([]);
  const [propertiesStatus, setPropertiesStatus] = useState<LoadStatus>("loading");
  const [reloadPropertiesToken, setReloadPropertiesToken] = useState(0);
  const [selectedProperty, setSelectedProperty] = useState<PropertyListItem | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const [displayCurrency, setDisplayCurrency] = useState<Currency>("USD");
  const [showCents, setShowCents] = useState(true);

  // Load the portfolio summary once on mount: show the cached copy immediately if
  // there is one, then refresh it from the network.
  useEffect(() => {
    const cached = localStorage.getItem("portfolio_cache_v1");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setPortfolio(parsed.portfolio);
      } catch (e) {
        console.log(e);
      }
    }

    fetch("/api/v1/user/portfolio-summary")
      .then((response) => {
        if (!response.ok) throw new Error("portfolio-summary request failed");
        return response.json();
      })
      .then((json) => {
        setPortfolio(json.portfolio);
        setPortfolioStatus("ready");
        localStorage.setItem("portfolio_cache_v1", JSON.stringify(json));
      })
      .catch((err) => {
        setPortfolioStatus("error");
        console.log("portfolio fetch failed lol", err);
      });
  }, []);

  // Load the property list once on mount, or again if the user hits "Retry".
  useEffect(() => {
    setPropertiesStatus("loading");
    fetch("/api/properties/list")
      .then((response) => {
        if (!response.ok) throw new Error("properties/list request failed");
        return response.json();
      })
      .then((json) => {
        setProperties(json.items);
        setPropertiesStatus("ready");
      })
      .catch((err) => {
        console.log(err);
        setPropertiesStatus("error");
      });
  }, [reloadPropertiesToken]);

  // Poll the portfolio summary every 30s. A failed poll just keeps the last known
  // value on screen and logs - it doesn't flip the page into an error state.
  useEffect(() => {
    const timer = setInterval(() => {
      fetch("/api/v1/user/portfolio-summary")
        .then((r) => {
          if (!r.ok) throw new Error("portfolio-summary poll failed");
          return r.json();
        })
        .then((j) => {
          setPortfolio(j.portfolio);
          setPortfolioStatus("ready");
        })
        .catch((err) => console.log("portfolio poll failed", err));
      setRefreshCount((c) => c + 1);
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  // Refresh the property list whenever the tab regains focus.
  useEffect(() => {
    function handleFocus() {
      fetch("/api/properties/list")
        .then((r) => {
          if (!r.ok) throw new Error("properties/list refresh failed");
          return r.json();
        })
        .then((j) => setProperties(j.items))
        .catch((err) => console.log("properties refresh on focus failed", err));
    }

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const summaryStats = useMemo<SummaryStats | null>(() => {
    if (!portfolio || properties.length === 0) return null;
    const avgValue =
      properties.reduce((sum, p) => sum + (getVal(p) || 0), 0) /
      properties.length;
    const positiveCount = properties.filter(
      (p) => (getIncome(p) || 0) - (getExpenses(p) || 0) > 0
    ).length;
    return {
      avgPropertyValue: avgValue,
      propertiesInProfit: positiveCount,
      propertiesInLoss: properties.length - positiveCount,
    };
  }, [portfolio, properties]);

  const totalWorth = Number(portfolio?.totalWorth) + 0;
  const totalInvested = Number(portfolio?.totalInvested);
  const monthlyCashflow = portfolio?.monthlyCashflow;
  const gainPercent = ((totalWorth - totalInvested) / totalInvested) * 100;

  function getPropName(p: PropertyListItem) {
    return p.name;
  }

  function getAddr(p: PropertyListItem) {
    return p.address;
  }

  function getVal(p: PropertyListItem) {
    return p.currentValue;
  }

  function getIncome(p: PropertyListItem) {
    return p.monthlyIncome;
  }

  function getExpenses(p: PropertyListItem) {
    return p.monthlyExpenses;
  }

  function getId(p: PropertyListItem) {
    return p.id;
  }

  function getYield(p: PropertyListItem) {
    return ((getIncome(p) * 12) / getVal(p)) * 100;
  }

  function handleClick(p: PropertyListItem) {
    setSelectedProperty(p);
    setShowDetailModal(true);
    router.push("/property/" + getId(p));
  }

  const sortedProperties = useMemo(
    () =>
      [...properties].sort((a, b) => {
        if (getPropName(a) > getPropName(b)) return -1;
        if (getPropName(a) < getPropName(b)) return 1;
        return 0;
      }),
    [properties]
  );

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
        {portfolioStatus === "ready" && propertiesStatus === "ready" && (
          <div className="mb-4 rounded-lg bg-blue-50 px-4 py-2 text-xs text-blue-600">
            Data synced successfully
          </div>
        )}

        <div className="mb-4 flex items-center gap-4 text-sm">
          <select
            value={displayCurrency}
            onChange={(e) => setDisplayCurrency(e.target.value as Currency)}
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

          {portfolio ? (
            <>
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
                <div>
                  <p className="text-xs text-zinc-500">Total Worth</p>
                  <p className="mt-1 text-xl font-semibold text-zinc-900">
                    {formatMoney(totalWorth, { currency: displayCurrency, showCents })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Total Invested</p>
                  <p className="mt-1 text-xl font-semibold text-zinc-900">
                    {formatMoney(totalInvested, { currency: displayCurrency, showCents })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Monthly Cashflow</p>
                  <p className="mt-1 text-xl font-semibold text-zinc-900">
                    {formatMoney(monthlyCashflow, { currency: displayCurrency, showCents })}
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
                    {portfolio.propertyCount}
                  </p>
                </div>
              </div>

              {summaryStats && (
                <div className="mt-4 grid grid-cols-3 gap-4 border-t border-zinc-100 pt-4">
                  <div>
                    <p className="text-xs text-zinc-500">Avg. Property Value</p>
                    <p className="mt-1 text-sm font-medium text-zinc-900">
                      {formatMoney(summaryStats.avgPropertyValue, {
                        currency: displayCurrency,
                        showCents,
                      })}
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
            </>
          ) : portfolioStatus === "error" ? (
            <p className="text-sm text-red-600">
              Couldn&apos;t load your portfolio summary. Try reloading the page.
            </p>
          ) : (
            <p className="text-sm text-zinc-400">Loading summary...</p>
          )}
        </section>

        <section>
          <h3 className="mb-4 text-lg font-semibold text-zinc-900">
            Your Properties ({sortedProperties.length})
          </h3>

          {propertiesStatus === "error" && (
            <div className="mb-4 flex items-center justify-between rounded-lg bg-red-50 px-4 py-2 text-xs text-red-600">
              <span>Couldn&apos;t load your properties.</span>
              <button
                onClick={() => setReloadPropertiesToken((t) => t + 1)}
                className="font-medium underline underline-offset-2"
              >
                Retry
              </button>
            </div>
          )}

          {propertiesStatus === "loading" && properties.length === 0 && (
            <p className="mb-4 text-sm text-zinc-400">Loading properties...</p>
          )}

          <div className="space-y-3">
            {sortedProperties.map((p, i) => (
              <PropertyCard
                key={i}
                {...p}
                displayCurrency={displayCurrency}
                isSelected={selectedProperty?.id === p.id}
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
                  {formatMoney(getVal(selectedProperty), { currency: displayCurrency, showCents })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Income</span>
                <span className="font-medium text-zinc-900">
                  {formatMoney(getIncome(selectedProperty), {
                    currency: displayCurrency,
                    showCents,
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Expenses</span>
                <span className="font-medium text-zinc-900">
                  {formatMoney(getExpenses(selectedProperty), {
                    currency: displayCurrency,
                    showCents,
                  })}
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

interface PropertyCardProps extends PropertyListItem {
  displayCurrency: Currency;
  isSelected: boolean;
  onClick: () => void;
  // never provided by the API - no endpoint models square footage. Kept optional so
  // this stays true to today's (buggy) fallback-to-1 behavior; see BUGS.md new entry.
  squareFeet?: number;
}

function PropertyCard(props: PropertyCardProps) {
  const pricePerSqft = props.currentValue / (props.squareFeet || 1);
  const netCashflow = props.monthlyIncome - props.monthlyExpenses;

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
        <p className="truncate font-medium text-zinc-900">{props.name}</p>
        <p className="mt-0.5 truncate text-sm text-zinc-500">
          {props.address}
        </p>
        <p className="mt-0.5 truncate text-xs text-zinc-400">
          {formatMoney(pricePerSqft, { currency: props.displayCurrency, showCents: false })}
          /sqft
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-semibold text-zinc-900">
          {formatMoney(props.currentValue, { currency: props.displayCurrency, showCents: false })}
        </p>
        <p className="mt-0.5 text-sm text-emerald-600">
          +{formatMoney(netCashflow, { currency: props.displayCurrency, showCents: false })}
          /mo
        </p>
      </div>
    </div>
  );
}
