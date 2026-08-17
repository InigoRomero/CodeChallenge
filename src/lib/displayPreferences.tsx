"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Currency } from "@/types/property";

// How the user wants figures drawn, for every route. Lives above the pages because the
// preference is set on home and read on the detail page too.
//
// `displayCurrency` is the symbol home draws portfolio-wide totals in. It is NOT what the
// detail page uses: there, every figure belongs to one property and is drawn in that
// property's own currency, so a EUR property is never shown in dollars. Nothing outside
// home should read this field.
interface DisplayPreferences {
  displayCurrency: Currency;
  showCents: boolean;
}

const DEFAULTS: DisplayPreferences = { displayCurrency: "USD", showCents: true };
const STORAGE_KEY = "display_preferences_v1";

interface DisplayPreferencesValue extends DisplayPreferences {
  setDisplayCurrency: (currency: Currency) => void;
  setShowCents: (showCents: boolean) => void;
}

const DisplayPreferencesContext = createContext<DisplayPreferencesValue | null>(null);

function parseStored(raw: string): Partial<DisplayPreferences> {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null) return {};

  const { displayCurrency, showCents } = parsed as Record<string, unknown>;
  return {
    ...(displayCurrency === "USD" || displayCurrency === "EUR" ? { displayCurrency } : {}),
    ...(typeof showCents === "boolean" ? { showCents } : {}),
  };
}

export function DisplayPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<DisplayPreferences>(DEFAULTS);
  // Starts false on the server and on the first client render, so both produce the same
  // HTML and only the second render can differ.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        setPreferences((prev) => ({ ...prev, ...parseStored(raw) }));
      } catch (err) {
        console.error("discarding unreadable display preferences", err);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    // Guarded, or the first run would write the defaults over what we are about to read.
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  }, [hydrated, preferences]);

  const setDisplayCurrency = useCallback((displayCurrency: Currency) => {
    setPreferences((prev) => ({ ...prev, displayCurrency }));
  }, []);

  const setShowCents = useCallback((showCents: boolean) => {
    setPreferences((prev) => ({ ...prev, showCents }));
  }, []);

  const value = useMemo(
    () => ({ ...preferences, setDisplayCurrency, setShowCents }),
    [preferences, setDisplayCurrency, setShowCents]
  );

  return (
    <DisplayPreferencesContext.Provider value={value}>
      {children}
    </DisplayPreferencesContext.Provider>
  );
}

export function useDisplayPreferences(): DisplayPreferencesValue {
  const value = useContext(DisplayPreferencesContext);
  if (!value) {
    throw new Error("useDisplayPreferences must be used inside DisplayPreferencesProvider");
  }
  return value;
}
