# Bug log

Working notes from auditing the running app (browser, console, network) rather than only
reading code — which is why the entries below quote real stack traces and repro steps rather
than code review observations. Each numbered entry ends with what was done and how it was
verified.

| #  | Symptom | Root cause | Status |
|----|---------|-----------|--------|
| 1  | Polling crashed the page on a failed request | No `r.ok` check, no `.catch` on the poll | Fixed |
| 2  | `portfolio-summary` 500s | Injected failure rate, unconditional | Fixed (moved behind `CHAOS=1`) |
| 3  | `$NaN` / `NaN%` in Summary after a failed load | No error state; error body has no `data` | Fixed |
| 4  | `Monthly Cashflow: $NaN` on every successful load | `amount: Number("N/A")` + `??` doesn't catch `NaN` | Fixed |
| 5  | Currency selector didn't reach property cards | `"$"` hardcoded in `PropertyCard` | Fixed |
| 6  | `$215.000` (ambiguous) instead of `$215,000` | `toLocaleString()` with no locale on an es-ES browser | Fixed |
| 7  | Saving income overwrote current value | Both fields wrote to `prop.currentValue` | Fixed |
| 8  | `"abc"` saved as a price, no validation anywhere | No parsing client- or server-side | Fixed (server-side + surfaced in UI) |
| 9  | `Net Cashflow: $-238,100` for a normal property | `NaN` → `null` → falsy → fell back to purchase price | Fixed |
| 10 | `Your Properties (0)` with no error shown | `.catch` only logged; no error state | Fixed |
| 11 | `/property/never` crashed 100% of loads | Legacy endpoint's shape has no `.stats` | Fixed (branch removed) |
| 12 | Detail showed purchase price as "Current Value" | `??` operands in the wrong order | Fixed |
| 13 | Refresh counter stuck at 1 | Stale closure in `setInterval` | Fixed (timer removed) |
| 14 | Unknown id stuck on "Loading..." forever | 404 and `{property:null}` both unhandled | Fixed |
| 15 | `alert("saved!")` even when nothing was sent | Response never inspected | Fixed |
| 16 | Soft-deleted duplicate counted in every total | No `is_active`/`activo` filtering | Fixed |
| 17 | Legacy endpoint returned `undefined` for Spain rows | Read only US field names | Fixed |
| 18 | `Cash-on-Cash Return: NaN%` | `downPayment` isn't modelled in the data at all | Open (product gap) — no longer renders `NaN` |
| 19 | Totals sum USD and EUR as one unit | No FX rate source exists | Open (product gap) |
| 20 | `$215,000/sqft` on a normal flat | `squareFeet` isn't modelled; falls back to `/1` | Fixed (line removed) |
| 21 | `+$-500/mo` rendered in green | `+` prefix and colour both hardcoded | Fixed |
| 22 | `NaN%` printed on screen | No decision on what to show without data | Fixed |
| 23 | `In Loss: 3` when one property was negative | Break-even counted as a loss | Fixed |
| 24 | Detail modal was unreachable code | Opened a modal, then navigated away | Fixed (deleted) |
| 25 | Identity-function accessors, dead `getYield` | Superseded by the normalization layer | Fixed |
| 26 | `/sqft` still showing the total price | Bug 20 left as "product decision" | Fixed |
| 27 | Malformed PATCH body → unhandled 500; 200 on "not found" | Unvalidated cast of untrusted input | Fixed |
| 28 | "Saved." but the figures on screen stayed stale | No refetch after a successful write | Fixed |
| 29 | A EUR property's detail page rendered in `$` | `PropertyDetail` dropped the `currency` the data layer computes | Fixed |
| 30 | `{"value":"  "}` stored as `$0`; `"0x1f"` as 31; negatives accepted | Validation leaned on `Number()` | Fixed |
| 31 | Server emitted `roi: null` + a fabricated trend arrow | Zero-division guarded client-side only | Fixed |
| 32 | Error panel, stale figures and "Saved." shown at once | `detail` never cleared on fetch failure | Fixed |
| 33 | `gainLossPercent` arrived as `null` under a `number` type | Portfolio ROI computed inline instead of via `metrics.ts` | Fixed |
| 34 | `/api/property-details` answered "not found" two ways at random | An undecided contract, not failure injection | Fixed |
| 35 | "Show cents" governs the summary only; cards never show cents, detail always does | The preference is local state on one route | Fixed |

Bugs 1–20 were found during the planned refactor (steps 1–6 of `AGENDA.md`); 21–28 came out of
a final full review of the diff, and several of them are follow-ups on items an earlier step had
explicitly deferred and then never picked up. Bugs 29–32 came out of a full code review of `src/`
after that (step 8) — notably, three of the four are the *same mistake as the code being
reviewed*: fixing a symptom where it was visible instead of where it was caused. Bugs 33–34 came
out of a review pass over the finished work (step 9), and 33 is a fourth instance of that same
mistake: the module written to stop metrics having two definitions was itself bypassed by one.

Findings still logged but **not** fixed: the property-list effect has no `ignore` flag;
`handleFocus` updates `properties` without updating `propertiesStatus`; the portfolio error branch
is unreachable once the `localStorage` cache has hydrated (and that cache has no TTL and a stale
`_v1` key); and writes don't filter on active rows. All are state-coherence issues rather than
wrong numbers on screen.

---

## 1.
Runtime TypeError

```
Cannot read properties of undefined (reading 'portfolio')

src/app/page.tsx (56:42) @ Home.useEffect.timer

  54 |       fetch("/api/v1/user/portfolio-summary")
  55 |         .then((r) => r.json())
> 56 |         .then((j) => setPortfolio(j.data.portfolio));
     |                                          ^
  57 |       setRefreshCount(refreshCount + 1);
  58 |     }, 30000);

Call Stack
Home.useEffect.timer
src/app/page.tsx (56:42)
```

**FIXED (step 6, resilience):** the polling `.then(j => setPortfolio(j.data.portfolio))` now
checks `r.ok` before parsing (throwing if not) and has its own `.catch` that only logs — a failed
poll no longer blows anything up, it simply keeps the last known `portfolio` value on screen and
tries again on the next 30s cycle. (The `j.data.portfolio` access itself was already gone as of
step 1, which renamed the response to `j.portfolio` — that had already removed the original
TypeError; this adds the missing network/500 failure handling on top.)

