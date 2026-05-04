import { createSupabaseClient } from '@/lib/supabase';

// Catalog must reflect supplier edits immediately. Don't prerender.
export const dynamic = 'force-dynamic';

// Shape we read in this page. We hand-type because supabase-js types
// aren't generated yet — when we add `supabase gen types typescript`,
// these inline types go away.
type ProductRow = {
  id: string;
  sku: string;
  name: string;
  name_ms: string | null;
  unit: 'kg' | 'pcs' | 'liter';
  halal_certified: boolean;
  inventory: {
    available_quantity: number;
    price_per_unit_cents: number;
  } | null;
};

export default async function ProductsPage() {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from('products')
    .select(
      'id, sku, name, name_ms, unit, halal_certified, inventory(available_quantity, price_per_unit_cents)',
    )
    .is('deleted_at', null)
    .order('sku', { ascending: true })
    .returns<ProductRow[]>();

  if (error) {
    return (
      <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900">
        Failed to load products: {error.message}
      </div>
    );
  }

  const products = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Products</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {products.length} item{products.length === 1 ? '' : 's'} in your catalog.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-100 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">In stock</th>
              <th className="px-4 py-3">Halal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {products.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 font-mono text-xs">{p.sku}</td>
                <td className="px-4 py-3">
                  <div>{p.name}</div>
                  {p.name_ms ? (
                    <div className="text-xs text-neutral-500">{p.name_ms}</div>
                  ) : null}
                </td>
                <td className="px-4 py-3">{p.unit}</td>
                <td className="px-4 py-3 text-right font-mono">
                  {p.inventory
                    ? formatMyr(p.inventory.price_per_unit_cents)
                    : '—'}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {p.inventory
                    ? `${p.inventory.available_quantity} ${p.unit}`
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  {p.halal_certified ? (
                    <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-900">
                      certified
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-500">no</span>
                  )}
                </td>
              </tr>
            ))}
            {products.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                  No products yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatMyr(cents: number): string {
  return `RM ${(cents / 100).toFixed(2)}`;
}
