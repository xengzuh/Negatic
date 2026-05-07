-- Outbound webhook delivery queue.
--
-- create_order enqueues one row per active webhook subscribed to the event.
-- The `dispatch-webhooks` Edge Function claims pending rows (FOR UPDATE SKIP
-- LOCKED so concurrent runs don't double-send), POSTs the signed envelope to
-- the supplier URL, and records the outcome.
--
-- At-least-once semantics: if the dispatcher crashes mid-send, the row stays
-- claimed for 5 minutes, then becomes reclaimable and may be sent again.
-- Suppliers must dedupe by the `X-Negatic-Delivery` header (the row id).

create type webhook_delivery_status as enum ('pending', 'sent', 'failed');

create table webhook_deliveries (
  id              uuid primary key default uuid_generate_v4(),
  webhook_id      uuid not null references webhooks(id) on delete cascade,
  event_type      text not null,
  payload         jsonb not null,
  status          webhook_delivery_status not null default 'pending',
  attempts        integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  claimed_at      timestamptz,
  response_code   integer,
  response_body   text,
  last_error      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Partial index covers the dispatcher's hot path: pending rows ordered by
-- when they're due. Sent/failed rows fall out of the index.
create index webhook_deliveries_pending_idx
  on webhook_deliveries (next_attempt_at)
  where status = 'pending';

create index webhook_deliveries_webhook_idx
  on webhook_deliveries (webhook_id, created_at desc);

create trigger webhook_deliveries_set_updated_at
  before update on webhook_deliveries
  for each row execute function set_updated_at();

alter table webhook_deliveries enable row level security;
-- No policies: service_role only. Same rationale as `webhooks` — the payload
-- contains order data we don't want exposed pre-auth-scoping, and rows
-- include response bodies from supplier endpoints.

-- ---------------------------------------------------------------------------
-- claim_webhook_deliveries: atomically claim a batch of due-pending rows.
-- Sets `claimed_at = now()` and returns the rows joined with webhook info.
-- Concurrent dispatcher invocations skip locked rows (no double-send).
-- Rows claimed >5 minutes ago are reclaimable (recovery from crashed runs).
-- ---------------------------------------------------------------------------
create or replace function claim_webhook_deliveries(p_limit int default 50)
returns table (
  id          uuid,
  event_type  text,
  enqueued_at timestamptz,
  payload     jsonb,
  attempts    integer,
  url         text,
  secret      text,
  active      boolean
)
language plpgsql
security definer
as $$
begin
  return query
  with picked as (
    select d.id
    from webhook_deliveries d
    where d.status = 'pending'
      and d.next_attempt_at <= now()
      and (d.claimed_at is null or d.claimed_at < now() - interval '5 minutes')
    order by d.next_attempt_at
    limit p_limit
    for update skip locked
  ),
  claimed as (
    update webhook_deliveries d2
    set claimed_at = now()
    from picked
    where d2.id = picked.id
    returning d2.id, d2.webhook_id, d2.event_type, d2.created_at, d2.payload, d2.attempts
  )
  select c.id, c.event_type, c.created_at, c.payload, c.attempts,
         w.url, w.secret, w.active
  from claimed c
  join webhooks w on w.id = c.webhook_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_order: now also enqueues an order.created delivery for each active
-- webhook on the supplier that subscribes to the event. Atomic with the
-- order insert — if the order doesn't get created, no deliveries get queued.
-- ---------------------------------------------------------------------------
create or replace function create_order(
  p_idempotency_key text,
  p_request_hash    text,
  p_restaurant_id   uuid,
  p_supplier_id     uuid,
  p_delivery_date   date,
  p_delivery_window text,
  p_items           jsonb
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_order_id    uuid;
  v_total_cents integer := 0;
  v_product_id  uuid;
  v_quantity    numeric;
  v_unit_price  integer;
  v_line_total  integer;
  v_elem        jsonb;
  v_response    jsonb;
begin
  insert into orders (
    restaurant_id, supplier_id, delivery_date, delivery_window, idempotency_key
  ) values (
    p_restaurant_id, p_supplier_id, p_delivery_date, p_delivery_window, p_idempotency_key
  )
  returning id into v_order_id;

  for v_elem in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_elem->>'product_id')::uuid;
    v_quantity   := (v_elem->>'quantity')::numeric;

    select price_per_unit_cents into v_unit_price
    from inventory
    where product_id = v_product_id;

    if not found then
      raise exception 'Product % has no inventory record', v_product_id
        using errcode = 'P0001';
    end if;

    v_line_total  := round(v_quantity * v_unit_price);
    v_total_cents := v_total_cents + v_line_total;

    insert into order_items (order_id, product_id, quantity, unit_price_cents, line_total_cents)
    values (v_order_id, v_product_id, v_quantity, v_unit_price, v_line_total);
  end loop;

  update orders set total_amount_cents = v_total_cents where id = v_order_id;

  select jsonb_build_object(
    'id',                 o.id,
    'restaurant_id',      o.restaurant_id,
    'supplier_id',        o.supplier_id,
    'status',             o.status,
    'delivery_date',      to_char(o.delivery_date, 'YYYY-MM-DD'),
    'delivery_window',    o.delivery_window,
    'total_amount_cents', o.total_amount_cents,
    'created_at',         o.created_at,
    'updated_at',         o.updated_at,
    'items', coalesce(
      (select jsonb_agg(jsonb_build_object(
        'id',               oi.id,
        'product_id',       oi.product_id,
        'quantity',         oi.quantity,
        'unit_price_cents', oi.unit_price_cents,
        'line_total_cents', oi.line_total_cents
      ) order by oi.created_at)
      from order_items oi
      where oi.order_id = o.id),
      '[]'::jsonb
    )
  ) into v_response
  from orders o
  where o.id = v_order_id;

  -- Enqueue webhook deliveries for active subscriptions. The payload is the
  -- order JSON; the dispatcher wraps it in an event envelope at send time.
  insert into webhook_deliveries (webhook_id, event_type, payload)
  select w.id, 'order.created', v_response
  from webhooks w
  where w.supplier_id = p_supplier_id
    and w.active
    and w.event_types ? 'order.created';

  insert into idempotency_keys (endpoint, key, request_hash, status_code, response)
  values ('POST /v1/orders', p_idempotency_key, p_request_hash, 201, v_response);

  return v_response;
end;
$$;