## 2.
```
page.tsx:54
 GET http://localhost:3000/api/v1/user/portfolio-summary 500 (Internal Server Error)
(anonymous)	@	page.tsx:54
```

**BY DESIGN, INITIALLY:** this is the route's injected failure rate (`Math.random() < 0.15`),
not a defect. I kept it through the refactor because it's what makes the resilience work in bugs
3 and 10 reproducible.

**FIXED (step 9):** kept, but not unconditionally. Three routes were rolling dice on every
request (`portfolio-summary` 15%, `properties/list` 10%, `properties/update` 10%), so roughly one
load in four failed somewhere — in code whose whole claim is that it's production quality. The
rates now live behind `shouldInjectFailure()` in `src/lib/chaos.ts`, which returns false unless
`CHAOS=1`. The default install is clean; `CHAOS=1 npm run dev` restores the old behaviour for a
pass over the failure paths, and `?forceError=1` on the summary route is unchanged and remains
the deterministic way to see an error state.

Verified by probing each endpoint 20–25 times on both settings: 0 failures out of 10/10/5 on the
default, and 500s reappearing at roughly the configured rates under `CHAOS=1`.

The same argument applies to the starter's `await wait(1800 + Math.random() * 1200)`, which I had
simply deleted — with the difference that it was hiding behind "simulate slow network" while
making every page load feel broken. Deleting it removed the only way to *see* a loading state,
which I should have said out loud at the time; `CHAOS=1` is now the honest place for it if it
ever needs to come back.

## 3.
Loading "/" with devtools open: if the initial fetch (not the timer's — the one in the first
`useEffect`) of `/api/v1/user/portfolio-summary` hits the random 500, the screen does NOT crash
but is silently broken:

```
Total Worth: $NaN
Gain / Loss: NaN%
Properties: (empty)
```

Network:
`GET http://localhost:3000/api/v1/user/portfolio-summary => 500 Internal Server Error`
Console:
`[ERROR] Failed to load resource: the server responded with a status of 500 (Internal Server Error) @ http://localhost:3000/api/v1/user/portfolio-summary:0`

What happens: the mount fetch DOES have a `.catch`, so it doesn't blow up like the timer's
(bug 1), but since the error body is `{ok:false, err_msg:"..."}` with no `"data"`, the
`.then(json => setPortfolio(json.data.portfolio))` throws its own TypeError ("Cannot read
properties of undefined (reading 'portfolio')") which lands in that same `.catch` below →
`portfolio` stays null → `totalWorth = portfolio?.total_worth + 0 = NaN`, `gainPercent = NaN`.
There is no error message visible to the user at any point; the page looks "loaded" but full of
garbage. I expected some error or loading state, not a literal "$NaN" on screen.

**FIXED (step 6, resilience):** new `portfolioStatus: "loading"|"error"|"ready"` state. The
initial fetch checks `response.ok` and throws if not; the `.catch` sets
`portfolioStatus="error"` instead of silently leaving `portfolio` as null. The Summary section's
render is now a real `if/else`: with `portfolio` → numbers; without `portfolio` and in error →
"Couldn't load your portfolio summary. Try reloading the page."; without `portfolio` and loading
→ "Loading summary...". Verified with Playwright by intercepting the route to force a 500 with
`localStorage` empty (so no cache could mask the error): no "$NaN" appears anywhere any more,
the message does.

## 4.
Monthly Cashflow shows "$NaN" ALWAYS when the API responds 200 (the random 500 isn't needed —
this is 100% reproducible). I reloaded 5 times in a row and got $NaN all 5 times whenever
portfolio-summary didn't fail.

- **Repro:** load "/", wait for the summary to load without the random 500.
- **Expected:** a number.
- **Actual:** "Monthly Cashflow: $NaN" (or "€NaN" if you switch to EUR).

Cause (found by reading the code, but the symptom is 100% visible at runtime): in
`src/data/mockProperties.ts` there's a transaction with `amount: Number("N/A")` (txn-012,
prop-004, expense). The portfolio-summary `route.ts` sums it with `(t.amount ?? t.monto ?? 0)` —
since `NaN` is neither null nor undefined, `??` does NOT replace it with 0, so `totalExpenses`
becomes `NaN` and `monthly_cashflow = String(NaN) = "NaN"`. The front end does
`Number("NaN").toFixed(2) = "NaN"` and renders it as-is, with no guard.

