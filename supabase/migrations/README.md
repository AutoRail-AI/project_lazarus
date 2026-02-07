# Database migrations

SQL migrations run in **filename order** and are recorded in `schema_migrations`. Only pending files are applied.

## Single migrate command

One command runs **all** migrations (Supabase SQL + Better Auth):

```bash
pnpm migrate
```

- Applies pending SQL from `supabase/migrations/` (uses `SUPABASE_DB_URL` or `DATABASE_URL`).
- Runs Better Auth migrations (auth tables).

**Before dev**: `pnpm dev` runs `pnpm migrate` via `predev`, so the DB is up to date when the app starts.

## Adding a migration

1. Add a new `.sql` file with a **timestamp prefix** so order is clear:
   ```
   supabase/migrations/YYYYMMDDHHMMSS_description.sql
   ```
   Example: `20260208120000_add_usage_table.sql`

2. Write idempotent SQL when possible (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, etc.).

3. Run `pnpm migrate` to apply it.

## Direct Postgres URL

Get the URI from **Supabase Dashboard → Settings → Database → Connection string → URI** and set in `.env.local`:

```env
SUPABASE_DB_URL=postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
```

(Or the non-pooler URL on port 5432.)
