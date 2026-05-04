import { createSupabaseClient } from '@/lib/supabase';
import type { Database } from '@/lib/db-types';

// Always render at request time — the order inbox must reflect new orders
// the moment they're placed, not whatever was in the DB at build time.
export const dynamic = 'force-dynamic';

type OrderStatus = Database['public']['Enums']['order_status'];

const STATUS_STYLE: Record<OrderStatus, string> = {
  pending: 'bg-amber-100 text-amber-900',
  confirmed: 'bg-blue-100 text-blue-900',
  fulfilled: 'bg-green-100 text-green-900',
  cancelled: 'bg-neutral-200 text-neutral-700',
};

export default async function OrdersPage() {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, status, delivery_date, delivery_window, total_amount_cents, created_at, restaurants(name)',
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return (
      <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900">
        Failed to load orders: {error.message}
      </div>
    );
  }

  const orders = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Orders</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {orders.length === 0
            ? 'No orders yet. They’ll appear here when restaurants order via WhatsApp.'
            : `${orders.length} order${orders.length === 1 ? '' : 's'}, newest first.`}
        </p>
      </div>

      {orders.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Restaurant</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Delivery</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {orders.map((o) => {
                const restaurant = Array.isArray(o.restaurants)
                  ? o.restaurants[0]
                  : o.restaurants;
                return (
                  <tr key={o.id}>
                    <td className="px-4 py-3 font-mono text-xs">
                      {o.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3">{restaurant?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLE[o.status]}`}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>{o.delivery_date}</div>
                      {o.delivery_window ? (
                        <div className="text-xs text-neutral-500">
                          {o.delivery_window}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatMyr(o.total_amount_cents)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function formatMyr(cents: number): string {
  return `RM ${(cents / 100).toFixed(2)}`;
}
