# Mums-website · Catering Desk

A home catering workspace for orders, customers, occasions, menus and kitchen preparation. Built with React, TypeScript, Vinext and Supabase, with a Cloudflare Worker runtime.

## Features

- Editable occasion categories such as Diwali and Weddings.
- Saved customers with optional phone numbers and automatic contact details in new orders.
- Menu items with their own sizes, variations, prices, units and pack weights.
- Excel template download, bulk menu upload and review with row-specific errors and duplicate prevention.
- Dashboard calendar, clearly bordered orders, status colours, pack counts and preparation totals.
- Preparation totals on Orders follow the search, category and status filters, with separate sizes, pack counts and combined dish weights. Cancelled orders are excluded.
- Orders, kitchen preparation, customer records, payments, printing and CSV export.
- Alphabetical menu items and dropdown lists; black body text and responsive layouts.
- Email/password sign-in only. Accounts are created by the administrator in Supabase Auth.
- Persistent sessions with automatic token refresh and no application inactivity sign-out timer.
- Installable PWA with a persistent installation strip, platform-specific steps and no close or Later control.
- One Supabase workspace per user, enforced by database row-level security. A revision check prevents stale devices from silently overwriting newer changes.

## Bulk menu import

On **Menu**, download the Excel template, fill the **Menu items** sheet, and upload the `.xlsx` file. The **Guide & examples** sheet explains each column and is never imported. Use one row per plain item, or one row per variation with the same item name and food group. Every variation keeps its own price, unit and optional pack weight.

Review the upload before clicking **Import**. Existing items with the same name and food group are skipped, including archived items; imports never update existing prices or order history. All row errors must be corrected before saving. The validated new items save in one workspace update, subject to the same revision check as manual edits. Files support up to 500 data rows, including variation rows, and 2 MB. Prices use the workspace currency; paste values rather than formulas.

## Supabase setup

Follow [docs/supabase-setup.md](docs/supabase-setup.md). Configure the project URL and public client key as runtime environment variables:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project HTTPS URL |
| `SUPABASE_PUBLISHABLE_KEY` | Public publishable key |
| `SUPABASE_ANON_KEY` | Legacy public anon key, used instead of the publishable key |

Run [the workspace migration](supabase/migrations/20261102150707_private_workspaces.sql) once in a fresh project's SQL editor. It is already applied to the connected CateringDesk project. Disable new sign-ups in Supabase Auth, create the intended users yourself, and leave inactivity/time-box session limits disabled. Keep standard JWT expiration and refresh protection.

Project configuration alone does not install the schema or change Auth settings. Verify both, then test sign-in and account isolation using two administrator-created test accounts before using real business records. Temporary network failures show a retry state; they never replace records with sample data.

Local environment files are ignored by Git. The Worker version reads configuration from hosting runtime settings. The GitHub Pages bundle contains only the public Supabase URL and browser-safe key, as required by a browser client. Administrator, service-role and secret keys must never be included.

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
pnpm verify:menu-import
pnpm verify:pwa
pnpm build
```

The catering checks cover the real order/menu logic. Auth checks use the actual SDK and PostgreSQL migration with synthetic users to verify persistence, token refresh, RLS, workspace isolation and stale-save conflicts. They do not contact a live Supabase project.

`pnpm build` emits the Worker application under `dist/`. The tracked Sites tooling and `.openai/hosting.json` preserve the existing private hosted preview and its separate ChatGPT access gate. The historical D1 binding remains unused, and the retired `/api/workspace` endpoint is closed.

## GitHub Pages

The repository also includes a static browser build for GitHub Pages. It runs the same sign-in, orders and workspace components and connects directly to Supabase under the same user-specific RLS policies.

```sh
# Supply SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY).
pnpm build:pages
```

If those environment values are absent, the script accepts a JSON object on stdin containing `url` and `publishableKey`. It validates the key and rejects privileged credentials. The generated files are placed in `.sites-runtime/github-pages/`.

For the repository's existing **Deploy from a branch → main → / (root)** setup, publish all contents of that output directory at the repository root, including `index.html`, `.nojekyll`, `menu-import-template.xlsx`, `pages-assets/`, `manifest.webmanifest`, `pwa/`, `pwa-bootstrap.js`, `sw.js` and `offline.html`. Rebuild and publish these generated files whenever the app source changes. Relative asset URLs support the `/Mums-website/` project path. The source entry point is `web/main.tsx`; do not edit the generated bundle directly.

The root `index.html` opens the application instead of GitHub's generated README page. GitHub Pages serves the public sign-in screen; orders and customer records remain protected in Supabase. It does not use the Worker `/api/auth/config` endpoint or the private Sites access gate.

## PWA

The PWA can be installed from the login screen or the workspace using the always-visible **Install app** button. The installation strip stays available until installation is confirmed and has no close or Later action. Android Chrome uses the browser's installation confirmation directly when available, with readiness feedback while the browser prepares its prompt. iOS and unsupported browsers receive relevant guidance after tapping the button. See [docs/pwa.md](docs/pwa.md) for installation, browser limitations and update behavior.

Only public offline artwork and the connection-help page are cached. Orders, customer data, configuration and Auth requests are never cached by the service worker. Opening and saving a workspace requires an internet connection; existing Supabase session persistence remains in place.
