# Mums-website · Catering Desk

A home catering workspace for orders, customers, occasions, menus and kitchen preparation. Built with React, TypeScript, Vinext and Supabase, with a Cloudflare Worker runtime.

## Features

- Editable occasion categories such as Diwali and Weddings.
- Saved customers with optional phone numbers and automatic contact details in new orders.
- Menu items with their own sizes, variations, prices, units and pack weights.
- Dashboard calendar, clearly bordered orders, status colours, pack counts and preparation totals.
- Orders, kitchen preparation, customer records, payments, printing and CSV export.
- Alphabetical menu items and dropdown lists; black body text and responsive layouts.
- Email/password sign-in only. Accounts are created by the administrator in Supabase Auth.
- Persistent sessions with automatic token refresh and no application inactivity sign-out timer.
- One Supabase workspace per user, enforced by database row-level security. A revision check prevents stale devices from silently overwriting newer changes.

## Supabase setup

Follow [docs/supabase-setup.md](docs/supabase-setup.md). Configure the project URL and public client key as runtime environment variables:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project HTTPS URL |
| `SUPABASE_PUBLISHABLE_KEY` | Public publishable key |
| `SUPABASE_ANON_KEY` | Legacy public anon key, used instead of the publishable key |

Run [the workspace migration](supabase/migrations/20261102150707_private_workspaces.sql) once in a fresh project's SQL editor. It is already applied to the connected CateringDesk project. Disable new sign-ups in Supabase Auth, create the intended users yourself, and leave inactivity/time-box session limits disabled. Keep standard JWT expiration and refresh protection.

Project configuration alone does not install the schema or change Auth settings. Verify both, then test sign-in and account isolation using two administrator-created test accounts before using real business records. Temporary network failures show a retry state; they never replace records with sample data.

Local environment files are ignored by Git. Credentials are supplied through hosting runtime settings and are not committed to this repository.

## Run locally

Use the Node version required by `package.json` and the pinned pnpm version in its `packageManager` field.

```sh
pnpm install --frozen-lockfile
# Create an untracked .dev.vars with the runtime variables above.
pnpm dev
```

Without Supabase configuration, `/` shows an honest, disabled sign-in preview. `/demo` opens the browser-local sample workspace for reviewing the existing features. Once configured, `/demo` redirects to the sign-in flow; sample records are never imported into a real account.

## Validate and build

```sh
pnpm exec tsc --noEmit
pnpm verify:catering
pnpm verify:auth
pnpm build
```

The catering checks cover the real order/menu logic. Auth checks use the actual SDK and PostgreSQL migration with synthetic users to verify persistence, token refresh, RLS, workspace isolation and stale-save conflicts. They do not contact a live Supabase project.

This is a Worker application, not a static GitHub Pages site. `pnpm build` emits client assets and server code under `dist/`. The tracked Sites tooling and `.openai/hosting.json` preserve the existing private hosted preview. That preview has a separate ChatGPT access gate; Supabase users also need access to the chosen production host. The historical D1 binding remains unused, and the retired `/api/workspace` endpoint is closed.

## PWA

The PWA will be added after live authentication is verified. No service worker or offline editing is enabled yet. Future caching must exclude Auth traffic, private records and configuration responses.
