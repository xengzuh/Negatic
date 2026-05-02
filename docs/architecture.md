# Architecture

High-level picture. For project goals and MVP scope, see
[CLAUDE.md](../CLAUDE.md). For specific decisions, see
[`decisions/`](./decisions).

```
                  +------------------+
                  |  AI agents /     |
                  |  external ERPs   |
                  +---------+--------+
                            |
                            v
+-------------+      +------+------+      +---------------------+
|  Supplier   | ---> |  Negatic     | <-- |  WhatsApp bot       |
|  dashboard  |      |  API (v1)    |     |  (Meta Cloud API)   |
+-------------+      +------+------+      +---------------------+
                            |
                            v
                  +---------+--------+
                  |  Supabase        |
                  |  (Postgres +     |
                  |   PostgREST)     |
                  +------------------+
                            |
                            v outbound webhooks
                  +---------+--------+
                  |  Supplier        |
                  |  internal tools  |
                  +------------------+
```

Key properties:

- **The schema is the contract.** PostgREST auto-generates the API; the
  OpenAPI spec is the public, agent-readable description of that contract.
- **No private API.** Dashboard and bot use the same endpoints any external
  consumer would. If a feature can't be exposed publicly, it's a red flag.
- **Idempotency-first writes.** Every POST that creates a resource requires
  an `Idempotency-Key` header so retries are safe.
- **Webhooks for outbound events.** Suppliers register URLs; we sign payloads
  with HMAC-SHA256 in the `X-Negatic-Signature` header.
