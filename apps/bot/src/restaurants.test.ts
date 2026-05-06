import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createRestaurantLookup, type Restaurant } from './restaurants.js';

/**
 * Build a fake SupabaseClient that records the `eq()` call and returns
 * a configurable result from `maybeSingle()`. We intentionally don't try
 * to mock the entire client — just the chain we use.
 */
function fakeSupabase(result: { data: Restaurant | null; error: { message: string } | null }) {
  const eq = vi.fn().mockReturnValue({
    is: vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue(result),
    }),
  });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  const supabase = { from } as unknown as SupabaseClient;
  return { supabase, calls: { from, select, eq } };
}

describe('createRestaurantLookup', () => {
  it('prefixes wa_id with + before querying (E.164 normalization)', async () => {
    const { supabase, calls } = fakeSupabase({ data: null, error: null });
    const lookup = createRestaurantLookup(supabase);

    await lookup.byWaId('60162158252');

    expect(calls.from).toHaveBeenCalledWith('restaurants');
    expect(calls.eq).toHaveBeenCalledWith('whatsapp_number', '+60162158252');
  });

  it('returns the restaurant row when one matches', async () => {
    const fixture: Restaurant = {
      id: 'rest-1',
      name: 'Nasi Kandar Original PJ',
      whatsapp_number: '+60162158252',
      delivery_zone: 'PJ',
    };
    const { supabase } = fakeSupabase({ data: fixture, error: null });
    const lookup = createRestaurantLookup(supabase);

    const result = await lookup.byWaId('60162158252');
    expect(result).toEqual(fixture);
  });

  it('returns null when no row matches', async () => {
    const { supabase } = fakeSupabase({ data: null, error: null });
    const lookup = createRestaurantLookup(supabase);

    const result = await lookup.byWaId('60999999999');
    expect(result).toBeNull();
  });

  it('returns null and logs when Supabase errors', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { supabase } = fakeSupabase({
      data: null,
      error: { message: 'connection refused' },
    });
    const lookup = createRestaurantLookup(supabase);

    const result = await lookup.byWaId('60162158252');
    expect(result).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