**FIXED (step 1, data normalization):** `sumTransactions()` in `src/data/normalize.ts` uses
`Number.isFinite(amount)` instead of `?? 0` to decide whether an amount is valid, so a `NaN`
(like txn-012's) counts as 0 rather than poisoning the sum. `monthly_cashflow` is now a real
`number` (no longer `String(...)`), field renamed to `monthlyCashflow`. Root cause fixed in one
place, not just in portfolio-summary.

## 5.
The currency selector (USD/EUR) only affects the "Summary" section. The property cards in the
list below keep showing a fixed "$" no matter what.

- **Repro:** on "/", switch the dropdown to "EUR (€)".
- **Expected:** the whole screen (summary + list) switches to €.
- **Actual:** Summary changes to "€22260000.00" etc., but every property card stays at
  "$215.000", "$267.000"... (the € symbol never appears there). `PropertyCard` hardcodes "$"
  instead of using `formatMoney`/`displayCurrency`.

**FIXED (step 5, presentation):** `formatMoney` centralized in `src/lib/format.ts`, used by Home
(Summary and PropertyCard) and by Detail. `PropertyCardProps` now receives `displayCurrency`
from Home. Verified: switching the dropdown to EUR changes both the Summary and every card to
"€" (same "only the symbol changes, the number isn't converted" behaviour Summary already had —
still no FX table, see bug 19).

## 6.
Numbers rendered with `.toLocaleString()` (property cards and the "$xxx/sqft") come out oddly
formatted: "$215.000/sqft", "$215.000" instead of "$215,000". The data isn't wrong — the problem
is that `toLocaleString()` with no locale argument uses the browser's locale
(`navigator.language = "es-ES"` in this environment), so it groups thousands with a dot instead
of a comma, which is ambiguous with a "$" in front (it reads as 215 dollars and change, not 215
thousand). Confirmed with:

```
await page.evaluate(() => navigator.language) => "es-ES"
```

This happens in the home list and in `formatMoney`'s "no cents" mode too.

**FIXED (step 5, presentation):** `formatMoney` (`src/lib/format.ts`) forces
`toLocaleString("en-US", ...)` instead of letting the browser pick the locale. As a bonus,
thousands separators now also apply in "with cents" mode (it used to use `toFixed(2)` with no
locale at all: "$1875000.00" → now "$1,875,000.00"), and it was unified with the separate
formatter `property/[id]/page.tsx` had ("different formatter than the home page on purpose
(nobody noticed)") — there are no longer two diverging implementations.

## 7.
`PATCH /api/properties/update` has a fairly serious "last field wins" bug: both `value` and
`income` end up writing to the SAME field (`currentValue`) of the in-memory object. Income is
never stored anywhere.

`route.ts`:
```js
if (body.value !== undefined) { prop.currentValue = body.value; }
if (body.income !== undefined) { prop.currentValue = body.income; }
```

**Repro:**
1. Go to `/property/prop-001` (Sunset Apartments, real `currentValue` = 215000).
2. Quick Edit → Current Value: 999000, Monthly Income: 5000 → Save Changes → alert "saved!".
3. Go back to "/": Sunset Apartments now has `currentValue = "5000"` (income overwrote value),
   NOT 999000 and not 215000. The list literally shows "$5000/sqft" and "$5000" as the price.
4. Bonus: since `currentValue` is now the STRING "5000" (the inputs are never parsed to
   `Number`, neither in the front end nor the backend), the "Avg. Property Value" reduce on home
   does string concatenation instead of addition:
   `Avg. Property Value: $7.143238571925715e+38`
   (`0 + "5000"` → `"05000"` string, then the rest of the numeric `currentValue`s get
   concatenated on, and dividing that giant string by `properties.length` coerces it to Number →
   absurd scientific notation).

This persists across reloads because it mutates the server's `RAW_PROPERTIES` array directly
(shared in-memory state, with no "reset").

**FIXED (step 1, data normalization):** the properties/update route no longer writes income into
`currentValue`. Added `monthlyIncomeOverride?: number` to `RawPropertyRow`
(`src/data/mockProperties.ts`) and income persists there; `getMonthlyIncome()` in `normalize.ts`
prefers it over the summed transactions. Both fields are also parsed with `Number(...)` before
being stored (see bug 8), so the "bonus" string-concatenation in Avg. Property Value can no
longer happen for data written from now on.

## 8.
Quick Edit validates nothing, client- or server-side: I typed "abc" into "Current Value" and it
saved anyway (alert "saved!", 200 OK). The property ends up with `currentValue = "abc"` (a
non-numeric string) persisted. Visible effect: on `/property/prop-004` the "12mo trend" flipped
from ↑ to ↓ purely because of this (the server's ROI, `(value - purchase)/purchase`, is `NaN`
with "abc" and decides "down" because `NaN >= 0` is false). There is no "invalid value" message
at any point.

**PARTIALLY FIXED (step 1, server side):** the properties/update route now does
`Number(body.value)`/`Number(body.income)` and responds 400
`{ok:false, reason:"invalid value"|"invalid income"}` if the result isn't finite, instead of
persisting the string as-is.

**FIXED (step 3, client side):** `property/[id]/page.tsx` now checks `res.ok`/`body.ok` on the
PATCH response and shows the server's `reason` on screen (see bug 15) instead of assuming
success. It still doesn't validate the input BEFORE sending it (you could still send "abc" and
see the server's error message after the request, rather than the field being marked invalid
immediately) — in-input form validation is out of scope, it's a UX improvement rather than a
data bug.

**FINAL STATE (final review):** the inputs are now `type="number"` with `inputMode="decimal"`,
so the browser blocks non-numeric typing, and empty submits are rejected locally. Non-numeric
input reaching the API by other means (paste, direct request) is still rejected server-side with
a 400 and a reason the UI displays — see bug 27 for the hardened validation.

## 9.
On `/property/[id]`, "Monthly Expenses" and "Net Cashflow" can show a number that looks valid but
is entirely made up, instead of a visible error. Example with prop-004 (Riverside Cottage),
always reproducible (not random):

```
GET /api/property-details?property_id=prop-004 =>
{
  "property": {
    "purchase": 240000,
    "value_now": 267000,
    "rent": 1900,
    "costs": null,   <- this should be a number
    ...
  }
}
```

On screen:
```
Monthly Expenses: $0
Net Cashflow: $-238100.00   <- this is NOT 1900 - 0
```

What happens: internally `costs` is `NaN` (from the same broken txn-012 above), but
`NextResponse.json()`/`JSON.stringify` turns `NaN` into `null` in the JSON (so you don't even
see the NaN, you see null). The front end computes
`cashflow = (detail?.rent || 0) - (detail?.costs || detail?.purchase || 0)`, and since `costs` is
null (falsy) it falls through to the `detail?.purchase` fallback (240000) as if that were the
monthly expense. Result: Net Cashflow = 1900 − 240000 = −238100, a number that looks real but is
completely false, with no visual indication that anything failed.

**PARTIALLY FIXED (step 1, data normalization):** the root cause (`NaN` from `Number("N/A")` in
txn-012, which `JSON.stringify` then turned into null) is fixed at source by the same NaN-safe
`sumTransactions()` from bug 4 — `monthlyExpenses` (formerly `costs`) for prop-004 is no longer
`NaN`/`null`, it's 780 (a real number). The component's logic bug remains:
`(detail?.monthlyExpenses || detail?.purchasePrice || 0)` still falls through to the purchase
price as the "monthly expense" for ANY property with 0 real expenses (e.g. prop-006, which has
no transactions) because `0` is falsy. That fallback lives in `property/[id]/page.tsx` and
fixing it (dropping the `|| detail?.purchasePrice`) is component logic, outside step 1's scope —
deferred to step 4 (logic bugs) of the AGENDA.

**FIXED (final review):** step 4 was closed without ever doing this, so the fallback stayed live
until the final review. Confirmed in the browser before the fix, on `/property/prop-006`:
"Monthly Income $0.00 / Monthly Expenses $0.00 / **Net Cashflow $-95,000.00**" (and −$410,000 on
prop-005, same cause). Now
`cashflow = (detail?.monthlyIncome ?? 0) - (detail?.monthlyExpenses ?? 0)`: `??` instead of `||`,
so a legitimate 0 counts as 0 rather than as "no data, use the purchase price". Verified after
the fix: prop-006 shows "Net Cashflow $0.00". Added a regression test in `normalize.test.ts`
("reports zero, not a fallback, for a property with no transactions") for the data half, and the
component guard is covered by the `||` → `??` change.

## 10.
`GET /api/properties/list` fails ~10% of the time (random 500, seen several times reloading
"/"). When it fails, the properties section ends up like this, with no visible error:

```
Your Properties (0)
```

...but the Summary above still shows the old/aggregate Total Worth (e.g. "$22260000.00"),
because it comes from a different endpoint that did succeed. So: the screen says "you have $22
million in properties" and "Your Properties (0)" at the same time, with no error message and no
retry button.

Console: `[ERROR] Failed to load resource: the server responded with a status of 500 (Internal Server Error) @ http://localhost:3000/api/properties/list:0`
Network: `GET http://localhost:3000/api/properties/list => 500 Internal Server Error`

Cause: the properties fetch's `.catch` only does `console.log(err)`, `properties` stays as the
initial `[]`, and there is no error state.

**FIXED (step 6, resilience):** new `propertiesStatus: "loading"|"error"|"ready"` state. The
fetch checks `response.ok`; on failure a red band shows "Couldn't load your properties." with a
"Retry" button (which bumps a `reloadPropertiesToken` that the `useEffect` has in its deps, so
no page reload). Verified with Playwright by forcing a 500: the message + Retry appear, and once
the failure is removed, pressing Retry brings up the list of 6 properties without a reload. The
"focus" listener and the underlying problem of the Summary being out of sync with the list (a UX
bug, not a data one) are unchanged — only the initial load was covered, which is where the
documented bug lived.

## 11.
`/property/never` crashes ALWAYS (100% reproducible, not random). Blank screen + Next.js
overlay:

```
Runtime TypeError
Cannot read properties of undefined (reading 'trend')
src/app/property/[id]/page.tsx (60:45) @ PropertyDetailPage

> 60 | const trendLabel = detail && detail.stats.trend.direction;
```

Console:
```
TypeError: Cannot read properties of undefined (reading 'trend')
    at PropertyDetailPage (http://localhost:3000/_next/static/chunks/_a92b4703._.js:86:47)
    at Object.react_stack_bottom_frame (...)
    ... (full react-dom stack, trimmed)
```

Network:
```
GET http://localhost:3000/api/property-details?property_id=never => 404 Not Found
GET http://localhost:3000/api/legacy/portfolio => 200 OK
```

Cause: for `propertyId === "never"` the code requests `/api/legacy/portfolio` and does
`setDetail(d.result.assets[0])`. That endpoint returns a completely different shape
(`{uuid, label, addr, boughtFor, worth}`) with NO `"stats"` at all. `detail` ends up truthy but
without `.stats`, and `detail.stats.trend` blows up during render. The whole page dies (there is
no error boundary), not just that line.

**PARTIALLY FIXED (step 3, hooks):** the underlying race condition (the original code requested
property-details AND legacy/portfolio simultaneously for `propertyId === "never"`, and whichever
answered last overwrote the other's `setDetail` — which is why the crash wasn't strictly
"non-random", it depended on which fetch won) is fixed: it's now an `if/else`, only one endpoint
is requested depending on the id, with an `ignore` flag in the cleanup to discard late responses
if the id changes again before it resolves. The crash itself (the incomplete
`detail.stats.trend` guard) is deliberately untouched — it's still a step 4 logic bug in the
AGENDA, not a hooks one.

**FIXED (step 4, logic bugs):** `detail.stats!.trend.direction` →
`detail?.stats?.trend.direction ?? null`, with the "12mo trend" showing "N/A" when there are no
stats instead of assuming "↓". `/property/never` no longer crashes. As a bonus, this same
incomplete guard also crashed on any property with `analytics: null` (e.g. prop-006, Lakeview
Studio) — not just the "never" case this bug documented; verified that it no longer crashes
there either ("12mo trend: N/A").

Important: fixing the guard does NOT fix the underlying "never" problem — it still requests
`/api/legacy/portfolio` (an endpoint with a totally different shape, intended for another
consumer) for an id that doesn't exist. Without the crash, you now get silent garbage: title
stuck on "Loading property...", "Current Value: $NaN", "ROI: NaN%". In other words, it went from
"visibly broken page" to "page with fake data and no warning" — the same pattern as bug 9. The
"never" special case is itself a test/debug hook with no product purpose (no real id will ever
be "never"); I didn't remove it because no AGENDA step called for it, but it probably shouldn't
exist in the final code.

**FULLY FIXED (final review):** the entire `propertyId === "never"` branch is gone. I first
confirmed in the browser that the "silent garbage" was still live exactly as described (title
"Loading property...", "Current Value $NaN", "ROI NaN%"). With the branch removed, "never" is
simply an id that doesn't exist and falls into the normal flow: `/property/never` shows
"Property not found" + a back button, like any other non-existent id (bug 14). This also removes
the `as PropertyDetail` cast that was needed to force the legacy shape into the real interface —
that was an `any` in disguise, exactly what `CLAUDE.md` forbids, and it was the mechanical cause
of the NaNs. `/api/legacy/portfolio` still exists untouched (a contract for its external
consumer), this page just no longer consumes it.

## 12.
Data discrepancy between Home and Detail for the SAME property: on home, a property card's
"Current Value" is the real value (`currentValue`/`market_value`). On `/property/[id]`, the
"Current Value" row shows the PURCHASE PRICE, not the current value — always, for every
property, because `headerValue = detail?.purchase ?? detail?.value_now` never falls through to
the second operand (`purchase` always has a value).

Example with Sunset Apartments Unit 4B (prop-001), before touching Quick Edit:
```
Home:                                $215.000   (real currentValue)
/property/prop-001 "Current Value":  $185000.00 (== Purchase Price, not the real currentValue)
```

**FIXED (step 4, logic bugs):** `headerValue = detail?.purchasePrice ?? detail?.currentValue` →
`detail?.currentValue ?? detail?.purchasePrice` (operands swapped). Verified on prop-001:
"Current Value" now shows $215000.00 (matching home), "Purchase Price" stays at $185000.00 (a
separate, correct row). As a bonus, ROI went from always returning 0.0% (because it subtracted
`purchasePrice` from itself) to actually computing: 16.2% on prop-001.

## 13.
The "page refresh counter" on `/property/[id]` stays stuck at "1" forever (I tested waiting a
real 5s with `browser_wait_for`). It doesn't go to 2, 3, etc. even though the `setInterval` fires
every second. It's the same stale-closure pattern as home's `refreshCount` (already noted in
`AGENDA.md` at the code level), but here it's confirmed at runtime: the counter is visibly broken
on screen, not just an implementation detail.

**FIXED (step 3, hooks):** removed entirely (the interval, the `tick` state and the "page refresh
counter" paragraph) rather than repaired — the code itself flagged it with "(dont ask why this
exists)" and it fed nothing else on the page; `AGENDA.md` already said "remove" for this timer,
not "fix the stale closure". The real stale-closure pattern (`setRefreshCount(refreshCount + 1)`
on home) *was* fixed with the functional form, because that counter is displayed intentionally
("auto-refresh count").

## 14.
With a non-existent but "normal" property id (e.g. `/property/does-not-exist`), the page stays on
"Loading property..." FOREVER with every financial field at $0, with no error message and no way
to tell that the id doesn't exist. The fetch to `/api/property-details` returns 404 (or, ~30% of
the time, a 200 with `{property:null,status:"not_found"}`), but since there's no `.catch` and no
status check, `detail` simply never gets populated and the UI is indistinguishable from "still
loading".

Network (404 case):
`GET http://localhost:3000/api/property-details?property_id=does-not-exist => 404 Not Found`
Console:
`[ERROR] Failed to load resource: the server responded with a status of 404 (Not Found) @ http://localhost:3000/api/property-details?property_id=does-not-exist:0`

**FIXED (step 6, resilience):** new `detailStatus: "loading"|"not_found"|"error"|"ready"` state.
The fetch treats both the 404 AND the 200 `{property:null}` as the same "not_found" case (not as
a network error); any other failure (`!ok` status or an exception) is "error". The title becomes
"Property not found" or "Couldn't load this property" as appropriate, with a "Back to portfolio"
button for the not_found case, and the "Financial Overview"/"Quick Edit" sections no longer
render at all without a real `detail` (previously they showed $0 in every field, giving the false
impression of a valid property with zero values). Verified in the browser:
`/property/does-not-exist` now shows "Property not found" instead of sitting on "Loading
property..." forever.

## 15.
Minor detail: the Quick Edit "Save Changes" button always shows `alert("saved!")` even when
nothing has been typed into either field (the PATCH request is sent anyway with just
`{id: propertyId}`, no value and no income). There's no way to know whether anything was actually
saved.

**FIXED (step 3, hooks / CLAUDE.md "no window.alert"):** removed the `alert("saved!")`. The
handler now checks `res.ok` and `body.ok` on the response and stores the result in a `saveStatus`
state, rendered as text under the button ("Saved." in green, or the server's `reason` in red on
failure/invalid value). It still sends the PATCH even when no field was touched (that's separate
behaviour, not covered by this bug — the on-screen message at least now reflects whether the
server actually accepted the change).

**REMAINDER FIXED (final review):** pressing "Save Changes" with both fields empty no longer
sends a PATCH at all; it reports "Nothing to save - fill in a field first." locally. See bug 28.

---

## Bugs found during step 1 (data normalization)

## 16.
*[NEW — found reading properties/list route.ts during step 1]* The soft-deleted property
"prop-002-dup" (Oak Street Duplex, `is_active: 0`, a duplicate of prop-002) wasn't filtered out
in any aggregator: it appeared in "Your Properties" as a duplicate entry, and its
`currentValue`/`purchasePrice` were summed into Total Worth / Total Invested / Avg. Property
Value alongside the active original. The code itself flagged this with a
`// NOTE: doesn't filter is_active/activo` comment, but it was never actually fixed.

**FIXED (step 1):** `getActiveProperties()` in `src/data/normalize.ts` filters on
`is_active`/`activo` (defaulting to "active" if neither field is present) before normalizing.
properties/list, portfolio-summary and legacy/portfolio all use it, so the filtering is
consistent across the three.

## 17.
*[NEW — found reading legacy/portfolio route.ts during step 1]* That endpoint read
`p.currentValue`/`p.purchasePrice`/`p.name`/`p.address`/`p.id` directly off `RAW_PROPERTIES`,
completely ignoring the Spain-system synonyms (`valor_actual`, `precio_compra`, `nombre`,
`direccion`/`ciudad`, `property_id`). Properties PROP-002 (Oak Street Duplex) and PROP-005
(Harbor View Condo) — both entered with Spanish fields only — came back as
`{uuid: undefined, label: undefined, addr: undefined, boughtFor: undefined, worth: undefined}`,
and their value wasn't summed into `netWorth`. This wasn't caught by any earlier repro because
the endpoint's only current consumer (the `propertyId === "never"` fallback in
`property/[id]/page.tsx`) only reads `assets[0]`, which always resolves to prop-001 (a US-system
row, without this problem).

