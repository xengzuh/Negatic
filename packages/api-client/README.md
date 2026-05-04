# @negatic/api-client

Typed client for the Negatic API. Types are generated from
[`api-spec/openapi.yaml`](../../api-spec/openapi.yaml) using
[`openapi-typescript`](https://www.npmjs.com/package/openapi-typescript) and
wrapped with [`openapi-fetch`](https://www.npmjs.com/package/openapi-fetch).

## What it gives you

```ts
import {
  createNegaticClient,
  newIdempotencyKey,
  type Product,
} from '@negatic/api-client';

const client = createNegaticClient({
  baseUrl: 'https://api.negatic.dev/v1',
  token: process.env.NEGATIC_API_KEY!,
});

// Typed list
const { data, error } = await client.GET('/products', {
  params: { query: { limit: 10 } },
});

// Typed create with idempotency
await client.POST('/orders', {
  params: { header: { 'Idempotency-Key': newIdempotencyKey() } },
  body: {
    restaurant_id: '...',
    supplier_id: '...',
    delivery_date: '2026-05-04',
    items: [{ product_id: '...', quantity: 5 }],
  },
});
```

Misuse — wrong path, wrong query param, wrong body shape — is a type error
at the call site.

## Regenerating after a spec change

```bash
pnpm --filter @negatic/api-client generate
```

Runs `openapi-typescript ../../api-spec/openapi.yaml -o src/schema.ts`.
Output is committed so consumers don't need to run codegen on install.

## Important: target vs reality

These types describe the **target** public API surface (`/v1/products`,
RFC 7807 errors, idempotency keys). The local Supabase stack actually
exposes **PostgREST** at `/rest/v1/products?select=...`, which has a
different URL and query shape.

For the MVP, two paths exist for actually writing data:

- **PostgREST direct** via [`supabase-js`](https://supabase.com/docs/reference/javascript)
  — Supabase's own typed client. Skip this package, use supabase-js. Fast.
- **Match the contract** — put Supabase Edge Functions at `/v1/*` that wrap
  PostgREST, validate with `@negatic/shared-schemas`, and respond per the
  OpenAPI spec. Slower to build but the API stays clean.

Plan: Edge Functions for endpoints we expose publicly (orders, products
catalog, webhooks). Internal dashboard reads can keep using supabase-js
directly.
