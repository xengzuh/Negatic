import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from './lib/db-types.js';

export type BotSessionState = Database['public']['Enums']['bot_session_state'];

/**
 * Accumulated draft fields for an in-flight order. Each field becomes
 * present once the user reaches that step; we keep them all optional in
 * the type so the state machine can advance one step at a time.
 */
export interface OrderDraft {
  product_id?: string;
  product_name?: string;
  unit?: 'kg' | 'pcs' | 'liter';
  unit_price_cents?: number;
  supplier_id?: string;
  quantity?: number;
  delivery_date?: string;
}

export interface Session {
  wa_id: string;
  restaurant_id: string;
  state: BotSessionState;
  draft: OrderDraft;
}

export interface SessionStore {
  /** Returns null if no live (un-expired) session exists for this wa_id. */
  get(waId: string): Promise<Session | null>;
  upsert(input: {
    wa_id: string;
    restaurant_id: string;
    state: BotSessionState;
    draft: OrderDraft;
  }): Promise<void>;
  delete(waId: string): Promise<void>;
}

const SESSION_TTL_MIN = 30;

export function createSessionStore(
  supabase: SupabaseClient<Database>,
): SessionStore {
  return {
    async get(waId) {
      const { data, error } = await supabase
        .from('bot_sessions')
        .select('wa_id, restaurant_id, state, draft, expires_at')
        .eq('wa_id', waId)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (error) {
        console.error('[sessions] get failed:', error.message);
        return null;
      }
      if (!data) return null;

      return {
        wa_id: data.wa_id,
        restaurant_id: data.restaurant_id,
        state: data.state,
        draft: (data.draft ?? {}) as OrderDraft,
      };
    },

    async upsert(input) {
      const expiresAt = new Date(
        Date.now() + SESSION_TTL_MIN * 60 * 1000,
      ).toISOString();

      const { error } = await supabase.from('bot_sessions').upsert(
        {
          wa_id: input.wa_id,
          restaurant_id: input.restaurant_id,
          state: input.state,
          draft: input.draft as Json,
          expires_at: expiresAt,
        },
        { onConflict: 'wa_id' },
      );
      if (error) {
        throw new Error(`Session upsert failed: ${error.message}`);
      }
    },

    async delete(waId) {
      const { error } = await supabase
        .from('bot_sessions')
        .delete()
        .eq('wa_id', waId);
      if (error) {
        throw new Error(`Session delete failed: ${error.message}`);
      }
    },
  };
}
