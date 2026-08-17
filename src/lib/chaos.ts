// Failure injection inherited from the starter code, kept so the error states can be
// exercised but off unless CHAOS=1. `?forceError=1` on the summary route is the
// deterministic alternative and does not go through here.
export function shouldInjectFailure(rate: number): boolean {
  return process.env.CHAOS === "1" && Math.random() < rate;
}
