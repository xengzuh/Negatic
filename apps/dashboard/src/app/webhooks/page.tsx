import { createServiceRoleClient } from '@/lib/supabase';
import type { Database } from '@/lib/db-types';

export const dynamic = 'force-dynamic';

type DeliveryStatus = Database['public']['Enums']['webhook_delivery_status'];

const STATUS_STYLE: Record<DeliveryStatus, string> = {
  pending: 'bg-amber-100 text-amber-900',
  sent: 'bg-green-100 text-green-900',
  failed: 'bg-red-100 text-red-900',
};

export default async function WebhooksPage() {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('webhook_deliveries')
    .select('id, event_type, status, attempts, response_code, last_error, created_at, webhooks(url)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return (
      <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900">
        Failed to load webhook deliveries: {error.message}
      </div>
    );
  }

  const deliveries = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Webhook Deliveries</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {deliveries.length === 0
            ? 'No deliveries yet. They appear here when orders are placed.'
            : `${deliveries.length} recent deliver${deliveries.length === 1 ? 'y' : 'ies'}, newest first.`}
        </p>
      </div>

      {deliveries.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Destination</th>
                <th className="px-4 py-3 text-center">Attempts</th>
                <th className="px-4 py-3 text-center">HTTP</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {deliveries.map((d) => {
                const webhook = Array.isArray(d.webhooks) ? d.webhooks[0] : d.webhooks;
                return (
                  <tr key={d.id}>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLE[d.status]}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{d.event_type}</td>
                    <td className="px-4 py-3 max-w-xs truncate text-xs text-neutral-500">
                      {webhook?.url ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-center">{d.attempts}</td>
                    <td className="px-4 py-3 text-center font-mono text-xs">
                      {d.response_code ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-500 whitespace-nowrap">
                      {new Date(d.created_at).toISOString().replace('T', ' ').slice(0, 19)} UTC
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate text-xs text-red-700">
                      {d.last_error ?? ''}
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