**FIXED (step 1):** legacy/portfolio now builds `assets`/`netWorth` from `getActiveProperties()`
(the same normalized data as every other endpoint), keeping the legacy output contract
(`uuid/label/addr/boughtFor/worth`) unchanged so as not to break the current consumer.

## 18.
*[NEW — found reading property/[id]/page.tsx during step 1; not fixing it, it's a product gap
rather than a naming one]* "Cash-on-Cash Return" on `/property/[id]` always shows "NaN%":
`cashOnCash = ((cashflow * 12) / detail?.downPayment) * 100` uses `detail?.downPayment`, a field
that doesn't exist in any `RAW_*` or any endpoint — there is no "down payment" concept modelled
in the data at all. Unlike `purchase`/`purchasePrice` (a naming bug — same data, different name),
here there simply is no data to normalize: it would need a product decision about what "down
payment" means in this domain (a fixed %? a new per-property field?) before it could be computed.
Logged as a known limitation for the write-up.

*(See bug 22: the product gap is still open, but it no longer manifests as "NaN%" on screen.)*

## 19.
*[NEW — found reading portfolio-summary route.ts during step 1; not fixing it, there's no data
source]* The aggregate Total Worth / Total Invested / Monthly Cashflow sum
`currentValue`/`purchasePrice`/transactions across USD and EUR properties (prop-004 is EUR, the
rest USD) as if they were the same unit, with no currency conversion. There is no exchange-rate
table in `mockProperties.ts` or anywhere else in the project. Home's currency selector (bug 5)
doesn't solve it either, because it only formats with a different symbol, it doesn't convert the
numeric value. Known limitation — needs an FX rate source that doesn't exist today, logged for
the write-up.

