import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './lib/db-types.js';

export interface OrderInput {
  restaurant_id: string;
  supplier_id: string;
  delivery_date: string;
  items: ReadonlyArray<{
    product_id: string;
    quantity: number;
    unit_price_cents: number;
  }>;
  /** If omitted, a fresh UUID is generated. Pass one to make retries safe. */
  idempotency_key?: string;
}

export interface OrderResult {
  id: string;
  total_amount_cents: number;
}

export interface OrderWriter {
  create(input: OrderInput): Promise<OrderResult>;
}

export function createOrderWriter(
  supabase: SupabaseClient<Database>,
): OrderWriter {
  return {
    async create(input) {
      if (input.items.length === 0) {
        throw new Error('Cannot create an order with zero items');
      }

      const total = input.items.reduce(
        (sum, i) => sum + Math.round(i.quantity * i.unit_price_cents),
        0,
      );

      const idempotencyKey = input.idempotency_key ?? randomUUID();

      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          restaurant_id: input.restaurant_id,
          supplier_id: input.supplier_id,
          status: 'pending',
          delivery_date: input.delivery_date,
          delivery_window: 'morning',
          total_amount_cents: total,
          idempotency_key: idempotencyKey,
        })
        .select('id, total_amount_cents')
        .single();

      if (orderErr) {
        throw new Error(`Failed to create order: ${orderErr.message}`);
      }
      if (!order) {
        throw new Error('Order insert returned no row');
      }

      const itemsToInsert = input.items.map((i) => ({
        order_id: order.id,
        product_id: i.product_id,
        quantity: i.quantity,
        unit_price_cents: i.unit_price_cents,
        line_total_cents: Math.round(i.quantity * i.unit_price_cents),
      }));

      const { error: itemsErr } = await supabase
        .from('order_items')
        .insert(itemsToInsert);

      if (itemsErr) {
        // Best-effort cleanup so we don't leave a headless order behind.
        await supabase.from('orders').delete().eq('id', order.id);
        throw new Error(`Failed to create order items: ${itemsErr.message}`);
      }

      return {
        id: order.id,
        total_amount_cents: order.total_amount_cents,
      };
    },
  };
}
