# Supabase

Local Postgres + PostgREST + Studio for Negatic. The schema in
[`migrations/`](./migrations) IS the API contract — PostgREST auto-generates
endpoints from it.

## Files

- `config.toml` — local Supabase stack config (ports, schemas, auth flags).
- `migrations/` — timestamped SQL files. Apply in order. Source of truth.
- `seed.sql` — dev-only fixtures (1 supplier, 4 chicken SKUs, 3 restaurants).

## Daily workflow

```bash
supabase start         # boots local stack (needs Docker)
supabase db reset      # wipes local DB, replays migrations + seed
```

## Making a schema change

1. Edit a table in Studio (http://127.0.0.1:54323) or write SQL directly in psql.
2. `supabase db diff -f <descriptive_name>` — generates a new migration in
   `migrations/`.
3. Review the generated SQL, edit if needed, commit it.
4. **Update `api-spec/openapi.yaml` in the same PR** if the change is visible
   to API consumers (per CLAUDE.md rule).
5. `supabase db push` to apply to the linked hosted project (after CI green).

## Linking to the hosted project

```bash
supabase login
supabase link --project-ref <your-project-ref>
```

The project ref lives in the Supabase dashboard URL. Once linked,
`supabase db push` deploys local migrations to staging/prod.

## Why migrations live here, not in `db/`

Supabase CLI hardcodes `supabase/migrations/` and `supabase/seed.sql`. Putting
them anywhere else means losing `supabase db reset`, `supabase db diff`, and
`supabase db push` — which is the whole reason we picked the CLI.
