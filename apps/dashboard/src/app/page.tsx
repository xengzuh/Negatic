import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Supplier dashboard</h1>
        <p className="mt-2 text-neutral-600">
          Manage your catalog and process incoming orders.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/orders"
          className="rounded-lg border border-neutral-200 bg-white p-6 transition hover:border-neutral-400"
        >
          <h2 className="font-medium">Orders</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Incoming orders from restaurants. Confirm, fulfill, or cancel.
          </p>
        </Link>

        <Link
          href="/products"
          className="rounded-lg border border-neutral-200 bg-white p-6 transition hover:border-neutral-400"
        >
          <h2 className="font-medium">Products</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Your catalog and per-unit pricing.
          </p>
        </Link>
      </div>
    </div>
  );
}
