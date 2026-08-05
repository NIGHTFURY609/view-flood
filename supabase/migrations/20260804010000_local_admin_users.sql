-- Kerala Camp Check — local admin authentication (email + bcrypt password).
--
-- Apply with the DIRECT connection (port 5432), not the transaction pooler:
--   psql "$SUPABASE_DB_URL_DIRECT" -f supabase/migrations/20260804010000_local_admin_users.sql
--
-- The Supabase CLI and MCP cannot reach this project (it is Lovable
-- Cloud-managed and outside this account's organisation), so DDL goes over psql.
-- Every statement is idempotent so a partial run can be repeated safely.

-- ---------------------------------------------------------------------------
-- Local admin identities
--
-- Deliberately separate from public.admin_users. That table's id REFERENCES
-- auth.users(id) and is the Supabase-Auth-backed staff portal. This one owns
-- its own identities: the from-scratch JWT/cookie admin panel authenticates
-- against these rows and never touches Supabase Auth.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.users (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email           text UNIQUE NOT NULL,
    hashed_password text NOT NULL,
    display_name    text,
    -- No CHECK yet: RBAC is deferred, and every account is 'superuser' for now.
    -- Left open so roles can be added later without a constraint migration.
    role            text NOT NULL DEFAULT 'superuser',
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- Login looks rows up by email; enforce uniqueness and back the lookup.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON public.users (lower(email));

-- Mirror admin_users' lockdown: no direct client access, service role only.
-- The API connects as the database owner, which bypasses RLS regardless.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.users FROM anon, authenticated;
GRANT ALL ON public.users TO service_role;