## 20.
*[NEW — found in page.tsx (PropertyCard) during step 2, while typing props]* The "$xxx/sqft" on
each property card on home isn't a real price per square foot: `props.squareFeet` doesn't exist
in any `RAW_*`, endpoint or interface — floor area has never been modelled anywhere in the
project. The code always falls through to the `props.squareFeet || 1` fallback, so that number is
literally the property's total price again with "/sqft" glued on beside it (e.g. "$215.000/sqft"
on Sunset Apartments, an ordinary flat, not 215,000 per square foot). Typing `PropertyCardProps`
made it explicit: `squareFeet?: number` is optional because it never arrives today, not as a UI
choice. Not fixing it here (removing the line or the logic is a render change, outside the scope
of typing); it needs a product decision (add `squareFeet` to the data, or drop the figure from
the card?).

**FIXED in the final review — see bug 26.**

---

## Bugs found in the final review (full review of the diff against main)

## 21.
*[NEW — found reviewing PropertyCard in the final review]* Each home card's net cashflow was
ALWAYS rendered with a "+" in front and ALWAYS in green (`text-emerald-600`), regardless of sign.
Confirmed in the browser with Downtown Loft (prop-003: income 3200, expenses 1850+1850=3700, net
−500):

```
Actual:   "+$-500/mo" in green
Expected: "-$500/mo" in red
```

