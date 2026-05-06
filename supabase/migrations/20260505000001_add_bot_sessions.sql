-- Order-draft conversation state for the WhatsApp bot. One active session
-- per WhatsApp number; sending a new message replaces the in-flight draft.
-- Service-role only — never readable by anon.
--
-- Note on state values: the MVP order flow only transitions through three
-- of these states (product → quantity → confirming). `choosing_date` is
-- defined now so adding a date-picker step later is a state-machine change,
-- not a schema migration.

create type bot_session_state as enum (
  'choosing_product',     -- showed product menu, waiting for selection
  'choosing_quantity',    -- product picked, waiting for qty
  'choosing_date',        -- (reserved for future use; not visited in MVP)
  'confirming'            -- showed summary, waiting for confirm/cancel
);

create table bot_sessions (
  wa_id            text primary key,
  restaurant_id    uuid not null references restaurants(id) on delete cascade,
  state            bot_session_state not null,
  -- Accumulated draft as we walk the user through the flow.
  -- Shape grows as we progress:
  --   { product_id?: uuid, unit_price_cents?: int, quantity?: number,
  --     delivery_date?: 'YYYY-MM-DD' }
  draft            jsonb not null default '{}'::jsonb,
  -- Abandoned drafts get garbage-collected. 30 min covers a typical pause
  -- without forcing a restart if someone got briefly distracted.
  expires_at       timestamptz not null default (now() + interval '30 minutes'),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index bot_sessions_expires_idx on bot_sessions(expires_at);

create trigger bot_sessions_set_updated_at
  before update on bot_sessions
  for each row execute function set_updated_at();

-- RLS on, no policies → service_role only. Anon must never see another
-- restaurant's draft order.
alter table bot_sessions enable row level security;
