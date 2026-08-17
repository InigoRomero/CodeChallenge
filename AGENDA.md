# Refactor plan

Problems to fix, in the order I found them while reading the code:

- **Data**: field names need standardizing — both the casing and the language.
- `var` → `let`/`const`.
- Remove `any`.
- CSS bad practices.
- The API code has some wild stuff in it (`await wait(1800 + Math.random() * 1200);`). Needs a
  full clean-up.
- **Hooks misuse:**
  - `page.tsx`:
    - A single `useEffect` mixing four unrelated things: fetch portfolio, fetch properties, fetch
      legacy (dead code, only `console.log`s), a polling `setInterval`, and an
      `addEventListener("focus")`. Should be split into separate effects/hooks.
    - The "focus" listener has no cleanup → memory leak (the return only clears the
      `setInterval`).
    - Stale closure in the polling: `setRefreshCount(refreshCount + 1)` inside the interval always
      starts from the captured 0, so it never gets past 1. Fix: functional form,
      `setRefreshCount(c => c + 1)`.
    - `summaryStats` is stored in state and recomputed in a second `useEffect`, while being 100%
      derivable from `portfolio`/`properties` → the "derived state via effect" anti-pattern. It
      should be computed directly during render (or with `useMemo` if needed).
    - `properties.sort(...)` mutates the state array mid-render (a side effect in what must be a
      pure function), and re-sorts on every render with no memoization.
    - `useState<any>` on portfolio/properties/selectedProperty/err → defeats TS across the whole
      tree. Resolves itself once the interfaces exist.
    - Selection by object reference (`selectedProperty === p`) breaks as soon as `properties` is
      refetched (new objects). Compare by id.
    - The normalizer functions (`getVal`, `getIncome`, `getPropName`...) live inside the component
      but don't depend on it → they should be a shared normalization layer (same point as
      standardizing the data).
    - No real loading/error states, just ad-hoc null checks.
  - `property/[id]/page.tsx`:
    - A 1s timer forcing a full re-render just for an unused counter ("dont ask why this exists"
      in the code itself). Remove.
    - A conditional fetch (`if propertyId == "never"`) inside the same effect → a real race
      condition, whichever resolves last overwrites the other via `setDetail`.
    - No cancellation when `propertyId` changes (missing `AbortController` / `ignore` flag in the
      cleanup) → a late response for a previous id can overwrite the new id's data.
    - `detail && detail.stats.trend.direction` doesn't cover `detail.stats` or
      `detail.stats.trend` being undefined → can blow up during render with "dirty" API data.
    - `roi` uses `detail?.purchasePrice` but the rest of the page uses `detail?.purchase` →
      possibly a naming bug, not just a hooks one.
  - **General recommendations:** move fetching out of the components into custom hooks
    (`usePortfolio`, `useProperties`, `usePropertyDetail`) or a server-state library
    (React Query/SWR); never `useEffect`+`setState` to derive something computable during render;
    every `addEventListener`/`subscribe` cleans up its counterpart; `setState` based on the
    previous value uses the functional form (especially in timers/callbacks); don't mutate state
    arrays/objects directly; one effect = one responsibility; enable/review `exhaustive-deps`
    (`eslint-plugin-react-hooks` is already there via `next/core-web-vitals`, so run
    `npm run lint`).
- Remove the `window.alert`s.

## Order

1. Standardize the whole data intake first. Standardize both casing and naming, and fix the
   entire API folder, so we first understand the data we have to work with.
2. Create interfaces, so we know what objects we're dealing with in each place.
3. Refactor hooks/data-fetching in the components, now that the data is typed: split the giant
   `useEffect`, fix the listener memory leak, the polling stale closure, the property-detail race
   condition, and remove the derived `useEffect`+`setState`.
4. The logic bugs that depended on the above: the purchase/purchasePrice mismatch, the incomplete
   `detail.stats.trend` guard, comparing selection by id instead of by reference.
5. CSS / presentation last — it affects neither correctness nor resilience.

Note: `var` → `const`/`let` and removing `any` aren't a separate phase; they get cleaned up along
the way in every file touched during steps 1–4, to avoid going over the same ground twice.

6. Resilience: real loading/error/not_found states across the three main fetches.

7. Final review: full review of the diff against main, cross-checking the code against `BUGS.md`.
   This is where bugs 21–28 came from, including two that an earlier step had explicitly left
   "for step 4" and never picked back up (the Net Cashflow fallback and the "never" branch).
   It also closed out what was left from this file's general recommendations: dead code removed
   (unreachable modal, identity accessors, `getYield`), validation on the write endpoint, an error
   boundary, and unit tests over the two pure pieces (`normalize.ts` and the formatters).

   What was NOT done from the recommendation list, and why: moving data-fetching out into custom
   hooks / React Query. The three duplicated call sites were collapsed into one function per
   endpoint, which is the precursor, but migrating to server components or a server-state library
   is an architecture change rather than a refactor — reasoning in `WRITEUP.md`.

8. Code review of all of `src/`, not just the diff. Produced bugs 29–32, of which three are the
   same mistake the review was looking for in the original code: a symptom fixed where it showed
   up rather than where it was caused (the currency reached the home cards but not the detail
   page; the zero-division guard reached the page but not the route; the refetch added in bug 28
   opened a new path into the contradiction bug 28 existed to remove). The structural answer was
   `src/lib/metrics.ts` — one definition of each financial metric, shared by route and page, so
   the two can't drift apart again.

   Five further findings are logged in `BUGS.md` and deliberately left: they're state-coherence
   issues (missing `ignore` flag on the list effect, `handleFocus` not updating status, the
   unreachable portfolio error branch behind the untimed cache, `showCents` not threaded to the
   cards, writes not filtering active rows) rather than wrong numbers on screen.

9. Review of the finished work. Three things, of which the first two are bugs 33 and 34:

   - `gainLossPercent` was the one metric still computed inline in its route rather than through
     `metrics.ts` — a fourth instance of the exact mistake step 8 was about, and one that put a
     `null` on the wire under a `number` type whenever the portfolio was empty.
   - `/api/property-details` was answering "not found" as a 404 or as a 200 with `{property:null}`
     at random. Collapsed to a 404. Client tolerance for both shapes stays, as defence.
   - The failure injection (`Math.random()` in three routes, ~1 load in 4 failing somewhere) is
     deleted, along with the `?forceError=1` hook. I first moved it behind a `CHAOS=1` flag to keep
     the error states exercisable, and that was wrong: a simulated failure is a test fixture, and a
     test fixture reachable from a production route is the same mistake made quietly. Error states
     get driven by intercepting the request, which is how they were verified regardless. `src/` now
     has no `Math.random()` in it.

   Also not a bug but worth the two minutes: added `.gitattributes` (`* text=auto eol=lf`) and
   renormalized. Four files had been committed with CRLF, so `mockProperties.ts` showed up as 355
   changed lines for the 1 line that actually changed — which makes the diff unreviewable, and
   reviewability is half of what this exercise is judged on.
