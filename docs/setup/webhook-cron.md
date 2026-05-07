# Webhook dispatcher cron setup

The `dispatch-webhooks` Edge Function gets two callers:

1. **Live trigger** — `orders` Edge Function fires it via `EdgeRuntime.waitUntil`
   right after a successful `create_order`. This delivers in <1s on the happy
   path.
2. **Cron safety net** — `pg_cron` invokes it every minute to retry failed
   deliveries and to pick up any rows the live trigger missed (e.g., if the
   `orders` function was killed before `waitUntil` ran).

Cron setup is project-specific (it needs the project URL + service role key)
so it lives outside migrations. Run this **once** per environment in the
Supabase SQL Editor.

## One-time setup

Replace `<PROJECT_REF>` and `<SERVICE_ROLE_KEY>` with values from
`Project Settings → API`.

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'dispatch-webhooks-every-minute',
  '* * * * *',
  $$
    select net.http_post(
      url := 'https://<PROJECT_REF>.supabase.co/functions/v1/dispatch-webhooks',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
      ),
      body := '{}'::jsonb
    );
  $$
);
```

To remove later:

```sql
select cron.unschedule('dispatch-webhooks-every-minute');
```

To inspect:

```sql
select * from cron.job;
select * from cron.job_run_details order by start_time desc limit 20;
```

## Inserting a test webhook

The seed data has no webhooks. To verify end-to-end with a real HTTP
endpoint, grab a free URL from <https://webhook.site> and run:

```sql
insert into webhooks (supplier_id, url, event_types, secret, active)
values (
  '11111111-1111-1111-1111-111111111111',                   -- seed supplier
  'https://webhook.site/<your-webhook-id>',
  '["order.created"]'::jsonb,
  'test-secret-replace-me-in-real-deployments',
  true
);
```

Now create an order via `POST /v1/orders`. Within ~1s the webhook.site page
shows a POST with `X-Negatic-Signature: sha256=<hex>`,
`X-Negatic-Event: order.created`, and `X-Negatic-Delivery: <uuid>`. The body
is the `OrderCreatedEvent` envelope from the OpenAPI spec.

## Verifying the signature (sample, Node)

```js
import crypto from 'node:crypto';

function verify(rawBody, signatureHeader, secret) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signatureHeader),
  );
}
```

Match against the **raw** request body, not a re-serialized JSON object —
key order matters.

## Inspecting the queue

```sql
-- Recent deliveries
select id, webhook_id, event_type, status, attempts, response_code,
       last_error, next_attempt_at, created_at
from webhook_deliveries
order by created_at desc
limit 20;

-- Stuck pending rows (cron should be consuming these)
select * from webhook_deliveries
where status = 'pending' and next_attempt_at <= now()
order by next_attempt_at;
```
