# Write-up

> **To see the failure states:** intercept the request. The starter's failure injection is gone
> (see below), so the way to drive an error state is to fail the call from outside — devtools
> offline, or request interception, which is how each one was verified.

## The main problem

Five independent layers were broken: inconsistent data (a US and a Spanish schema merged without
reconciliation — `id`/`property_id`, `currentValue`/`valor_actual` — resolved by a slightly
different `??` chain in every route); `any` everywhere; hooks misuse (one `useEffect` mixing two
fetches, a poll and a leaking focus listener, two stale-closure counters, derived state via
effect, a real race in the detail fetch); logic bugs downstream of those; and no loading or error
states at all.

Underneath all five was one recurring *class* of bug, and it's the one that matters: **the app
preferred a confident wrong number to an honest empty state.** One malformed transaction
(`amount: Number("N/A")`) became `NaN`, which `JSON.stringify` turns into `null`, which
downstream code read as "falsy → use this other field instead" — rendering a Net Cashflow of
`-$238,100` where the true answer was `$1,120`. Nothing looked broken. Almost every fix below is
really the same fix: make absence representable, then render it as absence.

## How I prioritized

Data → types → hooks → logic → formatting → resilience, because each layer's correctness assumes
the one before it. You can't type against field names that aren't consistent yet, or cleanly
split an effect around data whose shape you don't trust; the ROI and "Current Value" bugs were
only cleanly fixable once `purchase` and `purchasePrice` stopped being two different things in
the same file. Resilience came last on purpose — it's what users notice first, but building it
over shifting data would have meant redoing it.

## What changed

- **One normalization layer** (`src/data/normalize.ts`): field-synonym resolution, soft-delete
  filtering and NaN-safe transaction summing, replacing five divergent copies.
- **Real types** for what each endpoint returns. No `any`, no casts of untrusted input.
- **Hooks**: one responsibility per effect, listener leak fixed, functional `setState` in timers,
  derived state via `useMemo`, the detail race collapsed into a single cancellable fetch.
- **One definition per metric** (`src/lib/format.ts`, `src/lib/metrics.ts`). Money, percentages,
  ROI and net cashflow were each computed in two places — which is how the API ended up emitting
  `Infinity` for a case the page already guarded against.
- **Resilience**: `loading | error | ready | not_found` states with visible messages and a working
  Retry; an `error.tsx` boundary; validation on the write endpoint (400 with a reason the UI shows,
  404 for unknown ids); and a refetch after saving, so the screen can't disagree with the database.
- **Deletions**: an unreachable modal (it opened a modal *and* navigated away in the same handler),
  identity-function accessors made redundant by the normalization layer, a `/sqft` figure that was
  really the total price with a unit glued on, and a `"never"` debug hook — 97 net lines out of the
  two page components.
- **No randomness left in the API.** Three routes rolled dice on every request, failing about one
  load in four; a fourth, `/api/property-details`, answered "not found" as a 404 or as a 200 with
  `{property:null}` *at random*. All of it is gone, along with the `?forceError=1` hook. A
  deliberate 500 is a testing affordance, and testing affordances belong in the test, not in the
  route — the error states are driven by intercepting the request instead. The not-found case was
  never injection in the first place, just an undecided contract; it's now always a 404.
- **34 unit tests** over the pure modules, each naming the bug it pins down.

35 bugs, with repro steps and how each fix was verified, are in `BUGS.md`.

## What reviewing my own work caught

Afterwards I reviewed all of `src/`, not just my diff. Four more fixes came out of it — and three
were **the same mistake I'd spent the day criticising**: a symptom fixed where it was visible
rather than where it was caused. The currency fix reached the home cards but not the detail page,
so a EUR property rendered in `$`. The zero-division guard reached the page but not the route.
The refetch I added to remove a screen-versus-database contradiction opened a new path straight
back into it. Hence `metrics.ts`: when two places compute the same thing, eventually only one of
them gets fixed.

A last pass over the finished work found a fourth instance — in `metrics.ts` itself, so to speak.
`gainLossPercent` was still computed inline in its route: the same formula as `calculateRoi`, in
the one place the module written to prevent exactly that never reached. On an empty portfolio it
divided by zero, and `JSON.stringify` turns the resulting `NaN` into `null`, so the client got a
`null` under a declared `number` while the UI quietly rendered "N/A" and hid it. Writing the
abstraction is evidently not the same as adopting it, and the only reason I found this one is
that I went looking for the pattern rather than for bugs. Five lower-severity findings are logged
and deliberately left — state-coherence issues, none of which put a wrong number in front of a
user.

## Left alone, and trade-offs

- **No currency conversion.** The selector swaps the symbol only, as before. There's no FX source
  in the data, so portfolio totals still sum EUR and USD as one unit — a real limitation, not
  something formatting could paper over.
- **Cash-on-Cash and `/sqft`** depend on `downPayment` and `squareFeet`, which no endpoint models.
  I stopped them printing `NaN%` and a fabricated number; inventing the data is a product call.
- **Fetching stayed client-side.** Server components (or React Query) is the right answer, but the
  poll, focus-refresh and currency toggle all assume a client component — an architecture change
  rather than a refactor, and it would have eaten the budget. I collapsed the three duplicated call
  sites into one function per endpoint, so the migration is mechanical when it happens.
- **The mock database is still an in-memory singleton** the PATCH route mutates: writes survive
  neither a restart nor a second instance. Flagged at the mutation site, not solved.
- **I changed the sort to A→Z.** The original returned `-1` on `a > b`, which reads like a typo
  rather than a decision. Easy to revert.
- **The starter's simulated failure and latency are deleted, not configurable.** I first kept the
  failure rates behind an env flag, reasoning that the error states needed some way to be
  exercised. That was the wrong instinct: it's a test fixture, and keeping a test fixture reachable
  from production code is the thing itself, only quieter. The same goes for the `?forceError=1`
  query param and for `await wait(1800 + Math.random() * 1200)`. Failures belong in the test that
  needs them — every error state here was verified by intercepting the request.
- **`.gitattributes`, added late.** Four files had gone into the index with CRLF, so
  `mockProperties.ts` read as 355 changed lines for the 1 that changed. A diff nobody can read is
  a review nobody can give, which undoes a fair amount of the rest of this.
- **Verification was runtime-first**: every fix driven in the running app with Playwright,
  including forcing 500s and failed refetches through request interception.

## On AI usage

Claude Code, with the leverage in the setup rather than the prompting: a `CLAUDE.md` holding the
rules I actually wanted enforced, `AGENDA.md` and `BUGS.md` as working state under a rule that
findings get logged rather than silently patched, and the Playwright MCP for diagnosis. That last
one mattered most — the worst bugs here (`$NaN`, `-$95,000`, `+$-500` rendered in green) are
invisible in a page of source and obvious on the page itself. The deferred-then-forgotten cashflow
fallback was caught by re-reading my own diff against the log, which is the habit I'd keep
regardless of tooling.
