# ChangeWatch

Watch a public webpage. Save the visible text. Get an in-app alert, and an optional webhook, when that text changes.

ChangeWatch now uses **Supabase Auth** and **Postgres** for multi-user accounts. Each user has their own watches and alerts. Plan limits (`free`, `pro`, `power`) are enforced on the server.

## Requirements

- Node.js 18+
- A Supabase project (Auth + Postgres)

## Setup

1. Copy environment variables:

```bash
cp .env.example .env
```

2. Fill in `.env`:

- `SUPABASE_URL` — Project URL
- `SUPABASE_ANON_KEY` — anon public key (safe for server auth client)
- `SUPABASE_SERVICE_ROLE_KEY` — **server only**, never expose to the browser

3. Apply the database migration in the Supabase SQL editor (or CLI):

```text
supabase/migrations/001_accounts.sql
```

4. Install and run:

```bash
npm install
npm start
```

Open http://localhost:3000

- Dashboard: http://localhost:3000/app.html (requires login)
- Sign up: http://localhost:3000/signup.html

## Plans (server-enforced)

| Plan  | Max watches | Fastest interval |
|-------|-------------|------------------|
| Free  | 5           | 6 hours          |
| Pro   | 25          | 15 minutes       |
| Power | 100         | 5 minutes        |

New accounts start on **free**. Stripe billing is not connected yet.

## Legacy JSON migration

Existing `data/watches.json` is kept on disk but is **not** used at runtime. To import legacy data for a specific user:

```bash
node scripts/migrate-json-data.js <supabase-user-id>
node scripts/migrate-json-data.js <supabase-user-id> --dry-run
```

The script never picks a user automatically and never deletes the JSON file.

## Testing

```bash
npm test
node --check server.js
```

Integration tests against a live Supabase project are optional; the default suite uses mocks for ownership and plan rules.

## Security notes

- Sessions are stored in **httpOnly** cookies (not `localStorage`).
- `SUPABASE_SERVICE_ROLE_KEY` is only used on the server (API routes and background polling).
- Watch APIs always scope by the authenticated user ID from the session.
- Private/local URL blocking remains active for SSRF protection.

## Deploy

Set `PORT`, `APP_URL`, and all Supabase variables in production. Use `NODE_ENV=production` so session cookies are marked `Secure`.

Keep Postgres (Supabase) as the source of truth for watches and alerts.
