"use client";

import { useEffect } from "react";

// Last resort. The per-fetch error states cover the failures we know about; this one
// keeps an unexpected render throw from white-screening the app.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("unhandled error boundary", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-zinc-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-zinc-500">
          We couldn&apos;t render this page. Trying again usually fixes it.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