Two problems: the hardcoded "+" prefix and the hardcoded colour. On top of that, `formatMoney`
put the sign AFTER the symbol ("$-500"), which is wrong in every locale.

**FIXED (final review):** `formatMoney` now puts the sign before the symbol (`-$500`), and
PropertyCard picks the prefix ("+" only when > 0) and the colour (red when < 0, green otherwise)
from the actual sign. Verified in the browser: Downtown Loft shows "-$500/mo" with class
`text-red-600`. Covered by a test in `src/lib/format.test.ts`.

## 22.
*[NEW — final review]* "Cash-on-Cash Return: NaN%" was still being printed literally on screen
for EVERY property (a known consequence of bug 18: `downPayment` doesn't exist in the data
model). Bug 18 documented the cause, but nobody decided what to render while there's no data:
"NaN%" is exactly the kind of visible garbage the rest of the refactor was dedicated to
eliminating. The same latent risk existed in ROI if `purchasePrice` were 0 (division by zero).

**FIXED (final review):** new `formatPercent()` in `src/lib/format.ts` returning "N/A" for
null/NaN/Infinity, used for both ROI and Cash-on-Cash. `cashOnCash` is explicitly `null` while
`downPayment` doesn't exist, and `roi` is `null` when the purchase price is 0, rather than
letting the NaN reach the render. Verified: prop-006 shows "Cash-on-Cash Return: N/A" instead of
"NaN%". Bug 18's product gap is still open (the data still isn't modelled), but it no longer
shows up as garbage on screen.

## 23.
*[NEW — final review]* The Summary's "In Loss" counter counted as a loss any property that wasn't
strictly in profit, including those sitting at exactly 0. `propertiesInLoss` was computed as
`properties.length - positiveCount`, with `positiveCount` filtering on `> 0`.

Confirmed in the browser: "In Profit: 3 / In Loss: 3" when only ONE property (Downtown Loft,
−500) is actually negative. The other two "losses" were prop-005 and prop-006, both with net
cashflow of exactly 0 (they have no transactions).

**FIXED (final review):** the two counters are computed independently (`> 0` and `< 0`), so a
break-even property falls into neither bucket and the figures no longer have to add up to the
total. Verified: "In Profit: 3 / In Loss: 1".

## 24.
*[NEW — final review]* The home detail modal was unreachable code. `handleClick` did
`setSelectedProperty(p)` + `setShowDetailModal(true)` and IMMEDIATELY AFTER
`router.push("/property/" + id)`: the navigation unmounts Home, so the modal is never seen.
Verified with a real click on a card: the URL becomes `/property/prop-003` and
`document.querySelector('div.fixed.inset-0')` is null throughout.

That was ~64 lines of JSX plus the `showDetailModal`/`selectedProperty` states, the `isSelected`
prop with its selection styling, and the `getAddr` accessor (used only by the modal). None of
those pieces had any way to execute.

**FIXED (final review):** deleted the whole modal and everything that existed only to feed it.
Clicking a card now only navigates. The card went from `div onClick` to `<button>`, which also
fixes it not being keyboard-accessible.

## 25.
*[NEW — final review]* The `getPropName/getVal/getIncome/getExpenses/getId` accessors in
`page.tsx` had become identity functions (`return p.name`) after step 1: they were the US/Spain
system synonym resolvers, and `normalize.ts` replaced them. They were left as indirection with no
value. `getYield` on top of that was called by nobody — it was the repo's only `npm run lint`
warning.

Other leftovers from the original code in the same area: `Number(portfolio?.totalWorth) + 0` (the
`+ 0` is junk and the `Number()` is redundant now that `Portfolio` is typed), `gainPercent`
recomputed client-side when the API already returns `gainLossPercent` (two sources of truth for
the same number), and a `console.log("portfolio fetch failed lol", err)`.

**FIXED (final review):** accessors and `getYield` gone; the component reads the normalized
fields directly. `Gain / Loss` uses the server's `portfolio.gainLossPercent`. Error `console.log`
calls became `console.error`. `npm run lint` is at 0 warnings.

