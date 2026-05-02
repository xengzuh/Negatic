# Negatic

Agent-native F&B procurement infrastructure for the Malaysian market.

The product is the API + database. The supplier dashboard and WhatsApp bot are
proof-of-concept clients of the same public API any AI agent would use.

For project context, MVP scope, conventions, and the schema sketch, see
[CLAUDE.md](./CLAUDE.md).

## Repo layout

```
negatic/
├── api-spec/       # OpenAPI 3.1 contract — source of truth for the public API
├── supabase/       # Supabase project: migrations, seed, config
├── packages/       # Shared libraries (Zod schemas, generated client, config)
├── apps/
│   ├── dashboard/  # Supplier dashboard (Next.js)
│   └── bot/        # WhatsApp bot (Node.js, Meta Cloud API)
└── docs/
    └── decisions/  # ADRs
```

## Prerequisites

- Node.js >= 20
- pnpm >= 9 (`npm i -g pnpm`)
- Docker Desktop (only for running Supabase locally — `supabase start`)
- Supabase CLI (`npm i -g supabase` or `brew install supabase/tap/supabase`)

## Getting started

```bash
pnpm install
cp .env.example .env
# fill in SUPABASE_* and META_* values, then:
supabase start            # spins up local Postgres + PostgREST + Studio
supabase db reset         # applies all migrations + seed
```

## Common scripts

| Command                 | What it does                                       |
| ----------------------- | -------------------------------------------------- |
| `pnpm typecheck`        | Type-check every workspace package                 |
| `pnpm test`             | Run Vitest in every workspace package              |
| `pnpm openapi:lint`     | Lint `api-spec/openapi.yaml` with Redocly          |
| `pnpm db:start`         | Start local Supabase stack                         |
| `pnpm db:reset`         | Reset local DB and reapply migrations + seed       |
| `pnpm db:diff`          | Generate a new migration from local schema changes |
| `pnpm db:push`          | Apply local migrations to the linked hosted project |
