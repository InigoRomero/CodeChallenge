# CLAUDE.md

Working guide for this repo. It's the "Code Improvement Challenge" take-home (see
[README.md](README.md)): a Next.js app (PropHero, a real-estate portfolio) deliberately left in
bad shape, to be brought up to production quality in ~3-4h, with a final write-up explaining
priorities and decisions.

## Where the state of the work lives

- **[AGENDA.md](AGENDA.md)** — the refactor plan and its order, as the code gets diagnosed. It's
  the source of truth for "what's next".
- **[BUGS.md](BUGS.md)** — bugs confirmed at runtime (browser, console, network), numbered, with
  repro steps and cause. It was produced by exploring the real app, not just by reading code.

Before touching a file, check whether AGENDA.md or BUGS.md already says something about it.

## How we work the refactor

1. Follow the order set out in AGENDA.md (normalize data/API → interfaces/types → hooks and
   data-fetching → logic bugs that depended on those → CSS/presentation last). Don't skip phases
   because "we're already here", except for point 2.
2. **While refactoring a file for its planned reason, if any of the bugs listed in BUGS.md lives
   in that same file and can sensibly be fixed without straying from the current step's scope, fix
   it right there** instead of leaving it for a separate pass. Don't open new files just to hunt
   bugs from the list out of order — that breaks the agreed prioritization.
3. `var`→`const/let` and removing `any` aren't phases of their own: they get cleaned up along the
   way in every file touched (avoids going over the same ground twice).
4. When fixing a bug from BUGS.md, mark it resolved in that same file (the entry isn't deleted, a
   note is added about what was done) so the final write-up can be assembled straight from it.
5. Any new bug found while refactoring (not already on the list) gets added to BUGS.md in the same
   format as the existing ones — never silently fixed without a trace.

## Agreed code rules

- No `any`. Types come from the normalized interfaces in point 2 of AGENDA.md.
- No `var`.
- One `useEffect` = one responsibility. No mixing fetch + timers + listeners in the same effect.
- Never `useEffect` + `setState` to derive something computable directly during render (use a
  direct computation, or `useMemo` if needed).
- Don't mutate state arrays/objects directly (`.sort()`, in-place `.push()`) — copy first.
- Every `addEventListener`/`subscribe` cleans up its counterpart in the effect's cleanup.
- `setState` based on the previous value uses the functional form (`setX(prev => ...)`), especially
  in timers/callbacks.
- Fetches that depend on an id that can change need cancellation (`AbortController` or an `ignore`
  flag) to avoid race conditions.
- No `window.alert(...)` as UI feedback (related to BUGS.md #15) — use on-screen state.
- The data normalization layer (inconsistent field names across endpoints) is centralized, not
  reimplemented per component.

## Verification

- `npm run lint` before calling a step done (it already includes `eslint-plugin-react-hooks` via
  `next/core-web-vitals`, so exhaustive-deps should catch a good share of malformed effects).
- `npm run typecheck` (`tsc --noEmit`) and `npm test` (vitest, unit tests over the pure modules:
  `src/data/normalize.ts` and `src/lib/format.ts`).
- For runtime bugs, there's a Playwright MCP server configured in [.mcp.json](.mcp.json) — the
  real app can be navigated to confirm a fix actually resolves what BUGS.md described, not just
  that it compiles.
