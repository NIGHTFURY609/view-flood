-- Kerala Camp Check — admin review marker for the reported-camps queue.
--
-- Apply with the DIRECT connection (port 5432):
--   psql "$SUPABASE_DB_URL_DIRECT" -f supabase/migrations/20260805000000_camp_reviewed_at.sql
--
-- Idempotent.

-- The Reported Camps queue is: verification_state = 'unverified' AND reviewed_at IS NULL.
-- Rejecting a reported camp stamps reviewed_at (it stays unverified but leaves the
-- queue); approving it moves it to 'verified' (and also stamps reviewed_at).
ALTER TABLE public.camps ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- Backs the queue filter (unreviewed unverified camps, newest first).
CREATE INDEX IF NOT EXISTS camps_reported_queue_idx
    ON public.camps (updated_at DESC)
    WHERE verification_state = 'unverified' AND reviewed_at IS NULL;