## 26.
*[NEW — final review]* Bug 20's "$xxx/sqft" was still on screen showing the property's total
price with "/sqft" glued on (e.g. "$215,000/sqft" for a flat). Bug 20 documented it and left it
as a "product decision".

**FIXED (final review):** line removed. Between showing a number we know is wrong and showing
nothing, nothing is correct; adding `squareFeet` to the data *is* a product decision, but
continuing to print the total price labelled as a price per square foot isn't a decision, it's a
bug on screen. If floor area gets modelled later, the line comes back with real data behind it.

## 27.
*[NEW — final review]* `PATCH /api/properties/update` accepted unvalidated input in several
ways: `await request.json()` with no try/catch (a malformed body throws → unhandled 500),
`body.id` never checked, and the "property doesn't exist" case responded
`{ok:false, reason:"not found"}` with **HTTP 200**. The `as UpdatePropertyBody` cast over
untrusted input was a lie to the type system.

**FIXED (final review):** body typed as `unknown` and validated field by field; malformed JSON →
400 "malformed request body"; missing id → 400 "missing id"; PATCH with no fields → 400 "nothing
to update"; non-existent id → **404** "not found". Verified all six paths with curl
(400/400/400/400/404/200). A schema (zod) would be the next step if this grew; for three fields
hand-rolled validation reads better than the dependency.

## 28.
*[NEW — final review]* Quick Edit said "Saved." and left the figures above it showing the OLD
values until a manual reload: the PATCH triggered no refetch of the detail. Immediately after the
app's only write action, the screen contradicted the database.

**FIXED (final review):** a successful save bumps a `reloadToken` that's in the fetch effect's
deps, so the detail is requested again and the screen reflects what was stored (the cleanup's
`ignore` flag already covered out-of-order responses). Verified in the browser with prop-001:
saving value=999000 and income=5000 together, the screen moves to "Current Value $999,000.00" and
"Monthly Income $5,000.00" without a reload, with Net Cashflow and ROI recomputed — which also
confirms bug 7 ("last field wins") is still fixed, since both fields persist at once.
Additionally, pressing "Save Changes" with both fields empty no longer sends any PATCH: it
reports "Nothing to save - fill in a field first." (the remainder of bug 15).

---

## Bugs found in the code review of `src/` (step 8)

## 29.
*[NEW — code review]* The whole detail page formatted money with the default `$`, ignoring the
property's own currency. `normalizeProperty` computes `currency` correctly, but
`PropertyDetail` never declared the field and `property-details/route.ts` never sent it, so the
page had nothing to format with and `formatMoney(row.value)` fell back to USD.

Confirmed in the browser on `/property/prop-004` (Riverside Cottage, `currency: "EUR"`):

```
Actual:   Purchase Price $240,000.00   Current Value $267,000.00
Expected: Purchase Price €240,000.00   Current Value €267,000.00
```

This is bug 5's exact pattern surviving in a second place: that fix threaded
`displayCurrency` down to the home cards and nobody checked whether the detail page had the
same problem. Note home and detail answer different questions — home applies a global *display*
currency selector across mixed-currency properties, while detail shows a single property and so
should use *that property's* currency. There's no selector on the detail page, which is why the
bug was invisible.

**FIXED (step 8):** `currency` added to `PropertyDetail`, populated by the route from the
already-normalized value, and the detail page formats every figure through one local `money()`
helper bound to `detail.currency`. Verified in the browser: prop-004 renders `€` throughout
(including Net Cashflow), prop-001 still renders `$`. The API payload now carries
`"currency":"EUR"`. Still no FX conversion — this is about naming the unit correctly, not
converting it (bug 19 remains open).

## 30.
*[NEW — code review]* `parseOptionalAmount` — added in the *previous* pass specifically to
harden this endpoint (bug 27) — leaned on `Number()` and so accepted several kinds of garbage:

| Input | `Number()` gives | Result before the fix |
|---|---|---|
| `{"value":"  "}` | `0` | 200 OK, property zeroed to $0 (ROI −100%) |
| `{"value":"0x1f"}` | `31` | 200 OK, property worth $31 |
| `{"value":"1e3"}` | `1000` | 200 OK, silently reinterpreted |
| `{"value":-5000}` | `-5000` | 200 OK, negative value poisoning every aggregate |

The whitespace case is the worst of them: `"  "` isn't `""`, so it slipped past the empty check,
and `Number("  ")` is `0`, which is a perfectly finite number — a single stray space wipes a
property's value with a success response.

**FIXED (step 8):** a `/^\d+(\.\d+)?$/` test replaces the bare `Number()` coercion — a money
field holds a plain decimal, not hex or scientific notation — plus an explicit `>= 0` check,
since neither a property value nor a monthly income can be negative. Verified with curl: all
six garbage inputs above now return `400` with `invalid value`/`invalid income`, while `250000`,
`"250000.50"` and a legitimate `0` still return `200`.

## 31.
*[NEW — code review]* The zero-purchase-price guard was added to the detail page in the previous
pass (bug 22) but not to the server, which computed the same expression independently:
`((currentValue - purchasePrice) / purchasePrice) * 100`. With `purchasePrice: 0` that's
`Infinity` (or `NaN`), and `JSON.stringify` turns both into `null` — so the route would emit
`"roi": null` in violation of its own `PropertyStats.roi: number` contract. Worse,
`trend: { direction: roi >= 0 ? "up" : "down" }` fabricates a direction, because `NaN >= 0` is
`false` → a confident "↓" arrow derived from nothing. That arrow is rendered by the page.

Not reproducible against the current fixtures (no property has a purchase price of 0) — found by
reading the route against the client fix, and reachable through any data source that allows one.

**FIXED (step 8):** the calculation moved into `src/lib/metrics.ts` (`calculateRoi`), a pure
module with no data-layer imports, used by **both** the route and the page — so there is exactly
one definition and they can't diverge again. It returns `null` for a zero or non-finite purchase
price; the route then emits `stats: null` rather than a fabricated trend, and the page renders
"N/A" for both ROI and the arrow. Covered by unit tests in `src/lib/metrics.test.ts` (9 tests,
including the zero and NaN paths) since the browser can't reach it with the current fixtures.

This is the root-cause version of bug 22, which only patched the render.

