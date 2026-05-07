import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';
import { problem } from '../_shared/problem.ts';
import { dispatchPending } from '../_shared/dispatch.ts';

// ---------------------------------------------------------------------------
// Request schema — mirrors OpenAPI OrderCreate
// ---------------------------------------------------------------------------
const ItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().positive(),
});

const OrderCreateSchema = z.object({
  restaurant_id:   z.string().uuid(),
  supplier_id:     z.string().uuid(),
  delivery_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  delivery_window: z.string().optional(),
  items:           z.array(ItemSchema).min(1, 'At least one item required'),
});

// ---------------------------------------------------------------------------
// SHA-256 of raw body — stored in idempotency_keys for conflict detection.
// Two requests with the same Idempotency-Key but different hashes → 409.
// ---------------------------------------------------------------------------
async function hashBody(raw: string): Promise<string> {
  const bytes = new TextEncoder().encode(raw);
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}


// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return problem(405, 'Method Not Allowed', `${req.method} is not supported on this endpoint.`);
  }

  // --- Idempotency-Key header
  const idempotencyKey = req.headers.get('idempotency-key') ?? req.headers.get('Idempotency-Key');
  if (!idempotencyKey || idempotencyKey.length === 0 || idempotencyKey.length > 255) {
    return problem(400, 'Bad Request', 'Idempotency-Key header is required (1–255 characters).');
  }

  // --- Parse + validate body
  let rawBody: string;
  let parsed: z.infer<typeof OrderCreateSchema>;
  try {
    rawBody = await req.text();
    const json = JSON.parse(rawBody);
    const result = OrderCreateSchema.safeParse(json);
    if (!result.success) {
      const detail = result.error.errors
        .map((e) => `${e.path.join('.') || 'body'}: ${e.message}`)
        .join('; ');
      return problem(400, 'Bad Request', detail);
    }
    parsed = result.data;
  } catch {
    return problem(400, 'Bad Request', 'Request body must be valid JSON.');
  }

  const requestHash = await hashBody(rawBody);

  // --- Service-role client (Supabase provides these env vars automatically)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // --- Check idempotency cache
  const { data: cached, error: cacheErr } = await supabase
    .from('idempotency_keys')
    .select('request_hash, status_code, response')
    .eq('endpoint', 'POST /v1/orders')
    .eq('key', idempotencyKey)
    .maybeSingle();

  if (cacheErr) {
    console.error('[orders] idempotency lookup failed:', cacheErr);
    return problem(500, 'Internal Server Error', 'Failed to check idempotency cache.');
  }

  if (cached) {
    if (cached.request_hash !== requestHash) {
      return problem(
        409,
        'Conflict',
        'Idempotency-Key already used with a different request body.',
      );
    }
    // Replay the original response — same status, same body. No dispatcher
    // trigger: the webhook was already enqueued on the original create.
    return new Response(JSON.stringify(cached.response), {
      status: cached.status_code,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // --- Create order (transactional: orders + order_items + idempotency record)
  const { data: order, error: rpcErr } = await supabase.rpc('create_order', {
    p_idempotency_key: idempotencyKey,
    p_request_hash:    requestHash,
    p_restaurant_id:   parsed.restaurant_id,
    p_supplier_id:     parsed.supplier_id,
    p_delivery_date:   parsed.delivery_date,
    p_delivery_window: parsed.delivery_window ?? null,
    p_items:           parsed.items,
  });

  if (rpcErr) {
    // 23505 = unique_violation: a concurrent request with the same key landed
    // first. Re-fetch the cache entry it wrote and replay it.
    if (rpcErr.code === '23505') {
      const { data: cached2 } = await supabase
        .from('idempotency_keys')
        .select('status_code, response')
        .eq('endpoint', 'POST /v1/orders')
        .eq('key', idempotencyKey)
        .maybeSingle();

      if (cached2) {
        return new Response(JSON.stringify(cached2.response), {
          status: cached2.status_code,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // P0001 = product not found in inventory (raised by create_order RPC)
    if (rpcErr.code === 'P0001') {
      return problem(400, 'Bad Request', rpcErr.message);
    }

    console.error('[orders] create_order rpc error:', rpcErr);
    return problem(500, 'Internal Server Error', 'Order creation failed.');
  }

  // Dispatch any pending webhooks inline so the supplier gets the POST within
  // the order-create lifecycle. pg_cron is the safety net for retries.
  // Bounded by limit=10: if a backlog exists, cron handles the rest.
  try {
    await dispatchPending(supabase, 10);
  } catch (e) {
    console.error('[orders] inline dispatch failed (cron will retry):', e);
  }

  return new Response(JSON.stringify(order), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
});
