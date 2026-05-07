-- Idempotency cache for Edge Function write endpoints.
-- Stores the full response (status + body) keyed by (endpoint, client key).
-- RLS enabled, no policies — service_role only, same rationale as `webhooks`.
--
-- request_hash: SHA-256 hex of the raw request body.
-- Detecting "same key + different body" → 409 happens in application code,
-- not in this table (the hash is stored here for the comparison).

create table idempotency_keys (
  endpoint     text        not null,
  key          text        not null,
  request_hash text        not null,
  status_code  integer     not null,
  response     jsonb       not null,
  created_at   timestamptz not null default now(),
  primary key (endpoint, key)
);

alter table idempotency_keys enable row level security;
-- No policies: only service_role (Edge Functions) may read or write.

-- ---------------------------------------------------------------------------
-- create_order: transactional order + items + idempotency record.
--
-- Computes line totals server-side from inventory.price_per_unit_cents.
-- Raises P0001 if a product has no inventory row (caller maps to 400/422).
-- Writes the idempotency record in the same transaction so a crash between
-- order insert and idempotency insert is impossible.
-- ---------------------------------------------------------------------------
create or replace function create_order(
  p_idempotency_key text,
  p_request_hash    text,
  p_restaurant_id   uuid,
  p_supplier_id     uuid,
  p_delivery_date   date,
  p_delivery_window text,
  p_items           jsonb   -- [{product_id: uuid, quantity: number}]
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
  -- Insert the order skeleton (idempotency_key unique constraint here is a
  -- last-resort guard; primary idempotency enforcement is in Edge Function)
  insert into orders (
    restaurant_id, supplier_id, delivery_date, delivery_window, idempotency_key
  ) values (
    p_restaurant_id, p_supplier_id, p_delivery_date, p_delivery_window, p_idempotency_key
  )
  returning id into v_order_id;

  -- Insert items, pricing from live inventory
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

  -- Build the response shape matching the OpenAPI Order schema
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

  -- Store idempotency record atomically with the order
  insert into idempotency_keys (endpoint, key, request_hash, status_code, response)
  values ('POST /v1/orders', p_idempotency_key, p_request_hash, 201, v_response);

  return v_response;
end;
$$;
