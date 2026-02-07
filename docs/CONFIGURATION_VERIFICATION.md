# Configuration Verification

This document verifies Project Lazarus configuration against Supabase and Better Auth best practices.

## Database Architecture

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Better Auth** | pg (node-postgres) Pool | Authentication, sessions, organizations |
| **Supabase Client** | @supabase/ssr, @supabase/supabase-js | Data API, RLS, real-time (if used) |

**Note:** This project does **not** use Prisma. The Prisma quickstart (custom `prisma` user, Prisma migrations) does not apply. Better Auth uses the built-in Kysely adapter with a pg Pool directly.

---

## Supabase Connection String

### Direct Connection (Default)

Use the **direct connection** from Supabase Dashboard → Settings → Database → Connection string → URI.

**Format:**
```
postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

**Note:** Direct connection uses IPv6 by default. If you get ECONNREFUSED, either enable the [IPv4 add-on](https://supabase.com/docs/guides/platform/ipv4-address) (Pro plan) or switch to the pooler connection string (Session mode).

**Schema:** The auth config appends `search_path=public` to the connection string so Better Auth uses the `public` schema and avoids the "Schema '$user' does not exist" warning.

---

## Environment Variables Checklist

| Variable | Required | Verification |
|----------|----------|--------------|
| `SUPABASE_DB_URL` | Yes | Direct connection URL from Dashboard |
| `BETTER_AUTH_SECRET` | Yes | 32+ characters |
| `BETTER_AUTH_URL` | Yes | App URL (e.g. `http://localhost:3000`) |
| `NEXT_PUBLIC_APP_URL` | No | Should match BETTER_AUTH_URL for OAuth |
| `GOOGLE_CLIENT_ID` | For Google OAuth | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | For Google OAuth | From Google Cloud Console |

---

## Supabase Dashboard Setup

1. **Connection string:** Settings → Database → Connection string → URI
2. **Redirect URI (Google OAuth):** Add `https://yourdomain.com/api/auth/callback/google` to Google Cloud Console
3. **API keys:** Settings → API → Use for Supabase client (Data API), not for Better Auth

---

## Migrations

```bash
pnpm auth:migrate
```

- Uses `lib/auth/better-auth.cli.ts` (excluded from Next.js build)
- Uses `SUPABASE_DB_URL` as-is (direct connection)

---

## What Does Not Apply

- **Prisma user / Prisma migrations** – Project does not use Prisma
- **Custom `prisma` database role** – Not needed
- **Prisma schema generation** – Better Auth CLI handles migrations directly
