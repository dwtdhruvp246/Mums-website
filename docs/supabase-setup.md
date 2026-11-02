# Catering Desk: sign-in and private workspaces

The application uses email/password sign-in with accounts you create in Supabase Authentication. It has no registration screen, no sign-up call and no inactivity sign-out timer. The CateringDesk project (`utowoqurrpbcetnctreo`) is connected and the workspace migration is applied. Backend sign-ups were still enabled at the last check; turn them off and verify the session settings below before adding real users. A real-account browser sign-in test remains pending.

## 1. Select the catering project

Use the Supabase project intended for Catering Desk. The app needs only these hosted runtime values:

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | The project's HTTPS URL |
| `SUPABASE_PUBLISHABLE_KEY` | The publishable key beginning with `sb_publishable_` |

For an older project, `SUPABASE_ANON_KEY` can be used instead of the publishable key. The application rejects secret and service-role keys in its browser configuration. No administrator token or database password belongs in the app.

Configure these values through the Site's runtime environment settings and deploy the prepared version again. Do not put runtime credentials into the hosting manifest or committed source. For local development, use untracked `.dev.vars` with the same variable names.

The GitHub Pages version uses `pnpm build:pages` and receives the same public project configuration at build time. Its generated JavaScript includes the browser-safe public key; it has no server on which to run `/api/auth/config`. The build rejects secret/service-role keys. Both versions use the same Supabase account ownership and RLS rules.

## 2. Create the private workspace table

For a fresh project, run `supabase/migrations/20261102150707_private_workspaces.sql` once in its SQL editor. Keep its transaction intact. This migration is already applied to CateringDesk; do not run it again there. An existing-table error means it has already been applied or there is a naming conflict; preserve existing data and inspect the error instead of dropping the table.

The table stores the current catering records as one document per Auth account, matching the app's existing workspace model. The `user_id` primary key also references `auth.users.id`. A first successful login creates an empty workspace with no sample orders or customers. Subsequent logins, including other devices, load the same account's records.

RLS allows an authenticated account to read and update only its own row, and to create only its own workspace. Anonymous database access is denied. Account owners cannot change the ownership/revision columns or delete the entire workspace through the public client. Deleting an Auth user as the Supabase administrator also deletes that user's workspace through the foreign key.

Every save includes the revision that was loaded. A stale device receives a conflict message instead of overwriting the newer saved records. Failed loads never replace a real workspace with demo or empty data.

## 3. Configure Supabase Authentication

In the project's Auth configuration:

- Keep email/password sign-in enabled.
- Turn **Allow new users to sign up** off. Hiding a button alone does not disable the sign-up API.
- Keep anonymous sign-in off and leave unused social providers disabled.
- Leave **Inactivity timeout** and **Time-box user sessions** unset/disabled.
- Leave **Single session per user** off so signing in on another device does not terminate the first device's session.
- Keep the normal short-lived JWT expiration and refresh-token protection. Do not extend JWT lifetime to simulate a persistent login.
- Set the Site URL to the final HTTPS address used by the catering app.

The browser client uses `persistSession: true` and `autoRefreshToken: true`. Its auth listener performs synchronous state updates; data fetching happens separately, avoiding refresh/listener deadlocks. Returning from a background tab uses Supabase's normal session recovery. A temporary network error shows a retry state and does not call `signOut` or erase the stored session.

Explicit sign-out, administrator revocation, password/security changes or clearing browser/app storage can still require another login. Persistent sign-in cannot override those actions.

## 4. Add users yourself

Open **Authentication → Users → Add user** and create an email/password account. If this is a direct administrator-created account, select the dashboard's confirmation option so the user is able to sign in; otherwise complete its email confirmation first. Give the login details to the intended user through your usual private channel.

Each account gets its own workspace. There is no shared staff workspace or business-role system in this version.

## 5. Hosted acceptance checks

Use two test accounts you control before entering real business data:

1. Sign in as account A. Add a category, a menu item, a customer and an order. Reload and confirm they remain.
2. Sign out, then sign in as account B. Confirm A's records are absent. Add B's own records.
3. Sign back in as A. Confirm only A's records appear.
4. Sign in as A on a second device. Confirm both devices can stay signed in and access A's workspace.
5. Save on one device, then try saving an older view on the other. Confirm it asks for refresh instead of replacing newer data.
6. Background/close the app and return after the access token has expired. Confirm refresh restores the session.
7. Temporarily disconnect, restore connectivity and retry. Confirm a connection failure does not sign the account out or erase data.
8. Try an unregistered email and confirm sign-in fails. Confirm there is no sign-up screen.

Local tests exercise the actual workspace migration with two synthetic database users and run the session/storage tests. They are not a substitute for these hosted checks with your Supabase project.

The optional `supabase/tests/private_workspaces.sql` checks the live table under separate database roles using two temporary identities. It rolls back every test record, creates no usable sign-in credentials, and sends no email. Run the complete script, including its final `ROLLBACK`; it does not test a real user's password or browser session.

## PWA after setup

Keep the production origin stable so browser session storage remains associated with the same app. The PWA can use this login and workspace layer. Its future service worker should cache the app shell and static assets, while excluding auth requests, configuration, user records and private responses from shared caches. Offline editing/synchronisation is a separate feature and is not enabled by this login work.

The temporary `/demo` route opens sample data only while Supabase is unconfigured; it redirects to the login flow once valid project configuration is supplied. It never imports a browser's sample records into an authenticated workspace.

The current Sites preview also retains its existing ChatGPT owner-only access gate. Supabase user creation alone does not grant another person access through that outer gate. Choose the final hosting/access arrangement when connecting the production project; this implementation does not make the Site public.

The separate GitHub Pages deployment opens directly at `https://dwtdhruvp246.github.io/Mums-website/` and uses Supabase sign-in. Use that URL as the production Auth Site URL when GitHub Pages is the chosen host. Password sign-in itself does not require an OAuth callback route.

Official references: [sessions](https://supabase.com/docs/guides/auth/sessions), [client initialisation](https://supabase.com/docs/reference/javascript/initializing), [general Auth configuration](https://supabase.com/docs/guides/auth/general-configuration), [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).