## 32.
*[NEW — code review]* The detail fetch's `.catch` set `detailStatus = "error"` but never cleared
`detail`, so the error panel rendered *alongside* the last-known figures. After a failed
post-save refetch that produced three mutually contradictory statements on one screen: a red
"Something went wrong loading this property", the pre-save numbers, and a green "Saved.".

Which is precisely the contradiction bug 28 was written to remove — the refetch introduced there
created a new path into the same class of problem.

**FIXED (step 8):** the `.catch` now clears `detail` as well, so an error state shows the error
and nothing else (the Quick Edit and Financial Overview sections are already gated on `detail`,
so the stale figures and the "Saved." badge both disappear with it). Verified in the browser by
monkey-patching `window.fetch` to reject only `property-details` requests, then saving: the page
shows just "Couldn't load this property", with `stillShowsSavedBadge`, `stillShowsStaleFigures`
and `stillShowsQuickEdit` all false. Reloading afterwards confirms the write itself succeeded
($777,000 persisted) and the page recovers — the failure is presentational, not lost data.

Trade-off: a transient blip now costs the user the figures they were reading, rather than
showing them next to a warning. Showing possibly-stale numbers with a clear "couldn't refresh"
marker would be better UX; that's a bigger change than this fix, and silently-wrong beats
briefly-empty is the wrong trade in a financial view.

---

## Bugs found reviewing the finished work (step 9)

## 33.
*[NEW — review of the finished work]* `/api/v1/user/portfolio-summary` computed
`gainLossPercent: ((totalValue - totalPurchase) / totalPurchase) * 100` inline — the same formula
as `calculateRoi`, which exists precisely so that no metric has two definitions. It was the one
metric that never got routed through `src/lib/metrics.ts`.

Two consequences, one latent and one live:

- With no active properties, `totalPurchase` is 0 and the expression is `0/0` → `NaN`.
  `JSON.stringify` serializes `NaN` as `null`, so the client receives `gainLossPercent: null`
  under a declared type of `number`. `formatPercent` renders "N/A" and nothing looks wrong on
  screen, which is exactly why it survived — the type was lying and the UI was covering for it.
  This is the same shape as bug 31, in the one place bug 31's fix didn't reach.
- Structurally it's the fourth instance of the mistake steps 7 and 8 were about: the module
  written to prevent drift was bypassed by the metric it was written for.

**FIXED (step 9):** the route now calls `calculateRoi(totalValue, totalPurchase)`, and
`Portfolio.gainLossPercent` is `number | null` — the type the wire could always produce. The
existing `calculateRoi(0, 0) === null` test already covers the empty-portfolio path. Verified
against the running server: `{"gainLossPercent":6.534090909090909,...}` for the real fixtures,
matching `(1875000 - 1760000) / 1760000 * 100`, and unchanged rendering on the page.

## 34.
*[NEW — review of the finished work]* Asked for an id that doesn't exist, `/api/property-details`
returned a 200 with `{property:null, status:"not_found"}` about 30% of the time and a 404 the
rest — chosen by `Math.random()`. Inherited from the starter and preserved through the refactor
because the client had been taught to handle both (bug 14), which is how it stopped looking odd.

But this one is not failure injection: it's an endpoint answering the same question two different
ways for no reason, and no amount of client tolerance makes that a contract. It also meant the
404 path could not be tested deterministically.

**FIXED (step 9):** a missing property is now always a 404. The client keeps accepting both
shapes — that tolerance is now defensive rather than load-bearing, since nothing emits the 200
form any more. Verified: 5 consecutive requests for `does-not-exist` returned `404 404 404 404
404`, where the same probe previously mixed in 200s.

## 35.
*[NEW — reported by Iñigo]* The "Show cents" checkbox governs one third of the screen. With it
unchecked, the same property renders two different ways one click apart:

```
Home, summary block:   Total Worth   $1,875,000      <- respects the toggle
Home, property card:   prop-003      $495,000        <- always without cents
Detail, prop-003:      Current Value $495,000.00     <- always WITH cents
```

Verified in the browser at both settings: the summary alternates between `$1,875,000.00` and
`$1,875,000`, while the card stays `$495,000` and the detail row stays `$495,000.00` throughout.

Three behaviours for one preference, from two different causes. `PropertyCard` hardcodes
`showCents: false`, which was already logged as knowingly left. The detail page is the part that
was never noticed: it never receives the preference at all, and `formatMoney` defaults
`showCents` to `true`, so it opts into the *opposite* of the card it was opened from.

The root cause is not a forgotten prop. `showCents` is `useState` inside the home page's client
component, and `/property/[id]` is a different route — there is nowhere for a display preference
to live that both can read. Fixing it properly means lifting it (a context in the layout, backed
by `localStorage`, or a query param), not threading an argument.

Worth separating from its neighbour: `displayCurrency` also stops at the route boundary, and that
one **is** deliberate (bug 29) — a EUR property must not be drawn in `$` because home happens to
be set to dollars, since currency is an attribute of the property. That argument does not carry
over to cents, which are pure presentation and mean the same thing on every screen.

**FIXED:** `src/lib/displayPreferences.tsx` — a client context mounted in the root layout,
holding `showCents` and `displayCurrency` and persisted to `localStorage`. Home reads its toolbar
from it instead of local `useState` and passes `showCents` down to `PropertyCard`; the detail page
reads `showCents` from it too.

The currency deliberately does **not** cross: the detail page keeps drawing each figure in
`detail.currency`. The context documents that at the field, since the obvious "improvement" for
the next reader is to wire `displayCurrency` in there and quietly reintroduce bug 29.

To avoid a hydration mismatch, the provider renders `DEFAULTS` on the server and on the first
client render, then reads storage in an effect; a second effect persists changes and is guarded
on a `hydrated` flag, or its first run would write the defaults over the value about to be read.

Verified in the browser in both directions. With cents off, `prop-003` reads `$495,000` in the
summary, on the card and on the detail page — previously `$495,000` on the card and
`$495,000.00` one click later. With cents on, all three read `$495,000.00`. The preference
survives a reload (`{"displayCurrency":"USD","showCents":false}` in `localStorage`, checkbox
still unchecked). `prop-004` still renders `€240,000 / €267,000` on its detail page with the
selector on USD, so bug 29 has not regressed. No hydration warning in the console.
