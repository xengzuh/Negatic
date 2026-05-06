import { z } from 'zod';

// Shared, validated runtime config. Apps import the parts they need.
// Validation runs once at module load; missing/invalid env throws fast.

const SupabaseEnv = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
});

// Server-only config. Service role key is REQUIRED — service-role bypasses
// RLS, so the caller can write any table (orders, bot_sessions, etc.).
// Never load this from a browser bundle.
const SupabaseServerEnv = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const MetaWhatsAppEnv = z.object({
  META_WHATSAPP_PHONE_NUMBER_ID: z.string().min(1),
  META_WHATSAPP_ACCESS_TOKEN: z.string().min(1),
  META_WEBHOOK_VERIFY_TOKEN: z.string().min(1),
  META_APP_SECRET: z.string().min(1),
});

export function loadSupabaseEnv(env: NodeJS.ProcessEnv = process.env) {
  return SupabaseEnv.parse(env);
}

export function loadSupabaseServerEnv(env: NodeJS.ProcessEnv = process.env) {
  return SupabaseServerEnv.parse(env);
}

export function loadMetaWhatsAppEnv(env: NodeJS.ProcessEnv = process.env) {
  return MetaWhatsAppEnv.parse(env);
}

// Hardcoded MVP constants. Per CLAUDE.md scope.
export const MVP_CURRENCY = 'MYR' as const;
export const MVP_DELIVERY_ZONES = ['PJ', 'Subang'] as const;
