-- Enable Row Level Security on all tables, with read-only access for anon
-- and authenticated. Writes are blocked for these roles (no INSERT/UPDATE/
-- DELETE policies exist). The service_role bypasses RLS, so dashboard +
-- bot + Edge Functions perform writes via service_role.
--
-- Why this shape, not per-supplier scoping: per-supplier requires identity
-- on every request (a JWT carrying supplier_id, etc.). Auth isn't wired
-- up yet. When it lands, drop the public_read policies on tables that
-- should be supplier-scoped (orders, order_items, restaurants, webhooks)
-- and add policies that key off auth.jwt() claims. Reference catalog data
-- (suppliers, products, inventory) likely stays public_read.
--
-- webhooks: intentionally has NO read policy because the `secret` column
-- holds the HMAC-SHA256 signing key. Only service_role may touch it.

alter table suppliers    enable row level security;
alter table products     enable row level security;
alter table inventory    enable row level security;
alter table restaurants  enable row level security;
alter table orders       enable row level security;
alter table order_items  enable row level security;
alter table webhooks     enable row level security;

create policy "public_read" on suppliers
  for select to anon, authenticated using (true);

create policy "public_read" on products
  for select to anon, authenticated using (true);

create policy "public_read" on inventory
  for select to anon, authenticated using (true);

create policy "public_read" on restaurants
  for select to anon, authenticated using (true);

create policy "public_read" on orders
  for select to anon, authenticated using (true);

create policy "public_read" on order_items
  for select to anon, authenticated using (true);

-- webhooks: no policies. service_role only.
