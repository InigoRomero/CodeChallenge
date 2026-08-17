"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Currency, Portfolio, PropertyListItem } from "@/types/property";
import { formatMoney, formatPercent } from "@/lib/format";
import { useDisplayPreferences } from "@/lib/displayPreferences";

interface SummaryStats {
  avgPropertyValue: number;
  propertiesInProfit: number;
  propertiesInLoss: number;
}

type LoadStatus = "loading" | "error" | "ready";

const PORTFOLIO_CACHE_KEY = "portfolio_cache_v1";

async function fetchPortfolio(): Promise<Portfolio> {
  const response = await fetch("/api/v1/user/portfolio-summary");
  if (!response.ok) throw new Error("portfolio-summary request failed");
  const json = await response.json();
  return json.portfolio;
}

async function fetchPropertyList(): Promise<PropertyListItem[]> {
  const response = await fetch("/api/properties/list");
  if (!response.ok) throw new Error("properties/list request failed");
  const json = await response.json();
  return json.items;
}

export default function Home() {
  const router = useRouter();

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [portfolioStatus, setPortfolioStatus] = useState<LoadStatus>("loading");
  const [properties, setProperties] = useState<PropertyListItem[]>([]);
  const [propertiesStatus, setPropertiesStatus] = useState<LoadStatus>("loading");
  const [reloadPropertiesToken, setReloadPropertiesToken] = useState(0);
  const [refreshCount, setRefreshCount] = useState(0);
  const { displayCurrency, setDisplayCurrency, showCents, setShowCents } =
    useDisplayPreferences();

  // Cached copy first, then the network.
  useEffect(() => {
    const cached = localStorage.getItem(PORTFOLIO_CACHE_KEY);
    if (cached) {
      try {
        setPortfolio(JSON.parse(cached).portfolio);
      } catch (err) {
        console.error("discarding unreadable portfolio cache", err);
        localStorage.removeItem(PORTFOLIO_CACHE_KEY);
      }
    }

    fetchPortfolio()
      .then((next) => {
        setPortfolio(next);
        setPortfolioStatus("ready");
        localStorage.setItem(PORTFOLIO_CACHE_KEY, JSON.stringify({ portfolio: next }));
      })
      .catch((err) => {
        setPortfolioStatus("error");
        console.error("portfolio fetch failed", err);
      });
  }, []);

  useEffect(() => {
    setPropertiesStatus("loading");
    fetchPropertyList()
      .then((items) => {
        setProperties(items);
        setPropertiesStatus("ready");
      })
      .catch((err) => {
        console.error("properties fetch failed", err);
        setPropertiesStatus("error");
      });
  }, [reloadPropertiesToken]);

  // A failed poll deliberately keeps the last known value on screen rather than
  // flipping the page into an error state.
  useEffect(() => {
    const timer = setInterval(() => {
      fetchPortfolio()
        .then((next) => {
          setPortfolio(next);
          setPortfolioStatus("ready");
        })
        .catch((err) => console.error("portfolio poll failed", err));
      setRefreshCount((c) => c + 1);
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    function handleFocus() {
      fetchPropertyList()
        .then(setProperties)
        .catch((err) => console.error("properties refresh on focus failed", err));
    }

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const summaryStats = useMemo<SummaryStats | null>(() => {
    if (!portfolio || properties.length === 0) return null;
    const netCashflow = (p: PropertyListItem) => p.monthlyIncome - p.monthlyExpenses;
    return {
      avgPropertyValue:
        properties.reduce((sum, p) => sum + p.currentValue, 0) / properties.length,
      // A property at exactly break-even is in neither bucket, so these two need not
      // add up to properties.length.
      propertiesInProfit: properties.filter((p) => netCashflow(p) > 0).length,
      propertiesInLoss: properties.filter((p) => netCashflow(p) < 0).length,
    };
  }, [portfolio, properties]);

  const sortedProperties = useMemo(
    () => [...properties].sort((a, b) => a.name.localeCompare(b.name)),
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
                    {formatMoney(portfolio.totalWorth, { currency: displayCurrency, showCents })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Total Invested</p>
                  <p className="mt-1 text-xl font-semibold text-zinc-900">
                    {formatMoney(portfolio.totalInvested, { currency: displayCurrency, showCents })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Monthly Cashflow</p>
                  <p className="mt-1 text-xl font-semibold text-zinc-900">
                    {formatMoney(portfolio.monthlyCashflow, {
                      currency: displayCurrency,
                      showCents,
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Gain / Loss</p>
                  <p className="mt-1 text-xl font-semibold text-zinc-900">
                    {formatPercent(portfolio.gainLossPercent)}
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

          {propertiesStatus === "ready" && properties.length === 0 && (
            <p className="rounded-lg border border-dashed border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500">
              You don&apos;t own any properties yet.
            </p>
          )}

          <div className="space-y-3">
            {sortedProperties.map((p) => (
              <PropertyCard
                key={p.id}
                property={p}
                displayCurrency={displayCurrency}
                showCents={showCents}
                onClick={() => router.push(`/property/${encodeURIComponent(p.id)}`)}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

interface PropertyCardProps {
  property: PropertyListItem;
  displayCurrency: Currency;
  showCents: boolean;
  onClick: () => void;
}

function PropertyCard({ property, displayCurrency, showCents, onClick }: PropertyCardProps) {
  const netCashflow = property.monthlyIncome - property.monthlyExpenses;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-lg border border-zinc-200 bg-white px-5 py-4 text-left shadow-sm transition hover:border-zinc-300 hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
    >
      <div className="min-w-0 flex-1 pr-4">
        <p className="truncate font-medium text-zinc-900">{property.name}</p>
        <p className="mt-0.5 truncate text-sm text-zinc-500">{property.address}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-semibold text-zinc-900">
          {formatMoney(property.currentValue, { currency: displayCurrency, showCents })}
        </p>
        <p
          className={
            "mt-0.5 text-sm " + (netCashflow < 0 ? "text-red-600" : "text-emerald-600")
          }
        >
          {netCashflow > 0 ? "+" : ""}
          {formatMoney(netCashflow, { currency: displayCurrency, showCents })}
          /mo
        </p>
      </div>
    </button>
  );
}
