# Negatic — Agent-Native F&B Procurement Infrastructure

## What This Is

Negatic is API-first procurement infrastructure for the Malaysian F&B supply chain. Restaurants order from suppliers; suppliers fulfill those orders. The unique angle: every interaction is exposed through a clean, well-documented, agent-friendly API.

The product has three layers:

1. **The API + Database** — *the actual product*. Stripe-style infrastructure that any AI agent, ERP, mobile app, or chatbot can integrate with.
2. **The supplier dashboard** — a thin web client of our own API. Lets suppliers manage catalog, inventory, and orders without us needing to integrate with their existing tools on day one.
3. **The WhatsApp bot** — the wedge. The first AI agent that uses our API. Restaurants order chicken/rice/etc. via WhatsApp; the bot calls the API.

**The API is the business.** The dashboard and bot are demos that prove it works and bootstrap the marketplace.

## Why This Architecture

- AI agents will do most B2B procurement within 5 years.
- Agents need machine-readable interfaces, not human UIs (no scraping, no CAPTCHAs, no JS rendering).
- Whoever owns the rails owns the category.
- Supabase Postgres + auto-generated REST API is the most agent-friendly stack: introspectable schemas, OpenAPI docs out of the box, predictable JSON responses, webhooks, RLS for security.

## MVP Scope (90 days)

**Hard limits — do NOT build outside these:**

- 1 supplier (chicken supplier in PJ/Subang)
- 3 restaurants (small F&B, owner-operated)
- 1 product category (chicken — whole, breast, thigh, wings)
- 1 delivery zone (PJ/Subang)
- 1 currency (MYR)
- 1 UX language (English now, Malay later)

**IN scope for MVP:**

- Postgres schema + Supabase REST API
- Public OpenAPI spec served at `/docs`
- Supplier dashboard (Next.js, ugly is fine)
- WhatsApp bot with one flow: order chicken for next-day delivery
- Idempotency keys on all write endpoints
- Webhook delivery to suppliers when orders come in

**OUT of scope for MVP — push back if asked to build any of these:**

- Payments / billing
- Multi-supplier price comparison logic
- Driver/delivery tracking
- Restaurant-facing mobile app
- LLM/NLU features beyond simple button-based intent matching in WhatsApp
- Multi-tenancy beyond what Supabase RLS gives us
- Analytics dashboards
- Email notifications

## Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Database | Supabase (Postgres 15+) | Auto-generated REST API, free tier, RLS |
| API | Supabase REST + Edge Functions for orchestration | No hand-written controllers drifting from schema |
| API docs | OpenAPI 3.1 spec, published at `/docs` | Agent-readable contract |
| Supplier dashboard | Next.js 14+ (App Router) + TypeScript + Tailwind | Vercel free tier |
| WhatsApp bot | Node.js + TypeScript, Meta Cloud API (WhatsApp Business Platform) | Direct integration; better long-term cost than Twilio |
| Auth | Supabase Auth for suppliers; scoped API keys for agents | Standard, well-documented |
| Repo layout | Monorepo: `/api-spec`, `/apps/{dashboard,bot}`, `/packages/*`, `/supabase`, `/docs` | One source of truth |

## Schema (initial sketch — refine before migrating)

Core tables:

- `suppliers` — id, name, business_registration, phone, address, delivery_zones, halal_cert_number, payment_terms, created_at
- `products` — id, supplier_id, sku, name, name_ms, category, unit (kg/pcs/liter), halal_certified, description
- `inventory` — product_id, available_quantity, price_per_unit_cents, min_order_quantity, updated_at
- `restaurants` — id, name, phone, whatsapp_number, address, delivery_zone, default_payment_method
- `orders` — id, restaurant_id, supplier_id, status (pending/confirmed/fulfilled/cancelled), delivery_date, delivery_window, total_amount_cents, idempotency_key (unique), created_at
- `order_items` — id, order_id, product_id, quantity, unit_price_cents, line_total_cents
- `webhooks` — id, supplier_id, url, event_types (jsonb), secret, active

Conventions:

- Money stored as integer cents, MYR only
- Timestamps as `timestamptz`, UTC
- IDs as UUIDs (`uuid_generate_v4()`)
- Every table has `created_at` and `updated_at`
- Soft deletes via `deleted_at` (no hard deletes)
- `idempotency_key` required on every endpoint that creates resources

## API Conventions

- **Versioning**: URL prefix `/v1/`
- **Format**: JSON only, snake_case keys
- **Errors**: RFC 7807 Problem Details
- **Pagination**: cursor-based, not offset
- **Idempotency**: `Idempotency-Key` header required on all POST endpoints that create resources
- **Auth**: Bearer tokens (scoped API keys for agents, Supabase JWT for dashboard users)
- **Rate limits**: per-API-key; documented in the OpenAPI spec
- **Webhooks**: HMAC-SHA256 signature in `X-Negatic-Signature` header

## Coding Conventions

- TypeScript strict mode everywhere
- Zod for runtime validation at every API boundary
- Database migrations in `/supabase/migrations` using Supabase CLI — never edit prod schema directly
- One feature = one PR. If a PR changes the schema, it must also update the migration AND the OpenAPI spec
- Tests for API endpoints using Vitest (not Jest)
- Do NOT use heavy ORMs that hide Postgres — we want the schema to BE the contract
- Comments only when behavior isn't obvious from the code

## How to Help Me on This Project

When working on a task in this repo:

1. Read this file first.
2. If the task touches the schema, propose the migration as a diff before writing it.
3. If the task touches the API, update the OpenAPI spec in the same change.
4. Always show me the diff before applying it.
5. If I ask for something that violates the MVP scope above, push back — don't just build it.
6. When in doubt about a design choice, ask one focused question instead of guessing.

## Decisions Log

Add decisions here as we make them, with date and reasoning.

- **2026-05-03** — Chose Supabase over self-hosted Postgres for speed of MVP and built-in PostgREST.
- **2026-05-03** — Chose Meta Cloud API (WhatsApp Business Platform) over Twilio. Reverses an earlier preference for Twilio's faster onboarding; user opted to absorb the heavier Meta setup (Business account, WABA, app secret, webhook verify token) up front to avoid a future migration and to capture better per-conversation pricing. See `docs/decisions/0001-meta-cloud-api-over-twilio.md`.
- **2026-05-03** — Starting with chicken-only category because high-frequency, halal-relevant, universal across F&B outlets.
- **2026-05-03** — Package manager: pnpm. Monorepo tooling: pnpm workspaces only (no Turborepo/Nx until build times warrant it). Supabase: local CLI linked to a hosted project (requires Docker Desktop for `supabase start`).
- **2026-05-04** — RLS posture: read-only-for-anon. All tables have RLS enabled. `anon` and `authenticated` can `SELECT` from suppliers/products/inventory/restaurants/orders/order_items. Writes flow through `service_role` (which bypasses RLS). `webhooks` has RLS enabled with NO policies, so anon/authenticated cannot read it (the `secret` column holds an HMAC signing key). Per-supplier scoping is deferred until Supabase Auth is wired up — when that lands, replace `public_read` policies on supplier-scoped tables with policies keyed off `auth.jwt()` claims. See `supabase/migrations/20260504000001_enable_rls_read_only.sql`.
