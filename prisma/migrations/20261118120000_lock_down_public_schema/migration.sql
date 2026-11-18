-- Lock the public schema against Supabase's auto-generated REST API.
--
-- Supabase exposes every table in `public` at /rest/v1 and grants the `anon`
-- and `authenticated` roles full access by default. The anon key is PUBLIC —
-- it ships in every visitor's browser — so with no row-level security anyone
-- could read the admin's password hash and every customer's name, phone and
-- address, and could insert, edit or delete rows. Verified before this
-- migration: anon read admin_users and could INSERT/DELETE.
--
-- This app never uses that API for data (all queries go through Prisma over a
-- direct Postgres connection as the table owner, which bypasses RLS), so the
-- correct policy is to allow nothing: RLS on, no policies, grants revoked.
--
-- Guarded so the migration also applies to a plain Postgres (local dev, CI)
-- that has no Supabase roles.

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM authenticated;
  END IF;
END $$;
