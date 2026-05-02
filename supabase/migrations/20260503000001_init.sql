-- Negatic initial schema.
-- Source of truth: see CLAUDE.md "Schema" section.
--
-- Conventions:
--   * Money in integer cents, MYR.
--   * Timestamps timestamptz, UTC.
--   * UUIDs via uuid_generate_v4().
--   * Soft deletes via deleted_at (no hard deletes).
--   * Idempotency keys are unique per write endpoint.
--
-- RLS is intentionally NOT enabled in this migration. The dashboard and bot
-- will run with service_role for the MVP. Add per-supplier RLS policies in a
-- follow-up migration once auth scoping is wired up.

create extension if not exists "uuid-ossp";

-- updated_at trigger helper
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- suppliers
-- ---------------------------------------------------------------------------
create table suppliers (
  id                    uuid primary key default uuid_generate_v4(),
  name                  text not null,
  business_registration text,
  phone                 text not null,
  address               text,
  delivery_zones        text[] not null default '{}',
  halal_cert_number     text,
  payment_terms         text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz
);

create trigger suppliers_set_updated_at
  before update on suppliers
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table products (
  id              uuid primary key default uuid_generate_v4(),
  supplier_id     uuid not null references suppliers(id) on delete restrict,
  sku             text not null,
  name            text not null,
  name_ms         text,
  category        text not null,
  unit            text not null check (unit in ('kg','pcs','liter')),
  halal_certified boolean not null default false,
  description     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  unique (supplier_id, sku)
);

create index products_supplier_idx on products(supplier_id);
create index products_category_idx on products(category);

create trigger products_set_updated_at
  before update on products
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- inventory (1:1 with products)
-- ---------------------------------------------------------------------------
create table inventory (
  product_id           uuid primary key references products(id) on delete cascade,
  available_quantity   numeric not null default 0 check (available_quantity >= 0),
  price_per_unit_cents integer not null check (price_per_unit_cents >= 0),
  min_order_quantity   numeric not null default 0 check (min_order_quantity >= 0),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger inventory_set_updated_at
  before update on inventory
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- restaurants
-- ---------------------------------------------------------------------------
create table restaurants (
  id                     uuid primary key default uuid_generate_v4(),
  name                   text not null,
  phone                  text not null,
  whatsapp_number        text,
  address                text,
  delivery_zone          text,
  default_payment_method text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  deleted_at             timestamptz
);

create index restaurants_whatsapp_idx on restaurants(whatsapp_number);

create trigger restaurants_set_updated_at
  before update on restaurants
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
create type order_status as enum ('pending','confirmed','fulfilled','cancelled');

create table orders (
  id                 uuid primary key default uuid_generate_v4(),
  restaurant_id      uuid not null references restaurants(id) on delete restrict,
  supplier_id        uuid not null references suppliers(id) on delete restrict,
  status             order_status not null default 'pending',
  delivery_date      date not null,
  delivery_window    text,
  total_amount_cents integer not null default 0 check (total_amount_cents >= 0),
  idempotency_key    text not null unique,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);

create index orders_restaurant_idx on orders(restaurant_id);
create index orders_supplier_idx   on orders(supplier_id);
create index orders_status_idx     on orders(status);
create index orders_delivery_idx   on orders(delivery_date);

create trigger orders_set_updated_at
  before update on orders
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- order_items
-- ---------------------------------------------------------------------------
create table order_items (
  id               uuid primary key default uuid_generate_v4(),
  order_id         uuid not null references orders(id) on delete cascade,
  product_id       uuid not null references products(id) on delete restrict,
  quantity         numeric not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  line_total_cents integer not null check (line_total_cents >= 0),
  created_at       timestamptz not null default now()
);

create index order_items_order_idx   on order_items(order_id);
create index order_items_product_idx on order_items(product_id);

-- ---------------------------------------------------------------------------
-- webhooks
-- ---------------------------------------------------------------------------
create table webhooks (
  id          uuid primary key default uuid_generate_v4(),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  url         text not null,
  event_types jsonb not null default '[]'::jsonb,
  -- HMAC-SHA256 signing secret. Sent back in `X-Negatic-Signature` header.
  secret      text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index webhooks_supplier_idx on webhooks(supplier_id) where active;

create trigger webhooks_set_updated_at
  before update on webhooks
  for each row execute function set_updated_at();
