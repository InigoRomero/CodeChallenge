# Write-up

## Main problems found

The codebase had five problem layers, roughly independent of each other:

1. **Inconsistent data.** The mock "database" merges a US and a Spain system that never got
   reconciled (`id`/`property_id`, `currentValue`/`valor_actual`, `owner_id`/`propietario_id`,
   `type`/`tipo`...). Every API route re-implemented its own `??` chain to resolve these, each
   one slightly differently — some checked the Spain-system foreign keys, some didn't. A single
   malformed transaction (`amount: Number("N/A")`) turned into `NaN`, which `JSON.stringify`
   silently turns into `null`, which downstream code treated as "falsy → use this other fallback
   instead" — producing plausible-looking but completely wrong numbers (Net Cashflow of
   `-238100` for a property with a 240k expense-free month).
2. **No types.** `useState<any>` everywhere meant nothing caught the shape drift between
   endpoints (e.g. `purchase` vs `purchasePrice` used inconsistently in the same file).
3. **Hooks misuse.** One `useEffect` in `page.tsx` mixed four unrelated concerns (two fetches,
   a poll, a focus listener with no cleanup — a real memory leak). Two separate stale-closure
   counters. A derived value (`summaryStats`) computed via `useEffect`+`setState` instead of
   directly. A genuine race condition in the property-detail fetch (two competing writes to the
   same state, no cancellation on id change).
4. **Logic bugs downstream of the above.** Home and Detail showed different values for the same
   property's "Current Value" (a `??` fallback in the wrong order). `/property/never` crashed
   100% of the time on an incomplete null-check. Selecting a card compared object references,
   which breaks the moment the list refetches.
5. **No resilience.** Every failure mode (a 500, a 404, a missing field) either corrupted the UI
   silently (`$NaN`, `NaN%`) or left it stuck on "Loading..." forever, with no visible error and
   no way to retry.

## How I prioritized

Fixed the data layer first, then types, then hooks, then the logic bugs that depended on
consistent naming, then formatting, then resilience — in that order, because each layer's
correctness assumes the one before it: you can't usefully type against field names that don't
exist consistently yet; you can't cleanly split a `useEffect` around data whose shape you don't
trust; the ROI/"Current Value" bugs were only cleanly fixable once `purchase` vs
`purchasePrice` stopped being two different things in the same file. Resilience (loading/error
states) came last on purpose — it's the layer users notice first, but building it on top of
still-shifting data/hooks would have meant redoing it.

## What changed and why

- **Data**: centralized all field-synonym resolution, active-record filtering, and
  NaN-safe transaction summing into `src/data/normalize.ts`, used by every route instead of each
  one re-implementing it. Fixed the PATCH "last field wins" bug (income was overwriting
  `currentValue`) by giving it its own field, plus server-side numeric validation.
- **Types**: `src/types/property.ts` defines the shapes every endpoint actually returns; removed
  every `any` in the two page components.
- **Hooks**: split the giant effect into one-responsibility effects, fixed the focus-listener
  leak, fixed both stale-closure counters (functional `setState`), replaced the derived-state
  effect with `useMemo`, and turned the property-detail race into an `if/else` with an `ignore`
  flag for stale responses.
- **Logic**: fixed the `Current Value` field-priority bug, the incomplete `.stats` guard (which,
  it turns out, also crashed on any property with `analytics: null`, not just the documented
  `/property/never` case), and switched card selection to compare by `id`.
- **Formatting**: one shared `formatMoney` used everywhere — fixes the currency selector not
  reaching property cards, and forces a fixed locale instead of trusting the browser's.
- **Resilience**: real `loading | error | ready` (and `not_found`) states for the three main
  fetches, with visible messages and a working Retry button, replacing silent `$NaN` / infinite
  spinners.

Full bug-by-bug detail, with repro steps and verification, is in `BUGS.md`.

## What I deliberately left alone

- **Currency conversion.** The USD/EUR selector only swaps the symbol — it doesn't convert the
  number, and neither did the original code. There's no FX rate source anywhere in the data, so
  building one felt like a bigger product decision than this pass should make unilaterally.
- **Cash-on-Cash Return** is permanently `NaN%` — it depends on a `downPayment` concept that
  doesn't exist anywhere in the data model, not a naming bug I could normalize away.
- **`squareFeet`** (the "$xxx/sqft" line on property cards) is never populated by any endpoint;
  it silently falls back to showing the total price again. Same story as above — no data to fix
  it with.
- **The `propertyId === "never"` branch** in the detail page is an obvious debug/test hook (no
  real id will ever be `"never"`), not a feature. I fixed the crash it used to cause but didn't
  remove the hook itself, since deleting it wasn't asked for by any of the planned steps.
- **Client-side form validation** on Quick Edit. The server now rejects non-numeric input with a
  clear reason, and the UI shows it — but the input field itself doesn't validate before
  submitting.
- A few dead-code nits (`getYield`, an unused CSS variable, string-concatenated conditional
  classNames) — flagged during review, not touched, because they have zero observable effect.

## Trade-offs / assumptions

- Kept the API routes' random failure rates (10%/15%/30%) untouched — they're what makes the
  resilience bugs reproducible and testable. I *did* remove the artificial network latency
  (400ms–3s, inconsistent per route) after checking the original code: only one of five routes
  even commented on why it was there, and that comment was sarcastic ("real users have slow
  wifi right??") — it read as filler cruft, not a deliberate testing surface, and `AGENDA.md`'s
  own diagnosis had already flagged it for full cleanup.
- Money values are still not converted between currencies and portfolio totals still sum EUR and
  USD properties as if they were the same unit — a real limitation, not something formatting
  could paper over.
- Every fix was verified against the running app (via Playwright — including forcing failures
  through route interception to check the loading/error states, not just reloading and hoping
  for the random case) and `tsc --noEmit`/`next lint`, not just read for plausibility.
