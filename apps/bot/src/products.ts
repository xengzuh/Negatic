import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './lib/db-types.js';

export interface Product {
  id: string;
  sku: string;
  name: string;
  unit: 'kg' | 'pcs' | 'liter';
  supplier_id: string;
  price_per_unit_cents: number;
  available_quantity: number;
}

export interface ProductCatalog {
  /**
   * All products that are not soft-deleted and have stock > 0.
   * For the MVP there's only one supplier so we don't filter; when we add
   * more, callers will pass a supplier_id.
   */
  listAvailable(): Promise<Product[]>;
  getById(productId: string): Promise<Product | null>;
}

type ProductRowWithInventory = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  supplier_id: string;
  inventory:
    | { price_per_unit_cents: number; available_quantity: number }
    | { price_per_unit_cents: number; available_quantity: number }[]
    | null;
};

function flatten(row: ProductRowWithInventory): Product | null {
  const inv = Array.isArray(row.inventory) ? row.inventory[0] : row.inventory;
  if (!inv) return null;
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    unit: row.unit as 'kg' | 'pcs' | 'liter',
    supplier_id: row.supplier_id,
    price_per_unit_cents: inv.price_per_unit_cents,
    available_quantity: inv.available_quantity,
  };
}

export function createProductCatalog(
  supabase: SupabaseClient<Database>,
): ProductCatalog {
  return {
    async listAvailable() {
      const { data, error } = await supabase
        .from('products')
        .select(
          'id, sku, name, unit, supplier_id, inventory(price_per_unit_cents, available_quantity)',
        )
        .is('deleted_at', null)
        .order('sku', { ascending: true });

      if (error || !data) {
        if (error) console.error('[products] list failed:', error.message);
        return [];
      }

      return data.flatMap((row) => {
        const p = flatten(row as ProductRowWithInventory);
        if (!p) return [];
        if (p.available_quantity <= 0) return [];
        return [p];
      });
    },

    async getById(productId) {
      const { data, error } = await supabase
        .from('products')
        .select(
          'id, sku, name, unit, supplier_id, inventory(price_per_unit_cents, available_quantity)',
        )
        .eq('id', productId)
        .is('deleted_at', null)
        .maybeSingle();

      if (error || !data) {
        if (error) console.error('[products] getById failed:', error.message);
        return null;
      }
      return flatten(data as ProductRowWithInventory);
    },
  };
}
