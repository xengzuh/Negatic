# @negatic/dashboard

Supplier dashboard. Next.js 14 (App Router) + TypeScript + Tailwind.

> **Not scaffolded yet.** This folder holds the workspace package shell and
> README only. To scaffold:
>
> ```bash
> cd apps/dashboard
> pnpm dlx create-next-app@latest . --ts --tailwind --app --eslint --src-dir --import-alias "@/*"
> ```
>
> Then re-add the workspace dependencies on `@negatic/shared-schemas` and
> `@negatic/config` to the generated `package.json`.

## What it does (planned)

- Supplier login (Supabase Auth).
- Catalog management (CRUD on `products` + `inventory`).
- Order inbox: see new orders, confirm/cancel, mark fulfilled.
- Webhook URL settings.

It calls the same `/v1/*` endpoints any external agent would. No private API.
