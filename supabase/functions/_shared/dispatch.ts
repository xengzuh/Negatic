// Shared webhook dispatch loop. Used by:
//   - dispatch-webhooks Edge Function (called on cron, every minute)
//   - orders Edge Function (called inline after create_order for ~1s delivery)
//
// Both share the same row-claim semantics (FOR UPDATE SKIP LOCKED inside the
// claim_webhook_deliveries RPC), so concurrent runs never double-send.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

const BACKOFF_SECONDS = [30, 60, 300, 900, 3600, 21600];
const MAX_ATTEMPTS = BACKOFF_SECONDS.length;
const REQUEST_TIMEOUT_MS = 10_000;

interface ClaimedRow {
  id: string;
  event_type: string;
  enqueued_at: string;
  payload: unknown;
  attempts: number;
  url: string;
  secret: string;
  active: boolean;
}

export interface DispatchSummary {
  claimed: number;
  sent: number;
  failed: number;
  retrying: number;
}

async function hmacHex(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function dispatchPending(
  supabase: SupabaseClient,
  limit = 50,
): Promise<DispatchSummary> {
  const { data: rows, error } = await supabase.rpc('claim_webhook_deliveries', {
    p_limit: limit,
  });

  if (error) {
    console.error('[dispatch] claim failed:', error);
    throw new Error(`claim_failed: ${error.message}`);
  }

  const claimed = (rows ?? []) as ClaimedRow[];
  let sent = 0;
  let failed = 0;
  let retrying = 0;

  for (const row of claimed) {
    if (!row.active) {
      await supabase
        .from('webhook_deliveries')
        .update({
          status: 'failed',
          last_error: 'webhook inactive',
          claimed_at: null,
        })
        .eq('id', row.id);
      failed++;
      continue;
    }

    const envelope = {
      id: row.id,
      type: row.event_type,
      created: row.enqueued_at,
      data: row.payload,
    };
    const body = JSON.stringify(envelope);
    const signature = await hmacHex(body, row.secret);
    const nextAttempt = row.attempts + 1;

    let statusCode: number | null = null;
    let responseBody: string | null = null;
    let lastError: string | null = null;
    let success = false;

    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
      const res = await fetch(row.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Negatic-Signature': `sha256=${signature}`,
          'X-Negatic-Event': row.event_type,
          'X-Negatic-Delivery': row.id,
        },
        body,
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      statusCode = res.status;
      responseBody = (await res.text()).slice(0, 4096);
      success = res.ok;
    } catch (e) {
      lastError = (e instanceof Error ? e.message : String(e)).slice(0, 1024);
    }

    if (success) {
      await supabase
        .from('webhook_deliveries')
        .update({
          status: 'sent',
          attempts: nextAttempt,
          response_code: statusCode,
          response_body: responseBody,
          last_error: null,
          claimed_at: null,
        })
        .eq('id', row.id);
      sent++;
    } else if (statusCode !== null && statusCode >= 400 && statusCode < 500) {
      await supabase
        .from('webhook_deliveries')
        .update({
          status: 'failed',
          attempts: nextAttempt,
          response_code: statusCode,
          response_body: responseBody,
          last_error: `4xx response: ${statusCode}`,
          claimed_at: null,
        })
        .eq('id', row.id);
      failed++;
    } else if (nextAttempt >= MAX_ATTEMPTS) {
      await supabase
        .from('webhook_deliveries')
        .update({
          status: 'failed',
          attempts: nextAttempt,
          response_code: statusCode,
          response_body: responseBody,
          last_error: lastError ?? `max attempts after ${statusCode ?? 'no response'}`,
          claimed_at: null,
        })
        .eq('id', row.id);
      failed++;
    } else {
      const delaySec = BACKOFF_SECONDS[nextAttempt - 1];
      const next = new Date(Date.now() + delaySec * 1000).toISOString();
      await supabase
        .from('webhook_deliveries')
        .update({
          attempts: nextAttempt,
          next_attempt_at: next,
          response_code: statusCode,
          response_body: responseBody,
          last_error: lastError ?? `${statusCode}`,
          claimed_at: null,
        })
        .eq('id', row.id);
      retrying++;
    }
  }

  return { claimed: claimed.length, sent, failed, retrying };
}
