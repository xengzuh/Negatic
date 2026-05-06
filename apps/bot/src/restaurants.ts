import type { SupabaseClient } from '@supabase/supabase-js';

export interface Restaurant {
  id: string;
  name: string;
  whatsapp_number: string;
  delivery_zone: string | null;
}

export interface RestaurantLookup {
  /**
   * Look up a restaurant by the sender's WhatsApp `wa_id`.
   *
   * Meta sends `wa_id` as a bare phone number with country code, no plus —
   * e.g. `60162158252`. Our DB stores phones in E.164 format with the plus,
   * e.g. `+60162158252`. We normalize on the way in so callers never have
   * to think about it.
   *
   * Returns null when no active restaurant matches.
   */
  byWaId(waId: string): Promise<Restaurant | null>;
}

export function createRestaurantLookup(
  supabase: SupabaseClient,
): RestaurantLookup {
  return {
    async byWaId(waId) {
      const e164 = `+${waId}`;
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, name, whatsapp_number, delivery_zone')
        .eq('whatsapp_number', e164)
        .is('deleted_at', null)
        .maybeSingle<Restaurant>();

      if (error) {
        console.error('[restaurants] lookup failed:', error.message);
        return null;
      }
      return data;
    },
  };
}
