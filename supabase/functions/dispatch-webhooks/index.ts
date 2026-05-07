import { createClient } from 'npm:@supabase/supabase-js@2';
import { dispatchPending } from '../_shared/dispatch.ts';

// Cron entrypoint. The orders Edge Function calls dispatchPending inline; this
// function is the safety net for retries and any rows the inline call missed.

Deno.serve(async (_req: Request): Promise<Response> => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const summary = await dispatchPending(supabase, 50);
    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
