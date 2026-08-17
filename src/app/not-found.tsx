import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-zinc-900">Page not found</h1>
        <p className="mt-2 text-sm text-zinc-500">
          That page doesn&apos;t exist.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          Back to portfolio
        </Link>
      </div>
    </div>
  );
}
